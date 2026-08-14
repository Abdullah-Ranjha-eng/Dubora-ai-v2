import Caption from "../models/caption.js";
import Video from "../models/video.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { transcribeAudioFile } from "../utils/whisper.js";
import { ownerFields, isOwner } from "../utils/ownership.js";
import { getLocalOriginalPath } from "../utils/videoSource.js";
import { castMissingSpeakers } from "../utils/elevenlabs.js";


ffmpeg.setFfmpegPath(ffmpegPath);

// Helper: build .srt content from captions array
const toSRT = (captions) => {
  const pad = (n) => String(Math.floor(n)).padStart(2, "0");
  const toTimecode = (secs) => {
    const h = pad(secs / 3600);
    const m = pad((secs % 3600) / 60);
    const s = pad(secs % 60);
    const ms = String(Math.round((secs % 1) * 1000)).padStart(3, "0");
    return `${h}:${m}:${s},${ms}`;
  };
  return captions
    .map((c, i) => `${i + 1}\n${toTimecode(c.start)} --> ${toTimecode(c.end)}\n${c.text}`)
    .join("\n\n");
};

// ── Generate captions => POST /api/v1/videos/:videoId/captions ───────────
export const generateCaptions = catchAsyncErrors(async (req, res, next) => {
  const video = await Video.findById(req.params.videoId);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  // Get the source video — reuses the local file from upload when possible
  // (skips the Cloudinary download entirely, which is the slow part).
  const { filePath: sourceVideo, isTemp } = await getLocalOriginalPath(video);
  const tmpAudio = path.join(os.tmpdir(), `${video._id}_${Date.now()}.mp3`);

  // Extract audio using FFmpeg (much smaller than video)
  await new Promise((resolve, reject) => {
    ffmpeg(sourceVideo)
      .output(tmpAudio)
      .audioCodec("libmp3lame")
      .audioBitrate("192k")      // see accuracy notes: 64k measurably hurt
                                 // both diarization AND word-level Whisper
                                 // detection on higher-quality sources
      .noVideo()                 // strip video, audio only
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  // Check audio file size
  const audioStats = fs.statSync(tmpAudio);
  const audioSizeMB = audioStats.size / (1024 * 1024);
  console.log(`Audio extracted: ${audioSizeMB.toFixed(2)} MB`);

  // Transcribe with Groq Whisper. We ask for word-level timestamps too:
  // Whisper's segment.start often includes leading silence before the
  // speaker actually starts talking (especially after a pause), which makes
  // captions appear too early. Word timestamps let us tighten each caption
  // to when speech genuinely begins. (Shared with the audio-first flow in
  // transcribeController.js so both paths behave identically.)
  let captions, language, speakerCount;
  try {
    ({ captions, language, speakerCount } = await transcribeAudioFile(tmpAudio));
  } finally {
    // Only clean up the source video if it was a temp download — the local
    // upload copy is reused by later steps (translate/burn), so keep it.
    if (isTemp) fs.unlink(sourceVideo, () => {});
    fs.unlink(tmpAudio, () => {});
  }

  if (captions.length === 0)
    return next(new ErrorHandler("Could not generate captions. Try a clearer audio.", 400));

  // Cast a voice for every speaker diarization found (pyannote HF Space,
  // falling back to the Groq text heuristic — see utils/diarize.js) right
  // away, so the caption editor's per-speaker voice picker shows a distinct
  // (alternating male/female) voice per speaker immediately instead of
  // defaulting every speaker to the same one until the user visits Dub.
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

  video.status = "captioned";
  video.detectedLanguage = language;
  video.speakerCount = speakerCount;
  await video.save();

  res.status(200).json({ success: true, captions: captionDoc });
});

// ── Get captions => GET /api/v1/videos/:videoId/captions ─────────────────
export const getVideoCaptions = catchAsyncErrors(async (req, res, next) => {
  const captionDoc = await Caption.findOne({
    video: req.params.videoId,
    ...ownerFields(req),
  });
  if (!captionDoc) return next(new ErrorHandler("Captions not found.", 404));
  res.status(200).json({ success: true, captions: captionDoc });
});

// ── Update captions => PUT /api/v1/videos/:videoId/captions ──────────────
export const updateCaptions = catchAsyncErrors(async (req, res, next) => {
  const { captions } = req.body;
  if (!captions || !Array.isArray(captions))
    return next(new ErrorHandler("Please provide captions array.", 400));

  const captionDoc = await Caption.findOne({
    video: req.params.videoId,
    ...ownerFields(req),
  });
  if (!captionDoc) return next(new ErrorHandler("Captions not found.", 404));

  captionDoc.captions = captions;
  await captionDoc.save();
  res.status(200).json({ success: true, captions: captionDoc });
});

// ── Delete captions => DELETE /api/v1/videos/:videoId/captions ───────────
export const deleteCaptions = catchAsyncErrors(async (req, res, next) => {
  const captionDoc = await Caption.findOneAndDelete({
    video: req.params.videoId,
    ...ownerFields(req),
  });
  if (!captionDoc) return next(new ErrorHandler("Captions not found.", 404));
  res.status(200).json({ success: true, message: "Captions deleted." });
});

// ── Download captions => GET /api/v1/videos/:videoId/captions/download ────
// Query params: ?format=srt (default) or ?format=txt
//               ?language=Arabic (optional, defaults to original)
export const downloadCaptions = catchAsyncErrors(async (req, res, next) => {
  const { format = "srt", language } = req.query;

  if (!["srt", "txt"].includes(format))
    return next(new ErrorHandler("Invalid format. Use 'srt' or 'txt'.", 400));

  const video = await Video.findById(req.params.videoId);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  const query = { video: video._id, ...ownerFields(req) };
  if (language) query.language = language;

  const captionDoc = await Caption.findOne(query);
  if (!captionDoc)
    return next(new ErrorHandler("Captions not found.", 404));

  if (captionDoc.captions.length === 0)
    return next(new ErrorHandler("Captions are empty.", 400));

  const safeTitle = video.title.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const langSuffix = language ? `_${language}` : "";

  if (format === "srt") {
    const content = toSRT(captionDoc.captions);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeTitle}${langSuffix}.srt"`
    );
    return res.send(content);
  }

  // format === "txt"
  const content = captionDoc.captions.map((c) => c.text).join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeTitle}${langSuffix}.txt"`
  );
  return res.send(content);
});