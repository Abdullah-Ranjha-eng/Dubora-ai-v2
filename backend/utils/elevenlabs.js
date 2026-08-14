import axios from "axios";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

const client = () =>
  axios.create({
    baseURL: ELEVEN_BASE,
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
  });

// Premade ElevenLabs voices, well outside any single account's custom
// library — used as (a) the auto-cast default when a video's speakers
// haven't been assigned voices yet, and (b) the picker's fallback list if
// GET /v1/voices fails (missing/invalid key, network hiccup, etc), so
// casting a video never hard-blocks on ElevenLabs account access.
export const DEFAULT_VOICES = [
  { voiceId: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female" },
  { voiceId: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male" },
  { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "female" },
  { voiceId: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", gender: "male" },
  { voiceId: "AZnzlk1XvdvUeBnXmlld", name: "Domi", gender: "female" },
  { voiceId: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "male" },
];

// GET /api/v1/voices (see routes/dub.js) — real account voices when we can
// reach ElevenLabs, otherwise the curated defaults above.
export const listVoices = async () => {
  if (!process.env.ELEVENLABS_API_KEY) return DEFAULT_VOICES;
  try {
    const { data } = await client().get("/voices");
    const voices = (data.voices || []).map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      gender: v.labels?.gender || "unknown",
    }));
    return voices.length ? voices : DEFAULT_VOICES;
  } catch (err) {
    console.warn("[elevenlabs] listVoices failed, using defaults:", err.message);
    return DEFAULT_VOICES;
  }
};

// Round-robins speakers across DEFAULT_VOICES so a freshly-diarized video
// has a playable (if not hand-picked) cast the moment captions exist,
// without waiting on the user to visit the voice picker first.
export const autoAssignVoices = (speakerLabels) =>
  speakerLabels.map((speaker, i) => ({
    speaker,
    voiceId: DEFAULT_VOICES[i % DEFAULT_VOICES.length].voiceId,
    name: DEFAULT_VOICES[i % DEFAULT_VOICES.length].name,
  }));

// Fills in a voice for any speaker in `speakerLabels` that isn't already
// cast in `existingSpeakerVoices`, preserving whatever's already assigned
// and only minting new casts for speakers that are actually missing.
// `speakerLabels` order (first-appearance order, from diarization) is what
// drives which DEFAULT_VOICES slot a newly-seen speaker gets, so distinct
// speakers alternate male/female (Adam, Rachel, Josh, Bella, ...) instead
// of every speaker silently defaulting to the same voice.
//
// Shared by captionController/transcribeController (cast immediately once
// real diarization — pyannote HF Space or the Groq heuristic — has told us
// how many distinct speakers there are, so the editor's per-speaker voice
// picker is never just "everyone is Male 1" by default) and dubController
// (last-resort safety net right before synthesis, for casts made before
// this existed or a speaker added manually after generation).
export const castMissingSpeakers = (existingSpeakerVoices, speakerLabels) => {
  const castMap = new Map((existingSpeakerVoices || []).map((sv) => [sv.speaker, sv]));
  const missing = speakerLabels.filter((sp) => !castMap.has(sp));
  if (missing.length) {
    for (const cast of autoAssignVoices(missing)) castMap.set(cast.speaker, cast);
  }
  return speakerLabels.map((sp) => castMap.get(sp)).filter(Boolean);
};

// Synthesizes one line of dialogue and returns raw MP3 bytes. eleven_multilingual_v2
// is the model used (not the default eleven_monolingual_v1) specifically
// because dubbing targets all 12+ of this app's supported languages, most
// of which the monolingual (English-only) model can't speak correctly.
export const synthesizeSpeech = async (text, voiceId) => {
  try {
    const { data } = await client().post(
      `/text-to-speech/${voiceId}`,
      {
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(data);
  } catch (err) {
    // Because responseType is "arraybuffer" (needed for the success case —
    // raw MP3 bytes), axios ALSO forces error response bodies into an
    // ArrayBuffer instead of parsing them as JSON, even though ElevenLabs
    // sends a normal JSON error body (e.g. {"detail":{"status":
    // "quota_exceeded", "message": "..."}}). Left alone, every failure here
    // surfaced only as a bare "Request failed with status code 402" with no
    // indication of WHY — decode and re-throw with the real reason instead.
    if (err.response?.data) {
      try {
        const decoded = JSON.parse(Buffer.from(err.response.data).toString("utf8"));
        const reason = decoded?.detail?.message || decoded?.detail?.status || JSON.stringify(decoded);
        throw new Error(`ElevenLabs ${err.response.status}: ${reason}`);
      } catch (parseErr) {
        // Body wasn't JSON (or decoding itself failed) — fall through to
        // the original error rather than hiding it behind a parse failure.
        if (parseErr.message?.startsWith("ElevenLabs ")) throw parseErr;
      }
    }
    throw err;
  }
};