import Groq from "groq-sdk";
import { pyannoteDiarize } from "./pyannoteDiarize.js";

const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── "Who's speaking" ──────────────────────────────────────────────────────
// Two strategies, tried in order:
//
//   1. Real diarization (pyannoteDiarize): sends the actual audio to the
//      pyannote HF Space, which clusters voice embeddings from the raw
//      waveform. This is the accurate path — it can tell two different
//      voices apart even without dialogue cues.
//
//   2. Text-and-timing heuristic (this file's original behavior): used when
//      no audio is available, or the Space call fails/times out. LLaMA reads
//      the ordered transcript and assigns SPEAKER_N labels using dialogue
//      cues (turn-taking, pronoun switches, silence-gap hints). Approximate,
//      but a reasonable degradation path that keeps caption generation from
//      ever breaking on a diarization hiccup.
const SILENCE_GAP_SECONDS = 1.2; // gap longer than this hints at a turn change
const MAX_SPEAKERS = 6; // keeps the voice-picker UI and TTS casting sane

// The pyannote Space labels speakers "SPEAKER_00", "SPEAKER_01"... (0-indexed,
// zero-padded) — its own internal clustering convention. Everywhere else in
// this app (the Groq heuristic below, Caption.captions.speaker's schema
// default, and the frontend's nextSpeakerLabel()/speakerLabel() display
// logic) uses "SPEAKER_1", "SPEAKER_2"... (1-indexed, unpadded). Left
// unnormalized, the raw pyannote labels would still "work" mechanically but
// would display as "Speaker 00" in the editor, and any *new* speaker added
// manually there (which mints "SPEAKER_N" in the app's convention) could
// collide with or look inconsistent next to the pyannote ones. Remap to the
// app's convention here, in first-appearance order, so both diarization
// paths produce identically-shaped output.
const normalizeSpeakerLabel = (rawLabel, labelMap) => {
  if (!labelMap.has(rawLabel)) {
    labelMap.set(rawLabel, `SPEAKER_${labelMap.size + 1}`);
  }
  return labelMap.get(rawLabel);
};

// Map continuous pyannote segments onto each caption line by picking
// whichever pyannote segment overlaps it the most.
const assignSpeakersFromSegments = (captions, pyannoteSegments) => {
  const speakers = new Set();
  const labelMap = new Map(); // raw pyannote label -> app-convention label

  const diarized = captions.map((c) => {
    let best = null;
    let bestOverlap = 0;

    for (const seg of pyannoteSegments) {
      const overlap = Math.min(c.end, seg.end) - Math.max(c.start, seg.start);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = seg;
      }
    }

    const speaker = best ? normalizeSpeakerLabel(best.speaker, labelMap) : "SPEAKER_1";
    speakers.add(speaker);
    return { ...c, speaker };
  });

  return { captions: diarized, speakerCount: speakers.size };
};

const diarizeWithGroqHeuristic = async (captions) => {
  const hinted = captions.map((c, i) => {
    const prevEnd = i > 0 ? captions[i - 1].end : null;
    const gapBefore = prevEnd !== null ? +(c.start - prevEnd).toFixed(2) : null;
    return {
      i,
      text: c.text,
      likelyTurnChange: gapBefore !== null && gapBefore >= SILENCE_GAP_SECONDS,
    };
  });

  const completion = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You label speaker turns in a video transcript. You are given a JSON array of ` +
          `{i, text, likelyTurnChange} objects in chronological order. "likelyTurnChange" means a ` +
          `long silence preceded that line (a hint only, not a guarantee — narration can pause too). ` +
          `Decide, from dialogue content and flow, which lines are spoken by the same person. Use at ` +
          `most ${MAX_SPEAKERS} distinct speakers, labelled "SPEAKER_1", "SPEAKER_2", etc, in order of ` +
          `first appearance. If the transcript reads as one narrator/speaker throughout, label everything ` +
          `SPEAKER_1. Return ONLY a JSON array of {i, speaker} objects, same length and order as the input, ` +
          `no explanation, no markdown.`,
      },
      { role: "user", content: JSON.stringify(hinted) },
    ],
    temperature: 0.1,
  });

  const raw = completion.choices[0].message.content.trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  const labels = JSON.parse(clean);

  const speakerByIndex = new Map(labels.map((l) => [l.i, l.speaker]));
  const speakers = new Set();
  const diarized = captions.map((c, i) => {
    const speaker = speakerByIndex.get(i) || "SPEAKER_1";
    speakers.add(speaker);
    return { ...c, speaker };
  });

  return { captions: diarized, speakerCount: speakers.size };
};

/**
 * @param {Array<{start:number, end:number, text:string}>} captions
 * @param {Buffer|Blob} [audioFile] - optional raw audio; when provided, real
 *   audio-based diarization is attempted first via the pyannote HF Space.
 */
export const diarizeSegments = async (captions, audioFile = null) => {
  if (captions.length === 0) return { captions, speakerCount: 0 };

  // Single short clip — not worth spending a model call to (almost
  // certainly correctly) conclude "one speaker".
  if (captions.length === 1) {
    return { captions: [{ ...captions[0], speaker: "SPEAKER_1" }], speakerCount: 1 };
  }

  if (audioFile) {
    try {
      // No exact speaker count is known at this point (nothing upstream
      // collects one), but the app's own UI/TTS-casting already caps out
      // at MAX_SPEAKERS anyway — passing that as an upper bound narrows
      // pyannote's clustering search space for free, improving accuracy
      // over leaving it fully unconstrained, with no product/UI changes
      // needed. If a real per-video expected-speaker-count field gets
      // added later, thread it through as numSpeakers/minSpeakers instead.
      const pyannoteSegments = await pyannoteDiarize(audioFile, 0, { maxSpeakers: MAX_SPEAKERS });
      return assignSpeakersFromSegments(captions, pyannoteSegments);
    } catch (err) {
      console.warn(
        "[diarize] pyannote Space call failed, falling back to text heuristic:",
        err.message
      );
    }
  }

  try {
    return await diarizeWithGroqHeuristic(captions);
  } catch (err) {
    // Best-effort feature — never let a diarization hiccup break caption
    // generation itself. Fall back to "everyone is SPEAKER_1", same as a
    // genuinely single-speaker video would resolve to anyway.
    console.warn("[diarize] Speaker labeling failed, defaulting to a single speaker:", err.message);
    return {
      captions: captions.map((c) => ({ ...c, speaker: "SPEAKER_1" })),
      speakerCount: 1,
    };
  }
};