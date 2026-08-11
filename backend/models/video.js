import mongoose from "mongoose";

// cloudStatus tracks the async Cloudinary sync separately from the overall
// pipeline `status` below — the file is playable locally the moment it's
// "pending"/"uploading"; "done" just means Cloudinary now has its own copy.
const cloudAssetSchema = {
  public_id: String,
  url: String,              // local URL until Cloudinary upload finishes, then swapped
  localFilename: String,    // filename under backend/uploads/{videos,burned}
  cloudStatus: {
    type: String,
    enum: ["pending", "uploading", "done", "failed"],
    default: "pending",
  },
};

const videoSchema = new mongoose.Schema({
  // Owned by exactly one of these two — a registered user, or (if uploaded)
  // without an account) a guest identified by the guestId cookie set in
  // middlewares/auth.js's identifyUser. See utils/ownership.js
  user:       { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  guestId:    { type: String, default: null, index: true },
  title:      { type: String, required: true },
  originalVideo: cloudAssetSchema,
  burnedVideo:   cloudAssetSchema,
  // Final ElevenLabs-dubbed video (original video track + generated TTS
  // audio track muxed in place of the source audio). See dubController.js.
  dubbedVideo:   cloudAssetSchema,
  // Seconds, from Cloudinary's own upload response — finalizeVideo (see
  // videoController.js) already received this from the frontend, but the
  // field wasn't declared here in Transcripto AI, so Mongoose's default
  // strict-schema mode silently dropped it on save. Declaring it properly
  // now because dubController.js needs a real duration to size the last
  // speaker's audio slot and know how far past the final caption the
  // dubbed track should extend.
  duration: { type: Number, default: null },
  detectedLanguage: { type: String, default: null },
  // How many distinct speakers diarization found in this video's audio —
  // drives the speaker → voice picker on the frontend (VideoView.vue).
  speakerCount: { type: Number, default: 0 },
  status: {
    type: String,
    // "uploading": record exists but the video file is still in flight to
    // Cloudinary from the browser — captions can already be "captioned"
    // even while status is technically still catching up here, since audio
    // transcription runs independently and often finishes first.
    // "dubbed" is terminal, same tier as "burned" — a video can go on to
    // either or both independently once translated captions exist.
    enum: ["uploading", "uploaded", "processing", "captioned", "translated", "burned", "dubbing", "dubbed"],
    default: "uploading",
  },
}, { timestamps: true });

videoSchema.pre("validate", function () {
  if (!this.user && !this.guestId) {
    throw new Error("Video must belong to either a user or a guestId.");
  }
});

export default mongoose.model("Video", videoSchema);