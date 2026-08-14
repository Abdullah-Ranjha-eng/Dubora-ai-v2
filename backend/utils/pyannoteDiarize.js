import { Client } from "@gradio/client";

// ── Real audio-based diarization via the pyannote HF Space ─────────────────
// This calls out to https://huggingface.co/spaces/<HF_SPACE_ID>, which runs
// pyannote/speaker-diarization-community-1 on the raw waveform (voice
// embeddings/clustering) — genuine acoustic diarization, unlike the
// text-heuristic fallback in diarize.js.
//
// Env vars used (add to config.env):
//   HF_SPACE_ID   e.g. "anbdullah128364/dubora-speaker-diarization"
//   HF_TOKEN      only required if the Space is private/gated

const SPACE_ID = process.env.HF_SPACE_ID || "anbdullah128364/dubora-speaker-diarization";

let clientPromise;
const getClient = () => {
  if (!clientPromise) {
    clientPromise = Client.connect(SPACE_ID, {
      hf_token: process.env.HF_TOKEN || undefined,
    }).catch((err) => {
      // don't cache a rejected connection attempt
      clientPromise = undefined;
      throw err;
    });
  }
  return clientPromise;
};

/**
 * Runs real audio-based diarization via the pyannote HF Space.
 *
 * @param {Buffer|Blob} audioFile - raw audio bytes (wav/mp3/etc)
 * @param {number} [numSpeakers=0] - 0 (or omitted) lets the model auto-detect.
 *   Note: the Space's generated API schema marks this "Required" even though
 *   the underlying Python only honors it when > 0 — always pass 0 rather
 *   than null/undefined to satisfy that schema safely.
 * @param {{minSpeakers?: number, maxSpeakers?: number}} [bounds] - optional
 *   range hint used only when numSpeakers is 0/unknown. Narrows pyannote's
 *   clustering search space instead of leaving it fully unconstrained,
 *   which measurably improves accuracy when an exact count isn't known.
 *   Ignored by the Space whenever numSpeakers is a positive exact count.
 * @returns {Promise<Array<{start:number, end:number, speaker:string}>>}
 */
export const pyannoteDiarize = async (audioFile, numSpeakers = 0, bounds = {}) => {
  const client = await getClient();

  // The Gradio JS client's file inputs need a Blob/File, not a raw Node
  // Buffer — a bare Buffer gets serialized as generic JSON instead of being
  // recognized as a file upload, so the Space receives no audio at all.
  // Node 18+ has a global Blob, so this doesn't need an extra dependency.
  const audioBlob = Buffer.isBuffer(audioFile)
    ? new Blob([audioFile], { type: "audio/mpeg" })
    : audioFile;

  const result = await client.predict("/diarize", {
    audio_file: audioBlob,
    num_speakers: numSpeakers,
    min_speakers: bounds.minSpeakers ?? null,
    max_speakers: bounds.maxSpeakers ?? null,
  });

  // With app.py now returning gr.JSON, result.data[0] is already the
  // segment array: [{ start, end, speaker }, ...]
  const segments = result.data[0];

  if (!Array.isArray(segments)) {
    throw new Error("pyannoteDiarize: unexpected response shape from Space");
  }

  return segments;
};