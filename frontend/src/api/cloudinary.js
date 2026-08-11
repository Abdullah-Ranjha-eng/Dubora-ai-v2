import axios from "axios";

// Plain axios — NOT the app's `api` client (src/api/axios.js). This goes
// straight to Cloudinary, so it must not carry our auth cookie or use our
// backend's baseURL/withCredentials config.

// Cloudinary rejects any single-request upload over 100MB regardless of
// account plan — files above that size MUST use chunked upload (multiple
// requests sharing an X-Unique-Upload-Id, each describing its byte range
// via Content-Range). Kept a little under the real 100MB ceiling as margin.
// Note this does NOT bypass your Cloudinary plan's overall video size cap
// (100MB on the free plan, 300MB on self-service, 2GB on Plus) — it only
// avoids the single-request limit, so a file above your plan's real cap
// will still fail even chunked.
const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB — Cloudinary's own recommended default

export const uploadVideoToCloudinary = async (file, sig, onProgress) => {
  if (file.size <= CHUNK_SIZE) {
    return uploadSingleRequest(file, sig, onProgress);
  }
  return uploadChunked(file, sig, onProgress);
};

const buildForm = (filePart, sig) => {
  const form = new FormData();
  form.append("file", filePart);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", sig.timestamp);
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  return form;
};

const uploadSingleRequest = async (file, sig, onProgress) => {
  const { data } = await axios.post(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`,
    buildForm(file, sig),
    {
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }
  );

  return data; // { public_id, secure_url, duration, ... }
};

// Cloudinary's chunked upload: same endpoint, but the file is sliced into
// pieces and each piece is POSTed as its own request. All requests for one
// file share the same X-Unique-Upload-Id; each one's Content-Range tells
// Cloudinary which bytes it's receiving and the total file size. Only the
// response from the LAST chunk contains the finished asset's public_id/
// secure_url/duration — earlier ones just acknowledge partial receipt.
const uploadChunked = async (file, sig, onProgress) => {
  const uploadId = `transcripto-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  let uploadedBytes = 0;
  let finalData = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const chunkSize = end - start;

    const { data } = await axios.post(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`,
      buildForm(chunk, sig),
      {
        headers: {
          "X-Unique-Upload-Id": uploadId,
          "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
        },
        onUploadProgress: (e) => {
          if (!onProgress || !e.total) return;
          const doneSoFar = uploadedBytes + Math.min(e.loaded, chunkSize);
          onProgress(Math.round((doneSoFar / file.size) * 100));
        },
      }
    );

    uploadedBytes = end;
    finalData = data;
  }

  return finalData; // the last chunk's response is the completed asset
};
