<template>
  <div class="relative min-h-screen overflow-hidden">
    <ParticleCanvas />

    <!-- Theme-aware overlay (matches HomeView exactly) -->
    <div class="fixed inset-0 pointer-events-none" style="z-index:1"
      :class="theme.isDark
        ? 'bg-gradient-to-b from-gray-950/60 via-gray-950/40 to-gray-950'
        : 'bg-gradient-to-b from-gray-50/70 via-gray-50/50 to-gray-50'" />

    <main class="relative pt-36 pb-24 px-6" style="z-index:2">

      <!-- Hero -->
      <div class="max-w-3xl mx-auto text-center mb-24">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium mb-8"
          :class="theme.isDark ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-cyan-50 border-cyan-200 text-cyan-600'">
          Our Story
        </div>
        <h1 class="text-5xl md:text-6xl font-extrabold leading-tight mb-6"
          :class="theme.isDark ? 'text-white' : 'text-gray-900'">
          About <span class="bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">Dubora AI</span>
        </h1>
        <p class="text-xl leading-relaxed" :class="theme.isDark ? 'text-gray-400' : 'text-gray-600'">
          A modern, AI-powered platform that makes video dubbing fast, accurate, and accessible to everyone — students, creators, teachers, and businesses.
        </p>
      </div>

      <!-- Mission -->
      <div class="max-w-4xl mx-auto mb-24 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <p class="text-xs font-semibold text-indigo-400 tracking-widest uppercase mb-3">Why we built this</p>
          <h2 class="text-3xl font-bold mb-5" :class="theme.isDark ? 'text-white' : 'text-gray-900'">Dubbing shouldn't need a studio</h2>
          <p class="leading-relaxed mb-4" :class="theme.isDark ? 'text-gray-400' : 'text-gray-600'">
            Every time someone wants to reach an audience in another language — a lecture, a tutorial, a business presentation — they face the same problem: real dubbing is slow, expensive, and normally means hiring voice actors per language.
          </p>
          <p class="leading-relaxed" :class="theme.isDark ? 'text-gray-400' : 'text-gray-600'">
            Dubora AI changes that. We use Groq's blazing-fast Whisper model to transcribe speech and figure out who's speaking, LLaMA 3.3 70B to translate every line into 12 languages, and ElevenLabs to generate a distinct AI voice per speaker — all in one place, in minutes.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div v-for="p in pillars" :key="p.title"
            class="border rounded-2xl p-5 transition-colors"
            :class="theme.isDark ? 'bg-white/5 border-white/10 hover:border-indigo-500/40' : 'bg-white border-gray-200 hover:border-indigo-300 shadow-sm'">
            <div class="text-2xl mb-3">{{ p.icon }}</div>
            <h3 class="font-semibold text-sm mb-1" :class="theme.isDark ? 'text-white' : 'text-gray-900'">{{ p.title }}</h3>
            <p class="text-xs leading-relaxed" :class="theme.isDark ? 'text-gray-500' : 'text-gray-600'">{{ p.desc }}</p>
          </div>
        </div>
      </div>

      <!-- Tech stack -->
      <div class="max-w-4xl mx-auto mb-24">
        <p class="text-center text-xs font-semibold text-indigo-400 tracking-widest uppercase mb-4">Under the hood</p>
        <h2 class="text-center text-3xl font-bold mb-12" :class="theme.isDark ? 'text-white' : 'text-gray-900'">Built with modern technology</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div v-for="t in tech" :key="t.name"
            class="flex items-center gap-3 border rounded-xl px-4 py-3 transition-colors"
            :class="theme.isDark ? 'bg-white/5 border-white/10 hover:border-indigo-500/30' : 'bg-white border-gray-200 hover:border-indigo-300 shadow-sm'">
            <span class="text-xl">{{ t.icon }}</span>
            <div>
              <div class="text-sm font-semibold" :class="theme.isDark ? 'text-white' : 'text-gray-900'">{{ t.name }}</div>
              <div class="text-xs" :class="theme.isDark ? 'text-gray-500' : 'text-gray-500'">{{ t.role }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Who it's for -->
      <div class="max-w-4xl mx-auto mb-24">
        <p class="text-center text-xs font-semibold text-cyan-400 tracking-widest uppercase mb-4">Audience</p>
        <h2 class="text-center text-3xl font-bold mb-12" :class="theme.isDark ? 'text-white' : 'text-gray-900'">Built for everyone who creates video</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div v-for="a in audience" :key="a.label"
            class="text-center border rounded-2xl p-6 transition-colors"
            :class="theme.isDark ? 'bg-white/5 border-white/10 hover:border-cyan-500/30' : 'bg-white border-gray-200 hover:border-cyan-300 shadow-sm'">
            <div class="text-3xl mb-3">{{ a.icon }}</div>
            <div class="text-sm font-semibold" :class="theme.isDark ? 'text-white' : 'text-gray-900'">{{ a.label }}</div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="max-w-xl mx-auto text-center border rounded-3xl p-12 backdrop-blur"
        :class="theme.isDark ? 'bg-gradient-to-r from-indigo-600/20 to-cyan-500/10 border-indigo-500/20' : 'bg-gradient-to-r from-indigo-50 to-cyan-50 border-indigo-200'">
        <h2 class="text-2xl font-bold mb-4" :class="theme.isDark ? 'text-white' : 'text-gray-900'">Try it now — it's free</h2>
        <p class="mb-8 text-sm" :class="theme.isDark ? 'text-gray-400' : 'text-gray-600'">No signup friction. Upload a video and get captions — and a full dub — in minutes.</p>
        <!-- REPLACE -->
<RouterLink v-if="!auth.user" to="/register"
  class="inline-block px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 rounded-2xl font-bold text-white shadow-xl shadow-indigo-500/30 transition-all">
  Get Started Free →
</RouterLink>
<RouterLink v-else to="/upload"
  class="inline-block px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 rounded-2xl font-bold text-white shadow-xl shadow-indigo-500/30 transition-all">
  Upload a Video →
</RouterLink>
      </div>
    </main>
  </div>
</template>

<script setup>
import ParticleCanvas from "../components/ParticleCanvas.vue";
import { useThemeStore } from "../stores/theme.js";
import { useAuthStore } from "../stores/auth.js";
const auth = useAuthStore();
const theme = useThemeStore();

const pillars = [
  { icon: "⚡", title: "Blazing Fast",    desc: "Groq inference is 10× faster than traditional APIs." },
  { icon: "🎯", title: "Highly Accurate", desc: "Whisper large-v3 delivers near-human transcription." },
  { icon: "🌍", title: "Multilingual",    desc: "Auto-detect language, translate to 12 more." },
  { icon: "🔒", title: "Your Data",       desc: "Videos stored privately on your own Cloudinary account." },
];

const tech = [
  { icon: "🟢", name: "Node.js + Express",  role: "Backend API" },
  { icon: "🍃", name: "MongoDB + Mongoose", role: "Database" },
  { icon: "💚", name: "Vue.js 3 + Pinia",   role: "Frontend" },
  { icon: "🤖", name: "Groq Whisper",       role: "Transcription AI" },
  { icon: "🦙", name: "LLaMA 3.3 70B",      role: "Translation AI" },
  { icon: "☁️", name: "Cloudinary",         role: "Video storage" },
  { icon: "🎬", name: "FFmpeg",             role: "Caption burning" },
  { icon: "🔐", name: "JWT + Cookies",      role: "Authentication" },
  { icon: "🚀", name: "Multer",             role: "File uploads" },
];

const audience = [
  { icon: "🎓", label: "Students" },
  { icon: "🎬", label: "Creators" },
  { icon: "👩‍🏫", label: "Teachers" },
  { icon: "🏢", label: "Businesses" },
];
</script>