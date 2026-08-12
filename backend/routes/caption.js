import express from "express";
import multer from "multer";
import {
  generateCaptions,
  getVideoCaptions,
  updateCaptions,
  deleteCaptions,
  downloadCaptions,
} from "../controllers/captionController.js";
import { transcribeFromAudio } from "../controllers/transcribeController.js";
import { identifyUser } from "../middlewares/auth.js";

// Audio only, in memory. These are extracted client-side (ffmpeg.wasm) from
// the video before/while the video itself uploads elsewhere, so they're
// small — nowhere near the size of the source video.
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB, generous for an mp3 of any reasonable video length
});

const router = express.Router();

router.route("/videos/:videoId/captions").post(identifyUser, generateCaptions);
router.route("/videos/:videoId/captions").get(identifyUser, getVideoCaptions);
router.route("/videos/:videoId/captions").put(identifyUser, updateCaptions);
router.route("/videos/:videoId/captions").delete(identifyUser, deleteCaptions);
router.route("/videos/:videoId/captions/download").get(identifyUser, downloadCaptions);
router.route("/videos/:videoId/captions/from-audio").post(identifyUser, uploadAudio.single("audio"), transcribeFromAudio);

export default router;