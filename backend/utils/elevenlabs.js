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

// Synthesizes one line of dialogue and returns raw MP3 bytes. eleven_multilingual_v2
// is the model used (not the default eleven_monolingual_v1) specifically
// because dubbing targets all 12+ of this app's supported languages, most
// of which the monolingual (English-only) model can't speak correctly.
export const synthesizeSpeech = async (text, voiceId) => {
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
};
