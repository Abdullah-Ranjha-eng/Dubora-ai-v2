<template>
  <nav class="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl">
    <div class="backdrop-blur-xl border rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xl transition-colors duration-300"
      :class="theme.isDark
        ? 'bg-white/5 border-white/10 shadow-black/40'
        : 'bg-white/80 border-gray-200 shadow-gray-200/60'">

      <!-- Logo -->
      <RouterLink to="/" class="flex items-center group" @click="mobileMenuOpen = false">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 340" class="w-9 h-9 sm:w-10 sm:h-10 shrink-0" aria-label="Dubora AI logo">
  <defs>
    <linearGradient id="nb-orange" x1="15%" y1="5%" x2="90%" y2="95%">
      <stop offset="0%" stop-color="#FFB84D"/>
      <stop offset="55%" stop-color="#FF8A1E"/>
      <stop offset="100%" stop-color="#F56600"/>
    </linearGradient>
    <linearGradient id="nb-ear" x1="20%" y1="5%" x2="85%" y2="95%">
      <stop offset="0%" stop-color="#FFA33A"/>
      <stop offset="100%" stop-color="#FF7615"/>
    </linearGradient>
    <linearGradient id="nb-dark" x1="10%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="#B9400D"/>
      <stop offset="100%" stop-color="#7A2E12"/>
    </linearGradient>
    <linearGradient id="nb-bottom" x1="15%" y1="5%" x2="90%" y2="95%">
      <stop offset="0%" stop-color="#FFD09E"/>
      <stop offset="100%" stop-color="#FFA55D"/>
    </linearGradient>
    <linearGradient id="nb-play" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF8A1E"/>
      <stop offset="100%" stop-color="#F05F00"/>
    </linearGradient>
    <filter id="nb-shadow" x="-30%" y="-30%" width="160%" height="160%">
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
        fill="url(#nb-ear)" filter="url(#nb-shadow)"/>

  <!-- Right ear -->
  <path d="M228 99
           C260 82 297 94 310 125
           C323 157 334 199 327 221
           C319 248 291 251 274 238
           C260 227 261 205 265 190
           C272 163 264 135 241 118
           C236 114 232 108 228 99Z"
        fill="url(#nb-ear)" filter="url(#nb-shadow)"/>

  <!-- Bottom peach accent -->
  <path d="M101 263
           C85 277 82 300 91 319
           C103 344 134 351 160 345
           C186 339 204 321 207 298
           C210 278 200 263 185 255
           C169 247 151 250 137 260
           C124 269 112 271 101 263Z"
        fill="url(#nb-bottom)" filter="url(#nb-shadow)"/>

  <!-- Main circular head -->
  <circle cx="170" cy="164" r="101"
          fill="url(#nb-orange)" filter="url(#nb-shadow)"/>

  <!-- Dark inner ring -->
  <circle cx="170" cy="164" r="68" fill="url(#nb-dark)"/>

  <!-- White center -->
  <circle cx="170" cy="164" r="57" fill="#FFFFFF"/>

  <!-- Play triangle -->
  <path d="M151 131 L151 197 L201 164 Z" fill="url(#nb-play)"/>
