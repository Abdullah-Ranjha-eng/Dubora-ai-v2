import mongoose from "mongoose";

const captionSchema = new mongoose.Schema({
  video: { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true },
  // Same owner pattern as models/video.js — see utils/ownership.js.
  user:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  guestId:  { type: String, default: null, index: true },
  language: { type: String, default: "en" },
  captions: [
    {
      start:   { type: Number, required: true },  // seconds.
      end:     { type: Number, required: true },
      text:    { type: String, required: true },
      // "SPEAKER_1", "SPEAKER_2"... assigned by utils/diarize.js at
      // transcription time. Stable across translations of the same video
      // since translateController copies start/end/speaker through
      // unchanged and only swaps `text`.
      speaker: { type: String, default: "SPEAKER_1" },
    }
  ],
  // Per-speaker ElevenLabs voice choice for this caption doc's language,
  // e.g. [{ speaker: "SPEAKER_1", voiceId: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" }].
  // Lives on the caption doc (not the video) because voice casting is
  // naturally per-language — a video dubbed into French and Japanese may
  // reasonably use different voices for "SPEAKER_1" in each.
  speakerVoices: [
    {
      speaker: { type: String, required: true },
      voiceId: { type: String, required: true },
      name:    { type: String, default: "" },
    }
  ],
}, { timestamps: true });

captionSchema.pre("validate", function () {
  if (!this.user && !this.guestId) {
    throw new Error("Caption must belong to either a user or a guestId.");
  }
});

export default mongoose.model("Caption", captionSchema);