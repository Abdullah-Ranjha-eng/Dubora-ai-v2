import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import cloudinary from "cloudinary";
import Video from "../models/video.js";
import Caption from "../models/caption.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import { safeUnlink } from "../utils/localStorage.js";
import { getLocalOriginalPath } from "../utils/videoSource.js";
import { ownerFields, isOwner } from "../utils/ownership.js";
import { listVoices, castMissingSpeakers, synthesizeSpeech } from "../utils/elevenlabs.js";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

// ── List voices => GET /api/v1/voices ─────────────────────────────────────
// Powers the speaker → voice picker on VideoView.vue. No auth requirement —
// it's just a catalog, not user data.
export const getVoices = catchAsyncErrors(async (req, res) => {
  const voices = await listVoices();
  res.status(200).json({ success: true, voices });
});

// ── Cast speakers => PUT /api/v1/videos/:videoId/captions/speakers ────────
// Body: { language, speakerVoices: [{ speaker, voiceId, name }] }
// `language` selects which caption doc (original or a translated one) this
// casting applies to — see the comment on Caption.speakerVoices for why
// casting is per-language rather than per-video.
export const setSpeakerVoices = catchAsyncErrors(async (req, res, next) => {
  const { language, speakerVoices } = req.body;
  if (!language) return next(new ErrorHandler("Please provide a language.", 400));
  if (!Array.isArray(speakerVoices))
    return next(new ErrorHandler("Please provide a speakerVoices array.", 400));

  const captionDoc = await Caption.findOne({
    video: req.params.videoId,
    language,
    ...ownerFields(req),
  });
  if (!captionDoc) return next(new ErrorHandler("Captions not found for that language.", 404));

  captionDoc.speakerVoices = speakerVoices;
  await captionDoc.save();

  res.status(200).json({ success: true, captions: captionDoc });
});

// atempo only sounds natural roughly in this range — beyond it we'd need to
// chain multiple atempo filters, which isn't worth the quality trade-off
// for dubbing (a line running that far over its slot should really just be
// re-recorded/re-timed, not squeezed 3x).
const MAX_TEMPO = 1.6;
const MIN_SLOT_SECONDS = 0.4;

const probeDuration = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration || 0);
    });
  });

