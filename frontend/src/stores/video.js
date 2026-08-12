import { defineStore } from "pinia";
import { ref } from "vue";
import api from "../api/axios.js";
import { uploadVideoToCloudinary } from "../api/cloudinary.js";

export const useVideoStore = defineStore("video", () => {
  const videos = ref([]);
  const currentVideo = ref(null);
  const captions = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // ── Dubbing state ────────────────────────────────────────────
  // `voices` is the ElevenLabs catalog (or curated fallback — see
  // backend/utils/elevenlabs.js) used to populate the speaker → voice
  // picker. Fetched once and cached for the session; it's a shared
  // catalog, not per-video data.
  const voices = ref([]);
  const dubbing = ref(false);

  // ── Upload state ─────────────────────────────────────────────
  // Separate from `loading`/`error` above on purpose: those describe
  // request/response actions the user explicitly triggers (fetch, burn,
  // translate...). These describe the background video → Cloudinary
  // pipeline kicked off by startUpload, which runs independently of any
  // single request-response cycle and outlives the call that started it.
  const uploadProgress = ref(0);     // 0-100, video → Cloudinary
  const uploadFailed = ref(false);

  // ── Videos ────────────────────────────────────────────────────
  const fetchVideos = async () => {
    loading.value = true;
    try {
      const { data } = await api.get("/videos");
      videos.value = data.videos;
    } catch (err) {
      error.value = err.response?.data?.message || "Failed to load videos.";
    } finally {
      loading.value = false;
    }
  };

  // Same out-of-order-response concern as fetchCaptions below: shared by
  // fetchVideo and refreshVideoQuietly since both write to currentVideo and
  // can legitimately be in flight for different video ids in quick
  // succession (e.g. rapid dashboard navigation).
  let currentVideoRequestSeq = 0;

  const fetchVideo = async (id) => {
    loading.value = true;
    const seq = ++currentVideoRequestSeq;
    try {
      const { data } = await api.get(`/videos/${id}`);
      if (seq === currentVideoRequestSeq) currentVideo.value = data.video;
    } catch (err) {
      if (seq === currentVideoRequestSeq)
        error.value = err.response?.data?.message || "Failed to load video.";
    } finally {
      if (seq === currentVideoRequestSeq) loading.value = false;
    }
  };

  // Same as fetchVideo but never touches `loading` — used for background
  // polling (e.g. Cloudinary sync status) so it can't flicker-disable the
  // Generate/Translate/Burn buttons, which are keyed off `loading`.
  const refreshVideoQuietly = async (id) => {
    const seq = ++currentVideoRequestSeq;
    try {
      const { data } = await api.get(`/videos/${id}`);
      if (seq === currentVideoRequestSeq) currentVideo.value = data.video;
    } catch {
      // silent — this is a background poll, not a user-initiated action
    }
  };

  // Creates the video record immediately (no file transferred yet) and
  // returns it so the caller can navigate to the video page right away.
  // Kicks off runVideoUpload in the background (NOT awaited here) so the
  // caller doesn't block on the slow, network-bound video → Cloudinary
  // transfer. Deliberately does NOT start caption generation in parallel —
  // captions only ever start once the video is fully uploaded (gated by
  // videoReady in VideoView.vue), never racing ahead of it. An earlier
  // version extracted audio client-side and transcribed it in parallel with
  // the upload for speed, but that meant captions/translate/burn could
  // appear and be actioned before the underlying video was actually
  // playable — confusing at best, and a source of real ownership/timing
  // bugs at worst. Simpler and correct beats fast-but-surprising here.
  const startUpload = async (file, title) => {
    error.value = null;
    uploadProgress.value = 0;
    uploadFailed.value = false;
    // Must clear stale captions from whatever video was previously loaded —
    // VideoView's onMounted skips re-fetching captions when it sees
    // currentVideo already matches the target id (true here, since we're
    // about to set it below), so if we don't reset this, the new video's
    // page renders with the OLD video's captions still in state: the
    // Generate button never shows (hasCaptions looks true) and Translate/
    // Burn look available but 404 against the new video's real (empty)
    // caption record. Most visible on short videos, since the fast upload
    // makes it easy to jump between videos without an intervening reload
    // (which would otherwise mask this by forcing a fresh fetchCaptions).
    captions.value = null;

    const { data } = await api.post("/videos/init", { title });
    const video = data.video;
    videos.value.unshift(video);
    currentVideo.value = video;

    runVideoUpload(video._id, file);

    return video;
  };

  const runVideoUpload = async (videoId, file) => {
    try {
      const { data: sig } = await api.get("/videos/sign-upload");
      const result = await uploadVideoToCloudinary(file, sig, (p) => {
        uploadProgress.value = p;
      });
      const { data } = await api.put(`/videos/${videoId}/finalize`, {
        public_id: result.public_id,
        url: result.secure_url,
        duration: result.duration,
      });
      _syncVideo(videoId, data.video);
      uploadProgress.value = 100;
    } catch (err) {
      uploadFailed.value = true;
      error.value = err.response?.data?.message || "Video upload failed.";
    }
  };

  // Keeps `videos` list and `currentVideo` (if it's the same video) in sync
  // after a background pipeline updates a record the user may have
  // navigated away from.
  const _syncVideo = (videoId, updatedVideo) => {
    if (currentVideo.value?._id === videoId) currentVideo.value = updatedVideo;
    const idx = videos.value.findIndex((v) => v._id === videoId);
    if (idx !== -1) videos.value[idx] = updatedVideo;
  };

  const deleteVideo = async (id) => {
    try {
      await api.delete(`/videos/${id}`);
      videos.value = videos.value.filter((v) => v._id !== id);
      if (currentVideo.value?._id === id) currentVideo.value = null;
    } catch (err) {
      error.value = err.response?.data?.message || "Delete failed.";
    }
  };

  // ── Captions ──────────────────────────────────────────────────
  const generateCaptions = async (videoId) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.post(`/videos/${videoId}/captions`);
      captions.value = data.captions;
      if (currentVideo.value) currentVideo.value.status = "captioned";
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || "Caption generation failed.";
      return false;
    } finally {
      loading.value = false;
    }
  };

  // Guards against out-of-order responses: if the user navigates from video
  // A to video B quickly, A's fetchCaptions call may still be in flight and
  // could resolve AFTER B's — without this, A's (stale, wrong-video) result
  // would silently overwrite `captions` right after B's correct result
  // landed. Only the most recently INITIATED call is allowed to write, no
  // matter which one resolves first.
  let captionsRequestSeq = 0;
  const fetchCaptions = async (videoId) => {
    const seq = ++captionsRequestSeq;
    try {
      const { data } = await api.get(`/videos/${videoId}/captions`);
      if (seq === captionsRequestSeq) captions.value = data.captions;
    } catch {
      if (seq === captionsRequestSeq) captions.value = null;
    }
  };

  const updateCaptions = async (videoId, captionsArray) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.put(`/videos/${videoId}/captions`, {
        captions: captionsArray,
      });
      captions.value = data.captions;
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || "Update failed.";
      return false;
    } finally {
      loading.value = false;
    }
  };

  const translateCaptions = async (videoId, targetLanguage) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.post(`/videos/${videoId}/translate`, {
        targetLanguage,
      });
      captions.value = data.captions;
      if (currentVideo.value) currentVideo.value.status = "translated";
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || "Translation failed.";
      return false;
    } finally {
      loading.value = false;
    }
  };

  const downloadCaptions = (videoId, format = "srt", language = null) => {
    // Must build the base URL the same way api/axios.js does (strip
    // trailing slash, always append /api/v1) — this used to fall back to
    // a URL that already included /api/v1 only when VITE_API_URL was
    // unset, which meant it silently produced a 404-ing URL (missing
    // /api/v1) any time VITE_API_URL WAS set, i.e. in every real dev/prod
    // setup, not just the fallback case.
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
    let url = `${apiBase}/api/v1/videos/${videoId}/captions/download?format=${format}`;
    if (language) url += `&language=${language}`;
    window.open(url, "_blank");
  };

  // ── Dubbing ───────────────────────────────────────────────────
  const fetchVoices = async () => {
    if (voices.value.length) return; // cached — this is a shared catalog, not per-video
    try {
      const { data } = await api.get("/voices");
      voices.value = data.voices;
    } catch {
      voices.value = [];
    }
  };

  // Saves which ElevenLabs voice each detected speaker should use, for a
  // specific caption language (see backend Caption.speakerVoices for why
  // casting is per-language rather than per-video).
  const setSpeakerVoices = async (videoId, language, speakerVoicesArray) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.put(`/videos/${videoId}/captions/speakers`, {
        language,
        speakerVoices: speakerVoicesArray,
      });
      captions.value = data.captions;
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || "Saving voice casting failed.";
      return false;
    } finally {
      loading.value = false;
    }
  };

  const dubVideo = async (videoId, language = null) => {
    dubbing.value = true;
    error.value = null;
    try {
      const body = language ? { language } : {};
      const { data } = await api.post(`/videos/${videoId}/dub`, body);
      if (currentVideo.value) {
        currentVideo.value.dubbedVideo = data.dubbedVideo;
        currentVideo.value.status = "dubbed";
      }
      if (data.speakerVoices && captions.value) captions.value.speakerVoices = data.speakerVoices;
      return data.dubbedVideo;
    } catch (err) {
      error.value = err.response?.data?.message || "Dubbing failed.";
      return null;
    } finally {
      dubbing.value = false;
    }
  };

  return {
    videos, currentVideo, captions, loading, error,
    uploadProgress, uploadFailed,
    voices, dubbing,
    fetchVideos, fetchVideo, refreshVideoQuietly, startUpload, deleteVideo,
    generateCaptions, fetchCaptions, updateCaptions,
    translateCaptions, downloadCaptions,
    fetchVoices, setSpeakerVoices, dubVideo,
  };
});