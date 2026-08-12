<template>
  <div class="relative min-h-screen">
    <ParticleCanvas />
    <div class="fixed inset-0 pointer-events-none" style="z-index:1"
      :class="theme.isDark ? 'bg-gradient-to-b from-gray-950/80 to-gray-950' : 'bg-gradient-to-b from-gray-50/80 to-gray-50'" />

    <main class="relative pt-32 pb-16 px-6" style="z-index:2">
      <div class="max-w-6xl mx-auto">

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div>
            <p class="text-orange-400 text-sm font-medium mb-1">Welcome back, {{ auth.user?.name?.split(' ')[0] }} 👋</p>
            <h1 class="text-4xl font-extrabold" :class="theme.isDark ? 'text-white' : 'text-gray-900'">My Videos</h1>
            <p class="text-sm mt-1" :class="theme.isDark ? 'text-gray-500' : 'text-gray-600'">
              Manage your uploads, generate captions, and track progress.
            </p>
          </div>
          <RouterLink to="/upload"
            class="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-600 to-pink-500 hover:from-orange-500 hover:to-pink-400 rounded-xl font-semibold text-white text-sm shadow-lg shadow-orange-500/30 transition-all w-fit">
            <span class="text-lg leading-none">+</span> Upload Video
          </RouterLink>
        </div>

        <!-- Quick stats -->
        <div v-if="!store.loading && store.videos.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <div v-for="stat in quickStats" :key="stat.label"
            class="border rounded-2xl p-4 text-center"
            :class="theme.isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'">
            <div class="text-2xl font-extrabold mb-0.5" :class="theme.isDark ? 'text-white' : 'text-gray-900'">{{ stat.value }}</div>
            <div class="text-xs" :class="theme.isDark ? 'text-gray-500' : 'text-gray-500'">{{ stat.label }}</div>
          </div>
        </div>

        <LoadingSpinner v-if="store.loading" />

        <!-- Empty state -->
        <div v-else-if="store.videos.length === 0"
          class="text-center py-32 border rounded-3xl"
          :class="theme.isDark ? 'bg-white/3 border-white/10' : 'bg-white border-gray-200 shadow-sm'">
          <div class="text-7xl mb-5">🎬</div>
          <h3 class="text-2xl font-bold mb-2" :class="theme.isDark ? 'text-white' : 'text-gray-900'">No videos yet</h3>
          <p class="mb-8" :class="theme.isDark ? 'text-gray-500' : 'text-gray-600'">Upload your first video to get started with AI captions.</p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <RouterLink to="/upload"
              class="inline-block px-6 py-3 bg-gradient-to-r from-orange-600 to-pink-500 hover:from-orange-500 hover:to-pink-400 rounded-xl font-semibold text-sm text-white transition shadow-lg shadow-orange-500/30">
              Upload Now →
            </RouterLink>
            <RouterLink to="/about"
              class="inline-block px-6 py-3 border rounded-xl font-semibold text-sm transition"
              :class="theme.isDark ? 'border-white/10 text-gray-400 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'">
              Learn How It Works
            </RouterLink>
          </div>
        </div>

        <!-- Video grid -->
        <div v-else>
          <!-- Filter tabs -->
          <div class="flex gap-2 mb-6 flex-wrap">
            <button v-for="tab in statusTabs" :key="tab"
              @click="activeTab = tab"
              class="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
              :class="activeTab === tab
                ? 'bg-orange-600 text-white shadow-md shadow-orange-500/30'
                : (theme.isDark ? 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')">
              {{ tab === 'all' ? 'All Videos' : tab.charAt(0).toUpperCase() + tab.slice(1) }}
              <span class="ml-1 opacity-70">({{ tab === 'all' ? store.videos.length : store.videos.filter(v => v.status === tab).length }})</span>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div v-for="v in filteredVideos" :key="v._id"
              class="group border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
              :class="theme.isDark
                ? 'bg-white/5 hover:bg-white/8 border-white/10 hover:border-orange-500/50 hover:shadow-orange-500/10'
                : 'bg-white border-gray-200 hover:border-orange-300 hover:shadow-orange-100'">

              <RouterLink :to="`/video/${v._id}`">
                <div class="relative aspect-video flex items-center justify-center overflow-hidden"
                  :class="theme.isDark ? 'bg-gray-900' : 'bg-gray-100'">
                  <img v-if="v.originalVideo?.url?.includes('/upload/')"
  :src="v.originalVideo.url
    .replace('/upload/', '/upload/so_0,w_480,h_270,c_fill,q_auto/')
    .replace(/\.(mp4|mov|avi|mkv|webm)$/i, '.jpg')"
  class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
  @error="(e) => e.target.style.display = 'none'" />
<div v-else class="text-5xl">🎬</div>
                  

                  <!-- Status badge -->
                  <span class="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-semibold border"
                    :class="statusClass(v.status)">
                    {{ v.status }}
                  </span>

                  <!-- Play overlay -->
                  <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-xl">▶</div>
                  </div>
                </div>
              </RouterLink>

              <div class="p-4">
                <RouterLink :to="`/video/${v._id}`"
                  class="text-sm font-semibold truncate block mb-1 hover:text-orange-400 transition-colors"
                  :class="theme.isDark ? 'text-white' : 'text-gray-900'">
                  {{ v.title }}
                </RouterLink>
                <div class="flex items-center justify-between">
                  <span class="text-xs" :class="theme.isDark ? 'text-gray-500' : 'text-gray-500'">
                    {{ v.status === 'burned' ? '✅ Ready to share' : v.status === 'captioned' ? '📝 Edit or translate' : v.status === 'translated' ? '🌍 Ready to burn' : '⬆️ Uploaded' }}
                  </span>
                  <!-- NEW — bigger, always visible -->
<button @click.prevent="confirmDelete(v._id)"
  class="text-lg transition-all ml-2 p-1.5 rounded-lg hover:scale-110 active:scale-95"
  :class="theme.isDark ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'">
  🗑️
</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tips section (when has videos) -->
        <div v-if="!store.loading && store.videos.length > 0" class="mt-16">
          <h2 class="text-xl font-bold mb-6" :class="theme.isDark ? 'text-white' : 'text-gray-900'">
            💡 Tips & Next Steps
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div v-for="tip in tips" :key="tip.title"
              class="border rounded-2xl p-5 transition-colors"
              :class="theme.isDark ? 'bg-white/5 border-white/10 hover:border-orange-500/30' : 'bg-white border-gray-200 hover:border-orange-200 shadow-sm'">
              <div class="text-xl mb-2">{{ tip.icon }}</div>
              <h4 class="font-semibold text-sm mb-1" :class="theme.isDark ? 'text-white' : 'text-gray-900'">{{ tip.title }}</h4>
              <p class="text-xs leading-relaxed" :class="theme.isDark ? 'text-gray-500' : 'text-gray-600'">{{ tip.desc }}</p>
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
import { useAuthStore } from "../stores/auth.js";
import { useThemeStore } from "../stores/theme.js";
import LoadingSpinner from "../components/LoadingSpinner.vue";
import ParticleCanvas from "../components/ParticleCanvas.vue";

const store = useVideoStore();
const auth  = useAuthStore();
const theme = useThemeStore();

const activeTab = ref("all");
const statusTabs = ["all", "uploaded", "captioned", "translated", "burned"];

onMounted(() => store.fetchVideos());

const filteredVideos = computed(() =>
  activeTab.value === "all"
    ? store.videos
    : store.videos.filter(v => v.status === activeTab.value)
);

const quickStats = computed(() => [
  { label: "Total Videos", value: store.videos.length },
  { label: "Captioned",    value: store.videos.filter(v => ["captioned","translated","burned"].includes(v.status)).length },
  { label: "Translated",   value: store.videos.filter(v => ["translated","burned"].includes(v.status)).length },
  { label: "Burned",       value: store.videos.filter(v => v.status === "burned").length },
]);

const statusClass = (s) => ({
  uploaded:   "bg-gray-800/80 text-gray-300 border-gray-700",
  processing: "bg-yellow-900/80 text-yellow-300 border-yellow-700",
  captioned:  "bg-blue-900/80  text-blue-300  border-blue-700",
  translated: "bg-purple-900/80 text-purple-300 border-purple-700",
  burned:     "bg-green-900/80 text-green-300  border-green-700",
}[s] || "bg-gray-800/80 text-gray-300 border-gray-700");

const confirmDelete = (id) => {
  if (confirm("Delete this video? This cannot be undone.")) store.deleteVideo(id);
};

const tips = [
  { icon: "🎙️", title: "Generate after upload", desc: "After uploading, open the video and click 'Generate Captions' to trigger Whisper transcription." },
  { icon: "🌍", title: "Translate in one click",  desc: "Select a target language from the dropdown and click Translate to localize all captions instantly." },
  { icon: "🔥", title: "Burn for sharing",         desc: "Click 'Burn Captions' to permanently embed subtitles so they display on any player or social feed." },
];
</script>
