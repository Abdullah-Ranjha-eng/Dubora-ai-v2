import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import "./assets/main.css";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// Boot theme before mount so no flash
import { useThemeStore } from "./stores/theme.js";
useThemeStore();

app.mount("#app");
