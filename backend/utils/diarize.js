import Groq from "groq-sdk";

const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── "Who's speaking" ──────────────────────────────────────────────────────
// Groq Whisper (utils/whisper.js) gives us text + timestamps but NOT speaker
// identity — real diarization needs the raw audio waveform (voice
// embeddings/clustering), which is a separate, heavier model than Whisper
// itself and out of scope for a single Groq call. Instead we do a
// text-and-timing based best-effort pass, same JSON-in/JSON-out shape as
// translateController.js's Groq call:
//
//   1. Heuristic pre-pass: a long silence gap between two segments (no
//      speech at all in between) is a common — though not guaranteed —
//      signal that the floor changed hands, so we flag those boundaries as
//      hints for the model rather than deciding anything ourselves.
//   2. LLaMA reads the ordered transcript (with the hints) and assigns each
//      segment a SPEAKER_N label, using dialogue cues (question/answer
//      turn-taking, "I"/"you" pronoun switches, named address, etc).
//
// This is inherently approximate — it can't distinguish two people with
// truly identical speaking patterns, and can't hear that they're different
// voices. For clearly-alternating dialogue (interviews, conversations) it
// does well; for a single narrator it correctly collapses to one speaker.
const SILENCE_GAP_SECONDS = 1.2; // gap longer than this hints at a turn change
const MAX_SPEAKERS = 6; // keeps the voice-picker UI and TTS casting sane

export const diarizeSegments = async (captions) => {
  if (captions.length === 0) return { captions, speakerCount: 0 };

  // Single short clip — not worth spending a model call to (almost
  // certainly correctly) conclude "one speaker".
  if (captions.length === 1) {
    return { captions: [{ ...captions[0], speaker: "SPEAKER_1" }], speakerCount: 1 };
  }

  const hinted = captions.map((c, i) => {
    const prevEnd = i > 0 ? captions[i - 1].end : null;
    const gapBefore = prevEnd !== null ? +(c.start - prevEnd).toFixed(2) : null;
    return {
      i,
      text: c.text,
      likelyTurnChange: gapBefore !== null && gapBefore >= SILENCE_GAP_SECONDS,
    };
  });

  try {
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
