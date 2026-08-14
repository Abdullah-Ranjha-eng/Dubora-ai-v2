import fs from "fs";
import Groq from "groq-sdk";
import { diarizeSegments } from "./diarize.js";

const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });

// A little breathing room before the first word so the caption doesn't pop
// in at the exact frame speech starts.
const LEAD_IN_SECONDS = 0.12;

// Caption-splitting thresholds for rebuilding captions from the word
// timeline (see buildCaptionsFromWords below).
const SPLIT_GAP_SECONDS = 0.6; // silence longer than this = new caption
const MAX_CAPTION_SECONDS = 7; // don't let one caption run too long
const MAX_CAPTION_WORDS = 16; // ...or get too wordy to read comfortably

// Builds captions directly from Groq's word-level timestamps instead of
// trusting Whisper's own `segments` array verbatim.
//
// Why: `segments` are Whisper's own coarse batch-decoding boundaries, not a
// sentence/dialogue-turn boundary. On fast back-and-forth dialogue (short
// quick replies with little silence between speakers — exactly what real
// conversation looks like, and exactly what the pyannote diarization Space
// correctly detects as many rapid speaker turns), Whisper's segment-level
// decoder regularly merges or entirely drops short lines when constructing
// `segments[].text`, even though the underlying word-level forced-alignment
// pass (`words`) still has every word with a timestamp. That's why caption
// count could end up far lower than the real number of spoken lines/turns:
// entire short utterances were vanishing inside `segments`, never absent
// from `words`.
//
// Grouping the (complete) word timeline ourselves — starting a new caption
// whenever there's a real silence gap, an overly long caption, or too many
// words — guarantees every transcribed word lands in some caption. This is
// the same approach standard subtitle generators use, for the same reason.
const buildCaptionsFromWords = (words) => {
  const captions = [];
  let current = [];

  const flush = () => {
    if (!current.length) return;
    const first = current[0];
    const last = current[current.length - 1];
    captions.push({
      start: Math.max(0, first.start - LEAD_IN_SECONDS),
      end: last.end,
      text: current.map((w) => w.word).join(" ").replace(/\s+/g, " ").trim(),
    });
    current = [];
  };

  for (const w of words) {
    if (current.length) {
      const prev = current[current.length - 1];
      const gap = w.start - prev.end;
      const duration = w.end - current[0].start;
      if (gap >= SPLIT_GAP_SECONDS || duration >= MAX_CAPTION_SECONDS || current.length >= MAX_CAPTION_WORDS) {
        flush();
      }
    }
    current.push(w);
  }
  flush();

  return captions.filter((c) => c.text.length > 0);
};

// Runs Groq Whisper on an audio file already sitting on disk and returns
// caption segments tightened to real word-start times.
export const transcribeAudioFile = async (audioPath) => {
  const transcription = await getGroq().audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-large-v3",
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
  });

  const words = transcription.words || [];

  // Word-level timeline is the source of truth when available (see
  // buildCaptionsFromWords for why) — only fall back to Whisper's own
  // coarser `segments` on the rare response that has no word timestamps
  // at all (e.g. a clip too short/quiet for forced alignment to run).
  const captions = words.length
    ? buildCaptionsFromWords(words)
    : transcription.segments.map((seg) => ({ start: seg.start, end: seg.end, text: seg.text.trim() })).filter((c) => c.text.length > 0);

  // Speaker labeling runs here (not left to the caller) so both call sites
  // — generateCaptions's video-download path and transcribeFromAudio's
  // client-extracted-audio path — get identically-diarized captions, same
  // reasoning as why timing-tightening already lived here.
  //
  // Pass the same audio we just transcribed through to diarizeSegments so it
  // can attempt REAL acoustic diarization via the pyannote HF Space first
  // (see utils/pyannoteDiarize.js) instead of falling straight to the
  // text-only Groq heuristic.
  const audioBuffer = fs.readFileSync(audioPath);
  const { captions: diarized, speakerCount } = await diarizeSegments(captions, audioBuffer);

  return { captions: diarized, language: transcription.language || "en", speakerCount };
};
