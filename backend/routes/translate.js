import express from "express";
import { translateCaptions } from "../controllers/translateController.js";
import { identifyUser } from "../middlewares/auth.js";

const router = express.Router();

router.route("/videos/:videoId/translate").post(identifyUser, translateCaptions);

export default router;