// ── Dub video => POST /api/v1/videos/:videoId/dub ─────────────────────────
// Body: { language } — which caption doc to dub (defaults to the video's
// originally-detected language, i.e. dub without translating).
export const dubVideo = catchAsyncErrors(async (req, res, next) => {
  const video = await Video.findById(req.params.videoId);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  const language = req.body.language || video.detectedLanguage || "en";
  const captionDoc = await Caption.findOne({ video: video._id, language, ...ownerFields(req) });
  if (!captionDoc)
    return next(new ErrorHandler("No captions found for that language. Generate or translate captions first.", 404));
  if (captionDoc.captions.length === 0)
    return next(new ErrorHandler("Captions are empty.", 400));

  // Auto-cast any speaker that isn't already assigned a voice, so dubbing
  // never hard-blocks on the user visiting the voice picker first — they
  // can always re-cast and re-dub afterward via setSpeakerVoices above.
  const speakers = [...new Set(captionDoc.captions.map((c) => c.speaker || "SPEAKER_1"))];
  captionDoc.speakerVoices = castMissingSpeakers(captionDoc.speakerVoices, speakers);
  await captionDoc.save();

  // Used by the synthesis loop below to look up each caption line's cast
  // voice by speaker label.
  const castMap = new Map(captionDoc.speakerVoices.map((sv) => [sv.speaker, sv]));

  video.status = "dubbing";
  await video.save();

  const tmpDir = os.tmpdir();
  const jobId = randomUUID();
  const clipPaths = [];

  try {
    // 1. Synthesize one TTS clip per caption line, in the assigned voice.
    const captions = captionDoc.captions;
    for (let i = 0; i < captions.length; i++) {
      const cap = captions[i];
      const voice = castMap.get(cap.speaker || "SPEAKER_1");
      const audioBuffer = await synthesizeSpeech(cap.text, voice.voiceId);
      const clipPath = path.join(tmpDir, `${jobId}_${i}.mp3`);
      fs.writeFileSync(clipPath, audioBuffer);
      clipPaths.push(clipPath);
    }

    // 2. Measure each clip and work out how much it needs to be sped up (if
    // at all) to fit the gap before the next line starts, so dialogue
    // doesn't run over itself. See MAX_TEMPO for why we cap this rather
    // than squeezing arbitrarily hard.
    const { filePath: sourceVideo, isTemp: sourceIsTemp } = await getLocalOriginalPath(video);
    const sourceDuration = video.duration || (await probeDuration(sourceVideo));

    const tempoRates = [];
    for (let i = 0; i < captions.length; i++) {
      const clipDuration = await probeDuration(clipPaths[i]);
      const nextStart = i < captions.length - 1 ? captions[i + 1].start : sourceDuration;
      const slot = Math.max(nextStart - captions[i].start, MIN_SLOT_SECONDS);
      const rate = clipDuration > slot ? Math.min(MAX_TEMPO, clipDuration / slot) : 1;
      tempoRates.push(rate);
    }

    // 3. Mix all clips into one audio track, each delayed to start at its
    // caption's timestamp. `normalize=0` keeps each clip at its natural
    // volume — amix's default normalization would quietly turn every line
    // down as more inputs are added, which sounds wrong for dialogue that
    // rarely actually overlaps.
    const mixedAudioPath = path.join(tmpDir, `${jobId}_mixed.mp3`);
    await new Promise((resolve, reject) => {
      const command = ffmpeg();
      clipPaths.forEach((p) => command.input(p));

      const filters = clipPaths.map((_, i) => {
        const delayMs = Math.round(captions[i].start * 1000);
        const rate = tempoRates[i];
        const tempoPart = rate !== 1 ? `atempo=${rate.toFixed(3)},` : "";
        return `[${i}:a]${tempoPart}adelay=${delayMs}|${delayMs}[a${i}]`;
      });
      const mixInputs = clipPaths.map((_, i) => `[a${i}]`).join("");
      filters.push(`${mixInputs}amix=inputs=${clipPaths.length}:duration=longest:normalize=0[aout]`);

      command
        .complexFilter(filters, "aout")
        .outputOptions("-ac", "2")
        .audioCodec("libmp3lame")
        .output(mixedAudioPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // 4. Mux: keep the original video stream untouched (-c:v copy, so this
    // step is fast and lossless) and replace the audio stream entirely
    // with the dubbed mix.
    const outputPath = path.join(tmpDir, `${jobId}_dubbed.mp4`);
    await new Promise((resolve, reject) => {
      ffmpeg(sourceVideo)
        .input(mixedAudioPath)
        .outputOptions("-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac")
        .output(outputPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    if (sourceIsTemp) safeUnlink(sourceVideo);
    safeUnlink(mixedAudioPath);
    clipPaths.forEach(safeUnlink);

    // 5. Upload before responding — same reasoning as burnCaptions in
    // captionController.js: Vercel can freeze the function right after the
    // response is sent, so a "fire and forget" background upload here
    // could easily never finish.
    const previousDubbedPublicId = video.dubbedVideo?.public_id || null;
    const uploadResult = await cloudinary.v2.uploader.upload(outputPath, {
      resource_type: "video",
      folder: "dubora-ai/dubbed",
      chunk_size: 6000000,
      timeout: 180000,
    });
    safeUnlink(outputPath);

    video.dubbedVideo = {
      public_id: uploadResult.public_id,
      url: uploadResult.secure_url,
      cloudStatus: "done",
    };
    video.status = "dubbed";
    await video.save();

    res.status(200).json({
      success: true,
      message: "Video dubbed successfully.",
      dubbedVideo: video.dubbedVideo,
      speakerVoices: captionDoc.speakerVoices,
    });

    if (previousDubbedPublicId) {
      cloudinary.v2.uploader
        .destroy(previousDubbedPublicId, { resource_type: "video" })
        .catch(() => {});
    }
  } catch (err) {
    clipPaths.forEach(safeUnlink);
    video.status = "translated"; // roll back to the last good state
    await video.save().catch(() => {});
    return next(new ErrorHandler(`Dubbing failed: ${err.message}`, 500));
  }
});