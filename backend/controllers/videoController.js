import Video from "../models/video.js";
import Caption from "../models/caption.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import cloudinary from "cloudinary";
import { safeUnlink, localPathFor, VIDEOS_DIR, BURNED_DIR } from "../utils/localStorage.js";
import { ownerFields, isOwner } from "../utils/ownership.js";

// ── Create a placeholder record => POST /api/v1/videos/init ──────────────
// Returns a real _id immediately, before a single byte of the video has
// left the browser, so the frontend can navigate straight to the video
// page and start both the Cloudinary upload and the parallel client-side
// audio transcription right away, instead of blocking on either.
export const initVideo = catchAsyncErrors(async (req, res, next) => {
  const { title } = req.body;
  if (!title) return next(new ErrorHandler("Please provide a title.", 400));

  const video = await Video.create({
    ...ownerFields(req),
    title,
    originalVideo: { cloudStatus: "pending" },
    status: "uploading",
  });

  res.status(201).json({ success: true, video });
});

// ── Signed upload params => GET /api/v1/videos/sign-upload ───────────────
// Lets the browser upload the video file directly to Cloudinary, bypassing
// our server (and Vercel's ~4.5MB request body cap) entirely. Only the
// exact params signed here are valid for the upload the client makes —
// Cloudinary rejects anything that doesn't match.
export const getUploadSignature = catchAsyncErrors(async (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = "transcripto-ai/videos";

  const signature = cloudinary.v2.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );

  res.status(200).json({
    success: true,
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
});

// ── Attach the finished Cloudinary asset => PUT /api/v1/videos/:id/finalize ──
// Called by the frontend once its direct-to-Cloudinary upload resolves.
export const finalizeVideo = catchAsyncErrors(async (req, res, next) => {
  const { public_id, url, duration } = req.body;
  if (!public_id || !url)
    return next(new ErrorHandler("Missing public_id/url.", 400));

  const video = await Video.findById(req.params.id);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  video.originalVideo = { public_id, url, cloudStatus: "done" };
  if (typeof duration === "number") video.duration = duration;

  // Defensive: don't downgrade the status badge back to "uploaded" if
  // captions already exist for this video by the time upload finishes
  // (e.g. generated on a previous attempt). In the current flow captions
  // never start before upload completes (see stores/video.js's startUpload
  // on the frontend), so this is normally a no-op — kept as a safety net
  // rather than assuming that'll always hold.
  const hasCaptions = await Caption.exists({ video: video._id, ...ownerFields(req) });
  video.status = hasCaptions ? "captioned" : "uploaded";
  await video.save();

  res.status(200).json({ success: true, video });
});

// Get all videos for current user => GET /api/v1/videos.
export const getUserVideos = catchAsyncErrors(async (req, res) => {
  const videos = await Video.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: videos.length, videos });
});

// Get single video => GET /api/v1/videos/:id
export const getVideo = catchAsyncErrors(async (req, res, next) => {
  const video = await Video.findById(req.params.id);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized to view this video.", 403));

  res.status(200).json({ success: true, video });
});

// Delete video => DELETE /api/v1/videos/:id
export const deleteVideo = catchAsyncErrors(async (req, res, next) => {
  const video = await Video.findById(req.params.id);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized to delete this video.", 403));

  // Remove from Cloudinary
  if (video.originalVideo?.public_id)
    await cloudinary.v2.uploader.destroy(video.originalVideo.public_id, { resource_type: "video" });
  if (video.burnedVideo?.public_id)
    await cloudinary.v2.uploader.destroy(video.burnedVideo.public_id, { resource_type: "video" });
  if (video.dubbedVideo?.public_id)
    await cloudinary.v2.uploader.destroy(video.dubbedVideo.public_id, { resource_type: "video" });

  // Remove local copies, if any (only relevant for records created before
  // this fix, or when running locally where disk storage is still fine)
  if (video.originalVideo?.localFilename)
    safeUnlink(localPathFor(VIDEOS_DIR, video.originalVideo.localFilename));
  if (video.burnedVideo?.localFilename)
    safeUnlink(localPathFor(BURNED_DIR, video.burnedVideo.localFilename));

  await video.deleteOne();
  res.status(200).json({ success: true, message: "Video deleted." });
});