<template>
  <nav class="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl">
    <div class="backdrop-blur-xl border rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xl transition-colors duration-300"
      :class="theme.isDark
        ? 'bg-white/5 border-white/10 shadow-black/40'
        : 'bg-white/80 border-gray-200 shadow-gray-200/60'">

      <!-- Logo -->
      <!-- REPLACE WITH -->
<RouterLink to="/" class="flex items-center group" @click="mobileMenuOpen = false">
  <svg viewBox="0 0 280 300" class="h-9 w-auto sm:h-12 transition-all duration-300 group-hover:scale-105" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="nb-ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#FF2D78"/>
        <stop offset="50%"  stop-color="#C84BF5"/>
        <stop offset="100%" stop-color="#4B9EF5"/>
      </linearGradient>
      <linearGradient id="nb-micGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stop-color="#FF2D78"/>
        <stop offset="100%" stop-color="#7B2FFF"/>
      </linearGradient>
      <linearGradient id="nb-waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#FF2D78"/>
        <stop offset="100%" stop-color="#4B9EF5"/>
      </linearGradient>
      <radialGradient id="nb-innerBg" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="#1a0a2e"/>
        <stop offset="100%" stop-color="#080810"/>
      </radialGradient>
      <filter id="nb-glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="nb-micGlow">
        <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- Outer ring glow -->
    <circle cx="140" cy="150" r="108" fill="none" stroke="url(#nb-ringGrad)" stroke-width="1" opacity="0.3" filter="url(#nb-glow)"/>
    <!-- Main ring -->
    <circle cx="140" cy="150" r="102" fill="none" stroke="url(#nb-ringGrad)" stroke-width="3.5" filter="url(#nb-glow)"/>
    <!-- Inner background -->
    <circle cx="140" cy="150" r="97" fill="url(#nb-innerBg)"/>

    <!-- Left sound waves -->
    <path d="M 98,136 Q 88,150 98,164" fill="none" stroke="url(#nb-waveGrad)" stroke-width="2.5" stroke-linecap="round" filter="url(#nb-glow)" opacity="0.9"/>
    <path d="M 84,124 Q 68,150 84,176" fill="none" stroke="url(#nb-waveGrad)" stroke-width="2"   stroke-linecap="round" filter="url(#nb-glow)" opacity="0.55"/>

    <!-- Right sound waves -->
    <path d="M 182,136 Q 192,150 182,164" fill="none" stroke="url(#nb-waveGrad)" stroke-width="2.5" stroke-linecap="round" filter="url(#nb-glow)" opacity="0.9"/>
    <path d="M 196,124 Q 212,150 196,176" fill="none" stroke="url(#nb-waveGrad)" stroke-width="2"   stroke-linecap="round" filter="url(#nb-glow)" opacity="0.55"/>

    <!-- Mic body -->
    <rect x="126" y="112" width="28" height="44" rx="14" fill="url(#nb-micGrad)" filter="url(#nb-micGlow)"/>

    <!-- Mic arc -->
    <path d="M 112,152 Q 112,178 140,178 Q 168,178 168,152" fill="none" stroke="url(#nb-micGrad)" stroke-width="2.5" stroke-linecap="round" filter="url(#nb-glow)"/>

    <!-- Mic stand -->
    <line x1="140" y1="178" x2="140" y2="190" stroke="url(#nb-micGrad)" stroke-width="2.5" stroke-linecap="round" filter="url(#nb-glow)"/>
    <line x1="126" y1="190" x2="154" y2="190" stroke="url(#nb-micGrad)" stroke-width="2.5" stroke-linecap="round" filter="url(#nb-glow)"/>
  </svg>

  <!-- Wordmark -->
  <span class="ml-2 font-extrabold tracking-tight text-base sm:text-lg leading-none"
    :class="theme.isDark ? 'text-white' : 'text-gray-900'">
    Dub<span class="bg-gradient-to-r from-pink-500 via-orange-400 to-pink-500 bg-clip-text text-transparent">ora</span>
    <span class="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent"> AI</span>
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
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
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
              class="px-4 py-1.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200">
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
            <div class="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
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
            class="block text-center mt-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-lg shadow-indigo-500/30 transition-all duration-200">
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
