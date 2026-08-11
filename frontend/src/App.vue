<template>
  <div class="min-h-screen transition-colors duration-300"
    :class="theme.isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'">
    <Navbar />
    <RouterView />
    <AppFooter />
  </div>
</template>

<script setup>
import Navbar from "./components/Navbar.vue";
import AppFooter from "./components/AppFooter.vue";
import { useThemeStore } from "./stores/theme.js";
const theme = useThemeStore();
</script>
