import fs from "fs";
import Groq from "groq-sdk";
import { diarizeSegments } from "./diarize.js";

const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });

// A little breathing room before the first word so the caption doesn't pop
// in at the exact frame speech starts — but never earlier than Whisper's
// own segment boundary. (Moved here from captionController so the
// audio-first flow in transcribeController gets identical timing behavior.)
const LEAD_IN_SECONDS = 0.12;

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
  let wordIdx = 0;

  const captions = transcription.segments
    .map((seg, i) => {
      const nextSegStart = transcription.segments[i + 1]?.start ?? Infinity;
      const segWords = [];
      while (wordIdx < words.length && words[wordIdx].start < nextSegStart) {
        segWords.push(words[wordIdx]);
        wordIdx++;
      }

      const firstWordStart = segWords.length ? segWords[0].start : seg.start;
      const start = Math.max(seg.start, firstWordStart - LEAD_IN_SECONDS);

      return { start, end: seg.end, text: seg.text.trim() };
    })
    // Groq Whisper regularly emits empty-text segments on longer audio —
    // silence, background music, or ambient noise between sentences. The
    // Caption model requires non-empty `text` on every entry (Mongoose's
    // required validator rejects "" same as null/undefined), so saving
    // these as-is throws "Path `text` is required." — one error per empty
    // segment. Word-index tracking above still needs to consume the right
    // words per segment regardless, so filter AFTER the map, not before.
    .filter((c) => c.text.length > 0);

  // Speaker labeling runs here (not left to the caller) so both call sites
  // — generateCaptions's video-download path and transcribeFromAudio's
  // client-extracted-audio path — get identically-diarized captions, same
  // reasoning as why timing-tightening already lived here.
  const { captions: diarized, speakerCount } = await diarizeSegments(captions);

  return { captions: diarized, language: transcription.language || "en", speakerCount };
};
