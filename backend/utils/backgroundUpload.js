import path from "path";
import cloudinary from "cloudinary";
import Video from "../models/video.js";

/**
 * Uploads a local file to Cloudinary WITHOUT blocking the caller.
 * Call this without `await` from a controller right after you've already
 * responded to the client with the local URL.
 *
 * @param {string} videoId   Video document _id
 * @param {"originalVideo"|"burnedVideo"} field  which sub-document to update
 * @param {string} localPath absolute path to the file on disk
 * @param {string} folder    Cloudinary folder to upload into
 */
export const syncToCloudinaryInBackground = async (videoId, field, localPath, folder) => {
  try {
    await Video.findByIdAndUpdate(videoId, { [`${field}.cloudStatus`]: "uploading" });

    const result = await cloudinary.v2.uploader.upload(localPath, {
      resource_type: "video",
      folder,
      chunk_size: 6000000, // 6MB per chunk, supports large files
      timeout: 180000,
    });

    // Someone may have re-burned/re-uploaded (and thus overwritten this field)
    // while this background job was running — only apply our result if the
    // doc still points at the same local file we just uploaded.
    const fresh = await Video.findById(videoId);
    if (!fresh || fresh[field]?.localFilename !== path.basename(localPath)) {
      return;
    }

    fresh[field].public_id = result.public_id;
    fresh[field].url = result.secure_url;
    fresh[field].cloudStatus = "done";
    await fresh.save();
  } catch (err) {
    console.error(`Background Cloudinary sync failed for ${field} on video ${videoId}:`, err.message);
    await Video.findByIdAndUpdate(videoId, { [`${field}.cloudStatus`]: "failed" }).catch(() => {});
  }
};
