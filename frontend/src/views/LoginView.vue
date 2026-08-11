<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-20">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg shadow-indigo-500/30">🎙️</div>
        <h2 class="text-3xl font-extrabold mb-1" :class="theme.isDark ? 'text-white' : 'text-gray-900'">Welcome back</h2>
        <p class="text-sm" :class="theme.isDark ? 'text-gray-500' : 'text-gray-600'">Sign in to your Dubora AI account</p>
      </div>

      <div class="border rounded-2xl p-8"
        :class="theme.isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'">

        <p v-if="auth.error" class="mb-4 text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
          {{ auth.error }}
        </p>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1.5" :class="theme.isDark ? 'text-gray-300' : 'text-gray-700'">Email</label>
            <input v-model="email" type="email" required placeholder="you@example.com"
              class="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              :class="theme.isDark ? 'bg-gray-800 border border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400'" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1.5" :class="theme.isDark ? 'text-gray-300' : 'text-gray-700'">Password</label>
            <input v-model="password" type="password" required placeholder="••••••••"
              class="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              :class="theme.isDark ? 'bg-gray-800 border border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400'" />
          </div>
          <button type="submit" :disabled="auth.loading"
            class="w-full bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-50 rounded-xl py-3 font-bold text-sm text-white transition shadow-lg shadow-indigo-500/30">
            {{ auth.loading ? "Signing in…" : "Sign In →" }}
          </button>
        </form>
      </div>

      <p class="mt-6 text-center text-sm" :class="theme.isDark ? 'text-gray-500' : 'text-gray-600'">
        No account?
        <RouterLink to="/register" class="text-indigo-400 hover:underline font-medium">Create one free</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from "../stores/auth.js";
import { useThemeStore } from "../stores/theme.js";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();
const email = ref("");
const password = ref("");

const handleLogin = async () => {
  const ok = await auth.login(email.value, password.value);
  if (ok) router.push("/dashboard");
};
</script>
