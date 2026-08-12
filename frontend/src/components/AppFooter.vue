<template>
  <footer class="relative z-10 border-t theme-border mt-24"
    :class="theme.isDark ? 'bg-gray-950/80 border-white/10' : 'bg-white/80 border-gray-200'">
    <div class="max-w-6xl mx-auto px-6 py-14">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

        <!-- Brand -->
        <div>
          <RouterLink to="/" class="flex items-center gap-2.5 mb-4 w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 340" class="w-10 h-10 sm:w-10 sm:h-10 shrink-0" aria-label="Dubora AI logo">
  <defs>
    <linearGradient id="ft-orange" x1="15%" y1="5%" x2="90%" y2="95%">
      <stop offset="0%" stop-color="#FFB84D"/>
      <stop offset="55%" stop-color="#FF8A1E"/>
      <stop offset="100%" stop-color="#F56600"/>
    </linearGradient>
    <linearGradient id="ft-ear" x1="20%" y1="5%" x2="85%" y2="95%">
      <stop offset="0%" stop-color="#FFA33A"/>
      <stop offset="100%" stop-color="#FF7615"/>
    </linearGradient>
    <linearGradient id="ft-dark" x1="10%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="#B9400D"/>
      <stop offset="100%" stop-color="#7A2E12"/>
    </linearGradient>
    <linearGradient id="ft-bottom" x1="15%" y1="5%" x2="90%" y2="95%">
      <stop offset="0%" stop-color="#FFD09E"/>
      <stop offset="100%" stop-color="#FFA55D"/>
    </linearGradient>
    <linearGradient id="ft-play" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF8A1E"/>
      <stop offset="100%" stop-color="#F05F00"/>
    </linearGradient>
    <filter id="ft-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000000" flood-opacity=".13"/>
    </filter>
  </defs>

  <!-- Left ear -->
  <path d="M112 99
           C80 82 43 94 30 125
           C17 157 6 199 13 221
           C21 248 49 251 66 238
           C80 227 79 205 75 190
           C68 163 76 135 99 118
           C104 114 108 108 112 99Z"
        fill="url(#ft-ear)" filter="url(#ft-shadow)"/>

  <!-- Right ear -->
  <path d="M228 99
           C260 82 297 94 310 125
           C323 157 334 199 327 221
           C319 248 291 251 274 238
           C260 227 261 205 265 190
           C272 163 264 135 241 118
           C236 114 232 108 228 99Z"
        fill="url(#ft-ear)" filter="url(#ft-shadow)"/>

  <!-- Bottom peach accent -->
  <path d="M101 263
           C85 277 82 300 91 319
           C103 344 134 351 160 345
           C186 339 204 321 207 298
           C210 278 200 263 185 255
           C169 247 151 250 137 260
           C124 269 112 271 101 263Z"
        fill="url(#ft-bottom)" filter="url(#ft-shadow)"/>

  <!-- Main circular head -->
  <circle cx="170" cy="164" r="101"
          fill="url(#ft-orange)" filter="url(#ft-shadow)"/>

  <!-- Dark inner ring -->
  <circle cx="170" cy="164" r="68" fill="url(#ft-dark)"/>

  <!-- White center -->
  <circle cx="170" cy="164" r="57" fill="#FFFFFF"/>

  <!-- Play triangle -->
  <path d="M151 131 L151 197 L201 164 Z" fill="url(#ft-play)"/>
</svg>
<span class="font-extrabold text-lg" :class="theme.isDark ? 'text-white' : 'text-gray-900'">
  Dub<span class="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">ora AI</span>
</span>
          </RouterLink>
          <p class="text-sm leading-relaxed mb-5" :class="theme.isDark ? 'text-gray-400' : 'text-gray-600'">
            Dub any video with distinct AI voices per speaker. Free, fast, and private.
          </p>
          <!-- Social links -->
          <div class="flex items-center gap-3">
            <a href="https://github.com/Abdullah-Ranjha-eng" target="_blank" rel="noopener"
              class="p-2 rounded-xl transition-all duration-200"
              :class="theme.isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900'">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <a href="https://twitter.com/your-username" target="_blank" rel="noopener"
              class="p-2 rounded-xl transition-all duration-200"
              :class="theme.isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900'">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
        </div>

        <!-- Tools -->
        <div>
          <h4 class="text-sm font-semibold mb-4 tracking-widest uppercase"
            :class="theme.isDark ? 'text-white' : 'text-gray-900'">Tools</h4>
          <ul class="space-y-3">
            <li v-for="l in toolLinks" :key="l.label">
              <RouterLink :to="l.to"
                class="text-sm transition-colors duration-200"
                :class="theme.isDark ? 'text-gray-400 hover:text-orange-400' : 'text-gray-600 hover:text-orange-600'">
                {{ l.label }}
              </RouterLink>
            </li>
          </ul>
        </div>

        <!-- Company -->
        <div>
          <h4 class="text-sm font-semibold mb-4 tracking-widest uppercase"
            :class="theme.isDark ? 'text-white' : 'text-gray-900'">Company</h4>
          <ul class="space-y-3">
            <li v-for="l in companyLinks" :key="l.label">
              <RouterLink :to="l.to"
                class="text-sm transition-colors duration-200"
                :class="theme.isDark ? 'text-gray-400 hover:text-orange-400' : 'text-gray-600 hover:text-orange-600'">
                {{ l.label }}
              </RouterLink>
            </li>
          </ul>
        </div>

        <!-- Resources -->
        <div>
          <h4 class="text-sm font-semibold mb-4 tracking-widest uppercase"
            :class="theme.isDark ? 'text-white' : 'text-gray-900'">Resources</h4>
          <ul class="space-y-3">
            <li v-for="l in resourceLinks" :key="l.label">
              <a :href="l.href" target="_blank" rel="noopener"
                class="text-sm transition-colors duration-200"
                :class="theme.isDark ? 'text-gray-400 hover:text-orange-400' : 'text-gray-600 hover:text-orange-600'">
                {{ l.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
        :class="theme.isDark ? 'border-white/10' : 'border-gray-200'">
        <p class="text-xs" :class="theme.isDark ? 'text-gray-500' : 'text-gray-500'">
          © {{ new Date().getFullYear() }} Dubora AI. Open source under MIT License.
        </p>
        <!-- Theme toggle -->
        <button @click="theme.toggle()"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200"
          :class="theme.isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border border-gray-200'">
          <span>{{ theme.isDark ? '☀️' : '🌙' }}</span>
          {{ theme.isDark ? 'Light' : 'Dark' }} Mode
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { useThemeStore } from "../stores/theme.js";
const theme = useThemeStore();

const toolLinks = [
  { label: "Generate Captions", to: "/upload" },
  { label: "Translate Subtitles", to: "/upload" },
  { label: "Burn Captions", to: "/upload" },
  { label: "Download SRT / TXT", to: "/upload" },
  { label: "View All Tools", to: "/about" },
];

const companyLinks = [
  { label: "About", to: "/about" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Register", to: "/register" },
  { label: "Sign In", to: "/login" },
];

const resourceLinks = [
  { label: "Documentation", href: "https://github.com/Abdullah-Ranjha-eng" },
  { label: "Source Code", href: "https://github.com/Abdullah-Ranjha-eng" },
  { label: "Contributing", href: "https://github.com/Abdullah-Ranjha-eng" },
  { label: "Report an Issue", href: "https://github.com/Abdullah-Ranjha-eng" },
];
</script>
