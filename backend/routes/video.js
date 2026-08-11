import express from "express";
import {
  initVideo,
  getUploadSignature,
  finalizeVideo,
  getUserVideos,
  getVideo,
  deleteVideo,
} from "../controllers/videoController.js";
import { isAuthenticatedUser, identifyUser } from "../middlewares/auth.js";

// The video file itself no longer passes through this server at all — the
// browser uploads it straight to Cloudinary using the signed params from
// /videos/sign-upload, then calls /videos/:id/finalize with the result.
// See utils/whisper.js + controllers/transcribeController.js for the
// parallel audio-transcription side of this.
const router = express.Router();

// Dashboard listing stays registered-users-only — this is the one thing
// guests don't get. Every other route below uses identifyUser instead, so
// guests can upload/view/delete their own videos without an account.
router.route("/videos").get(isAuthenticatedUser, getUserVideos);
router.route("/videos/init").post(identifyUser, initVideo);
router.route("/videos/sign-upload").get(identifyUser, getUploadSignature);
router.route("/videos/:id/finalize").put(identifyUser, finalizeVideo);
router.route("/videos/:id").get(identifyUser, getVideo);
router.route("/videos/:id").delete(identifyUser, deleteVideo);

export default router;
