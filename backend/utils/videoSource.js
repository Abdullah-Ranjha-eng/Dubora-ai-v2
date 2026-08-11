import fs from "fs";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import axios from "axios";
import { localPathFor, VIDEOS_DIR } from "./localStorage.js";

const downloadVideo = async (url, destPath) => {
  const response = await axios({ url, responseType: "stream" });
  await pipeline(response.data, createWriteStream(destPath));
};

// Shared by captionController (generate/burn) and dubController — reuses
// the local disk copy multer/the upload flow left behind whenever it's
// still there, which skips a full re-download from Cloudinary and is the
// main thing keeping caption/dub generation fast. Falls back to
// downloading from Cloudinary if the local copy is gone (e.g. a
// cold-started serverless instance that never had it on its own disk).
export const getLocalOriginalPath = async (video) => {
  const localFile = video.originalVideo?.localFilename
    ? localPathFor(VIDEOS_DIR, video.originalVideo.localFilename)
    : null;

  if (localFile && fs.existsSync(localFile)) {
    return { filePath: localFile, isTemp: false };
  }

  const tmpVideo = path.join(os.tmpdir(), `${video._id}_${Date.now()}.mp4`);
  await downloadVideo(video.originalVideo.url, tmpVideo);
  return { filePath: tmpVideo, isTemp: true };
};