</svg>
        <span class="ml-2 font-extrabold tracking-tight text-base sm:text-lg leading-none"
          :class="theme.isDark ? 'text-white' : 'text-gray-900'">
          Dub<span class="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">ora AI</span>
        </span>
      </RouterLink>

      <!-- Center links (desktop only) -->
      <div class="hidden md:flex items-center gap-1">
        <RouterLink v-for="link in navLinks" :key="link.to" :to="link.to"
          class="px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200"
          :class="$route.path === link.to
            ? (theme.isDark ? 'text-white bg-white/10' : 'text-gray-900 bg-gray-100')
            : (theme.isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100')">
          {{ link.label }}
        </RouterLink>
      </div>

      <!-- Right side -->
      <div class="flex items-center gap-1.5 sm:gap-2">
        <!-- Theme toggle -->
        <button @click="theme.toggle()"
          class="p-2 rounded-xl text-lg transition-all duration-200"
          :class="theme.isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'"
          :title="theme.isDark ? 'Switch to Light' : 'Switch to Dark'">
          {{ theme.isDark ? '☀️' : '🌙' }}
        </button>

        <!-- Desktop auth area -->
        <div class="hidden md:flex items-center gap-2">
          <template v-if="auth.user">
            <span class="hidden sm:flex items-center gap-2 text-sm" :class="theme.isDark ? 'text-gray-400' : 'text-gray-600'">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
                {{ auth.user.name[0].toUpperCase() }}
              </div>
              {{ auth.user.name.split(' ')[0] }}
            </span>
            <button @click="handleLogout"
              class="px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200"
              :class="theme.isDark ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-600 hover:text-red-500 hover:bg-red-50'">
              Logout
            </button>
          </template>
          <template v-else>
            <RouterLink to="/login"
              class="px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200"
              :class="theme.isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'">
              Sign In
            </RouterLink>
            <RouterLink to="/upload"
              class="px-4 py-1.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-pink-500 hover:from-orange-500 hover:to-pink-400 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-200">
              Upload
            </RouterLink>
          </template>
        </div>

        <!-- Mobile hamburger toggle -->
        <button @click="mobileMenuOpen = !mobileMenuOpen"
          class="md:hidden p-2 rounded-xl transition-all duration-200"
          :class="theme.isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'"
          :aria-expanded="mobileMenuOpen"
          aria-label="Toggle navigation menu">
          <svg v-if="!mobileMenuOpen" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile dropdown panel -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2">
      <div v-if="mobileMenuOpen"
        class="md:hidden mt-2 backdrop-blur-xl border rounded-2xl p-3 shadow-2xl"
        :class="theme.isDark
          ? 'bg-gray-950/95 border-white/10 shadow-black/40'
          : 'bg-white/95 border-gray-200 shadow-gray-200/60'">

        <RouterLink v-for="link in navLinks" :key="link.to" :to="link.to"
          @click="mobileMenuOpen = false"
          class="block px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
          :class="$route.path === link.to
            ? (theme.isDark ? 'text-white bg-white/10' : 'text-gray-900 bg-gray-100')
            : (theme.isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100')">
          {{ link.label }}
        </RouterLink>

        <div class="my-2 border-t" :class="theme.isDark ? 'border-white/10' : 'border-gray-200'"></div>

        <template v-if="auth.user">
          <div class="flex items-center gap-2 px-4 py-2 text-sm" :class="theme.isDark ? 'text-gray-400' : 'text-gray-600'">
            <div class="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
              {{ auth.user.name[0].toUpperCase() }}
            </div>
            {{ auth.user.name }}
          </div>
          <button @click="handleLogout"
            class="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
            :class="theme.isDark ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-600 hover:text-red-500 hover:bg-red-50'">
            Logout
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" @click="mobileMenuOpen = false"
            class="block px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
            :class="theme.isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'">
            Sign In
          </RouterLink>
          <RouterLink to="/upload" @click="mobileMenuOpen = false"
            class="block text-center mt-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-pink-500 hover:from-orange-500 hover:to-pink-400 shadow-lg shadow-orange-500/30 transition-all duration-200">
            Upload
          </RouterLink>
        </template>
      </div>
    </Transition>
  </nav>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import { useAuthStore } from "../stores/auth.js";
import { useThemeStore } from "../stores/theme.js";
import { useRouter, useRoute } from "vue-router";

const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();
const route = useRoute();

const mobileMenuOpen = ref(false);

// Close the mobile menu automatically whenever navigation happens
watch(() => route.path, () => { mobileMenuOpen.value = false; });

// Dashboard is registered-users-only (it lists every video on the account),
// so it's only worth showing guests a link they'd just get bounced from.
// Upload/video pages work without an account, so those stay visible always.
const navLinks = computed(() => [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  ...(auth.user ? [{ to: "/dashboard", label: "Dashboard" }] : []),
  { to: "/upload", label: "Upload" },
]);

const handleLogout = async () => {
  mobileMenuOpen.value = false;
  await auth.logout();
  router.push("/login");
};
</script>
