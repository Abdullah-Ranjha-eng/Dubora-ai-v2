import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// The ffmpeg.wasm core (~25-30MB) is loaded once per tab and cached here —
// not once per upload. Call preloadFfmpeg() as early as possible (e.g. when
// the upload page mounts, before the user has even picked a file) so this
// download is already in flight or finished by the time they hit upload,
// instead of adding its full latency on top of the extraction itself.
let ffmpegPromise = null;

export const preloadFfmpeg = () => {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load();
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
};

const getFfmpeg = () => preloadFfmpeg();

// Extracts the audio track from a video File, entirely in the browser.
// Tries a fast "stream copy" first — this just repackages the existing
// audio codec (almost always AAC for mp4/mov) into an .m4a container
// with NO re-encoding, which is dramatically faster than transcoding.
// Falls back to a real mp3 re-encode only if that fails (e.g. an unusual
// source codec Groq's Whisper endpoint won't accept directly).
export const extractAudioInBrowser = async (file) => {
  const ffmpeg = await getFfmpeg();
  const ext = file.name.match(/\.\w+$/)?.[0] || ".mp4";
  const inputName = "input" + ext;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const cleanup = async (...names) => {
    for (const n of names) await ffmpeg.deleteFile(n).catch(() => {});
  };

  try {
    // Fast path: no re-encoding, just extract the existing audio stream.
    await ffmpeg.exec(["-i", inputName, "-vn", "-acodec", "copy", "audio.m4a"]);
    const data = await ffmpeg.readFile("audio.m4a");
    await cleanup(inputName, "audio.m4a");
    return new Blob([data.buffer], { type: "audio/mp4" });
  } catch {
    // Slow path fallback: re-encode to mp3. Only hit for source codecs
    // that don't support a plain container copy.
    await ffmpeg.exec([
      "-i", inputName,
      "-vn",
      "-acodec", "libmp3lame",
      "-b:a", "64k",
      "audio.mp3",
    ]);
    const data = await ffmpeg.readFile("audio.mp3");
    await cleanup(inputName, "audio.mp3");
    return new Blob([data.buffer], { type: "audio/mp3" });
  }
};
