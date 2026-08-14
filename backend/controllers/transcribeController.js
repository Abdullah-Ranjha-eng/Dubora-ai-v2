import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import Video from "../models/video.js";
import Caption from "../models/caption.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import { transcribeAudioFile } from "../utils/whisper.js";
import { ownerFields, isOwner } from "../utils/ownership.js";
import { castMissingSpeakers } from "../utils/elevenlabs.js";

// ── Transcribe from client-extracted audio => POST /api/v1/videos/:videoId/captions/from-audio ──
//
// The frontend extracts a small audio track from the video in the browser
// (ffmpeg.wasm) the instant the file is picked — before/while the much
// larger video is still uploading to Cloudinary. This endpoint transcribes
// that audio directly, skipping the "download the source video, then
// ffmpeg-extract audio" steps that generateCaptions needs, since the caller
// already did the equivalent work client-side. This is what lets captions.
// finish before the video upload does.
export const transcribeFromAudio = catchAsyncErrors(async (req, res, next) => {
  const video = await Video.findById(req.params.videoId);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  if (!req.file) return next(new ErrorHandler("Please provide an audio file.", 400));

  const tmpAudio = path.join(os.tmpdir(), `${video._id}_${randomUUID()}.mp3`);
  fs.writeFileSync(tmpAudio, req.file.buffer);

  let captions, language, speakerCount;
  try {
    ({ captions, language, speakerCount } = await transcribeAudioFile(tmpAudio));
  } finally {
    fs.unlink(tmpAudio, () => {});
  }

  if (captions.length === 0)
    return next(new ErrorHandler("Could not generate captions. Try a clearer audio.", 400));

  // Same upsert shape as generateCaptions, so a manual "Generate Captions"
  // click later (e.g. if this background pass failed) behaves identically —
  // including casting a distinct voice per diarized speaker immediately
  // (see castMissingSpeakers in generateCaptions for why).
  const speakers = [...new Set(captions.map((c) => c.speaker || "SPEAKER_1"))];

  let captionDoc = await Caption.findOne({ video: video._id, ...ownerFields(req) });
  if (captionDoc) {
    captionDoc.captions = captions;
    captionDoc.language = language;
    captionDoc.speakerVoices = castMissingSpeakers(captionDoc.speakerVoices, speakers);
    await captionDoc.save();
  } else {
    captionDoc = await Caption.create({
      video: video._id,
      ...ownerFields(req),
      language,
      captions,
      speakerVoices: castMissingSpeakers([], speakers),
    });
  }

  // The video file itself may still be mid-upload at this point (that's
  // the whole point) — finalizeVideo checks for an existing Caption doc
  // and won't regress this back to "uploaded" once that lands.
  video.detectedLanguage = language;
  video.speakerCount = speakerCount;
  video.status = "captioned";
  await video.save();

  res.status(200).json({ success: true, captions: captionDoc });
});