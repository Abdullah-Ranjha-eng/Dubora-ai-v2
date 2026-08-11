import express from "express";
import { getVoices, setSpeakerVoices, dubVideo } from "../controllers/dubController.js";
import { identifyUser } from "../middlewares/auth.js";

const router = express.Router();

router.route("/voices").get(getVoices);
router.route("/videos/:videoId/captions/speakers").put(identifyUser, setSpeakerVoices);
router.route("/videos/:videoId/dub").post(identifyUser, dubVideo);

export default router;
