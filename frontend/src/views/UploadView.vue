<template>
  <div class="relative min-h-screen">
    <ParticleCanvas />
    <div class="fixed inset-0 pointer-events-none" style="z-index:1"
      :class="theme.isDark ? 'bg-gradient-to-b from-gray-950/80 to-gray-950' : 'bg-gradient-to-b from-gray-50/80 to-gray-50'" />

    <main class="relative pt-32 pb-24 px-6" style="z-index:2">
      <div class="max-w-2xl mx-auto">

        <!-- Page header -->
        <div class="text-center mb-12">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium mb-6"
            :class="theme.isDark ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600'">
            🎙️ AI Caption Generator
          </div>
          <h1 class="text-4xl font-extrabold mb-3"
            :class="theme.isDark ? 'text-white' : 'text-gray-900'">Upload Your Video</h1>
          

          <!-- Limits -->
          <div class="flex flex-wrap items-center justify-center gap-2 mt-5">
            <span v-for="limit in uploadLimits" :key="limit"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
              :class="theme.isDark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-600'">
              {{ limit }}
            </span>
          </div>
        </div>


        <!-- Upload card -->
        <div class="border rounded-2xl p-8 space-y-5 mb-8"
          :class="theme.isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'">

          <div>
            <label class="block text-sm font-medium mb-1.5"
              :class="theme.isDark ? 'text-gray-300' : 'text-gray-700'">Video Title</label>
            <input v-model="title" type="text" placeholder="e.g. My Lecture — Part 1" required
              class="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              :class="theme.isDark
                ? 'bg-gray-800 border border-gray-700 text-white placeholder-gray-500'
                : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400'" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5"
              :class="theme.isDark ? 'text-gray-300' : 'text-gray-700'">Video File</label>
            <div @dragover.prevent @drop.prevent="onDrop"
              class="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200"
              :class="[
                file ? (theme.isDark ? 'border-indigo-500 bg-indigo-500/5' : 'border-indigo-400 bg-indigo-50') : (theme.isDark ? 'border-gray-700 hover:border-indigo-500 hover:bg-indigo-500/5' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'),
              ]"
              @click="fileInput.click()">
              <div v-if="!file">
                <div class="text-4xl mb-3">📁</div>
                <p class="font-semibold mb-1" :class="theme.isDark ? 'text-gray-300' : 'text-gray-700'">Drag & drop or click to select</p>
                <p class="text-sm" :class="theme.isDark ? 'text-gray-500' : 'text-gray-500'">MP4, AVI, MOV, MKV — up to 100MB and 8 minutes long</p>
              </div>
              <div v-else class="flex items-center justify-center gap-3 min-w-0">
                <span class="text-2xl shrink-0">🎬</span>
                <div class="text-left min-w-0">
                  <p class="font-semibold text-indigo-400 text-sm truncate">{{ file.name }}</p>
                  <p class="text-xs" :class="theme.isDark ? 'text-gray-500' : 'text-gray-500'">{{ (file.size / 1024 / 1024).toFixed(1) }} MB</p>
                </div>
                <button @click.stop="file = null" class="ml-2 shrink-0 text-gray-500 hover:text-red-400 text-lg">✕</button>
              </div>
            </div>
            <input ref="fileInput" type="file" accept="video/*" class="hidden" @change="onFileChange" />
          </div>

          <!-- Non-blocking: we don't know the account's actual Cloudinary plan
               here, so a file over the free-plan cap might still succeed on a
               paid plan. This warns instead of preventing the upload attempt. -->
          <p v-if="fileLikelyOverFreePlanLimit"
            class="text-sm text-amber-400 bg-amber-900/20 border border-amber-800 rounded-xl px-4 py-3">
            This file is {{ (file.size / 1024 / 1024).toFixed(0) }}MB. Cloudinary's free plan caps videos at
            {{ FREE_PLAN_LIMIT_MB }}MB — if your account is on the free plan, this upload will fail. Upgrading
            the Cloudinary plan or trimming the video will fix it.
          </p>

          <p v-if="durationLikelyOverBurnLimit"
            class="text-sm text-amber-400 bg-amber-900/20 border border-amber-800 rounded-xl px-4 py-3">
            This video is about {{ Math.ceil(videoDurationMinutes) }} minutes long. Captions can still be
            generated, edited, and exported, but burning captions into videos over {{ BURN_LIMIT_MIN }} minutes
            isn't supported yet — trim the video if you need a burned-in copy.
          </p>

          <p v-if="store.error" class="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
            {{ store.error }}
          </p>

          <button @click="handleUpload" :disabled="!file || !title || starting"
            class="w-full rounded-xl py-3 font-bold text-sm transition-all duration-200 disabled:opacity-40"
            :class="theme.isDark
              ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-lg shadow-indigo-500/30'
              : 'bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-md shadow-indigo-500/20'">
            {{ starting ? "Starting…" : "Upload & Generate Captions →" }}
          </button>
          <p class="text-xs text-center" :class="theme.isDark ? 'text-gray-500' : 'text-gray-500'">
            You'll be taken straight to the video page.
          </p>
        </div>

        <!-- What happens next -->
        <div class="border rounded-2xl p-6 mb-8"
          :class="theme.isDark ? 'bg-white/3 border-white/10' : 'bg-white border-gray-200 shadow-sm'">
          <h3 class="font-bold mb-4 text-sm uppercase tracking-wider text-indigo-400">What happens after upload</h3>
          <div class="space-y-3">
            <div v-for="(step, i) in nextSteps" :key="i" class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600/40 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">
                {{ i + 1 }}
              </div>
              <p class="text-sm leading-relaxed" :class="theme.isDark ? 'text-gray-400' : 'text-gray-600'">{{ step }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Features strip -->
      <div class="max-w-5xl mx-auto mt-16">
        <h2 class="text-center text-3xl font-bold mb-3"
          :class="theme.isDark ? 'text-white' : 'text-gray-900'">Everything after upload is free, too</h2>
        <p class="text-center text-base mb-12"
          :class="theme.isDark ? 'text-gray-500' : 'text-gray-600'">
          One upload unlocks the full Dubora AI workflow.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div v-for="f in uploadFeatures" :key="f.title"
            class="border rounded-2xl p-5 transition-colors"
            :class="theme.isDark ? 'bg-white/5 border-white/10 hover:border-indigo-500/30' : 'bg-white border-gray-200 hover:border-indigo-300 shadow-sm'">
            <div class="text-2xl mb-3">{{ f.icon }}</div>
            <h4 class="font-bold text-sm mb-1" :class="theme.isDark ? 'text-white' : 'text-gray-900'">{{ f.title }}</h4>
            <p class="text-xs leading-relaxed" :class="theme.isDark ? 'text-gray-500' : 'text-gray-600'">{{ f.desc }}</p>
          </div>
        </div>
      </div>

      <!-- Supported formats -->
      <div class="max-w-5xl mx-auto mt-16 border rounded-2xl p-8"
        :class="theme.isDark ? 'bg-white/3 border-white/10' : 'bg-white border-gray-200 shadow-sm'">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div v-for="info in formatInfo" :key="info.title">
            <h4 class="font-bold text-sm mb-3 text-indigo-400">{{ info.title }}</h4>
            <div class="flex flex-wrap gap-2">
              <span v-for="item in info.items" :key="item"
                class="px-3 py-1.5 rounded-lg text-xs font-medium border"
                :class="theme.isDark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'">
                {{ item }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useVideoStore } from "../stores/video.js";
import { useThemeStore } from "../stores/theme.js";
import { useRouter } from "vue-router";
import ParticleCanvas from "../components/ParticleCanvas.vue";
import { preloadFfmpeg } from "../utils/audio.js";

const store = useVideoStore();
const theme = useThemeStore();
const router = useRouter();

// Cloudinary's free-plan video cap — see cloudinary.js for the full
// breakdown of plan limits. Only used here to show a heads-up, not to
// block the upload, since we can't tell from the browser which plan the
// connected Cloudinary account is actually on.
const FREE_PLAN_LIMIT_MB = 100;

// Burning captions into the video re-encodes it client-side with ffmpeg.wasm,
// which gets slow (and memory-hungry) fast — 8 minutes is roughly where that
// stops being a good browser experience. Transcription/editing/translation
// have no such limit, so we only warn, never block, on this one.
const BURN_LIMIT_MIN = 8;

// Caption generation (Groq Whisper) is fast, but a cold model load plus a
// long/queued file can occasionally stretch out — 20 minutes is the outer
// bound users should expect before checking back.
const CAPTION_LIMIT_MIN = 20;

const uploadLimits = [
  "Up to 100MB per video",
  "Up to 8 min videos to burn captions",
  "can generate captions for up to 20 min videos",
  "Translate to 12 languages",
];

// Kick off the ffmpeg.wasm core download the moment this page loads —
// by the time the user has picked a file and clicked upload, it's usually
// already cached, instead of adding its full ~25-30MB load time on top of
// the actual audio extraction.
onMounted(() => { preloadFfmpeg(); });

const title = ref("");
const file  = ref(null);
const starting = ref(false);
const fileInput = ref(null);

const videoDurationMinutes = ref(0);

// Reads duration client-side via a throwaway <video> element — cheap, and
// lets us warn about the burn-in limit before the user ever uploads anything.
const readDuration = (selected) => {
  videoDurationMinutes.value = 0;
  if (!selected) return;
  const probe = document.createElement("video");
  probe.preload = "metadata";
  probe.onloadedmetadata = () => {
    videoDurationMinutes.value = probe.duration / 60;
    URL.revokeObjectURL(probe.src);
  };
  probe.src = URL.createObjectURL(selected);
};

const onFileChange = (e) => { file.value = e.target.files[0]; readDuration(file.value); };
const onDrop = (e) => { file.value = e.dataTransfer.files[0]; readDuration(file.value); };

const fileLikelyOverFreePlanLimit = computed(() =>
  !!file.value && file.value.size / 1024 / 1024 > FREE_PLAN_LIMIT_MB
);

const durationLikelyOverBurnLimit = computed(() =>
  !!file.value && videoDurationMinutes.value > BURN_LIMIT_MIN
);

// startUpload only awaits the (fast, tiny) record-creation request — the
// actual video upload and audio transcription keep running in the store
// after we navigate away, so the user lands on the video page instead of
// staring at this form.
const handleUpload = async () => {
  if (!file.value || !title.value) return;
  starting.value = true;
  const video = await store.startUpload(file.value, title.value);
  starting.value = false;
  if (video) router.push(`/video/${video._id}`);
};

const nextSteps = [
  "Your video is securely uploaded to Cloudinary and a record is created in the database.",
  "You're redirected to the Video page where you click 'Generate Captions' to trigger AI transcription.",
  `Groq Whisper large-v3 auto-detects the language and returns timestamped captions — usually in under a minute, up to ${CAPTION_LIMIT_MIN} min for longer files.`,
  "Edit any line, translate to 12 languages, burn captions into videos up to 8 min long, or download as SRT/TXT.",
];

const uploadFeatures = [
  { icon: "✏️", title: "Inline Editor",       desc: "Fix any word or rephrase entire lines directly in the browser — no app needed." },
  { icon: "🌍", title: "12-Language Translate", desc: "One click to translate all captions using LLaMA 3.3 70B — context-aware, not word-for-word." },
  { icon: "🔥", title: "Burn Into Video",      desc: "Permanently embed subtitles on videos up to 8 minutes — plays on any player or social platform." },
  { icon: "📥", title: "SRT & TXT Export",     desc: "Download clean caption files for YouTube, Premiere Pro, Final Cut, or any subtitle tool." },
];

const formatInfo = [
  { title: "Accepted Video Formats", items: ["MP4", "MOV", "AVI", "MKV", "WEBM"] },
  { title: "Caption Export Formats", items: ["SRT", "TXT"] },
  { title: "Output Languages", items: ["Arabic", "French", "Spanish", "German", "English","Urdu", "Hindi", "Chinese", "Turkish", "Russian", "Italian", "Portuguese", "Japanese"] },
];
</script>
