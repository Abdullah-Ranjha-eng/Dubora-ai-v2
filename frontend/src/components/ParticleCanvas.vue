<template>
  <canvas ref="canvas" class="fixed inset-0 w-full h-full pointer-events-none" style="z-index:0" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useThemeStore } from "../stores/theme.js";

const canvas = ref(null);
const theme = useThemeStore();
let animId = null;
let mouse = { x: -999, y: -999 };

onMounted(() => {
  const c = canvas.value;
  const ctx = c.getContext("2d");
  let W, H, particles = [];

  const resize = () => {
    W = c.width  = window.innerWidth;
    H = c.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

  const COUNT = window.innerWidth < 640 ? 45 : window.innerWidth < 1024 ? 80 : 130;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (let i = 0; i < COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 80 + Math.random() * Math.min(window.innerWidth, window.innerHeight) * 0.42;
    particles.push({
      x: window.innerWidth / 2 + Math.cos(angle) * radius * (0.9 + Math.random()),
      y: window.innerHeight / 2 + Math.sin(angle) * radius * 0.6,
      ox: 0, oy: 0,
      size: 2 + Math.random() * 3,
      speed: 0.003 + Math.random() * 0.006,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() > 0.5 ? "255,122,26" : "255,45,120",
      alpha: 0.3 + Math.random() * 0.5,
    });
    particles[i].ox = particles[i].x;
    particles[i].oy = particles[i].y;
  }

  let t = 0;
const draw = () => {
  ctx.clearRect(0, 0, W, H);
  t += 0.008;

  const alphaMultiplier = theme.isDark ? 1 : 0.5;
  const getColor = (p) => theme.isDark ? p.color : (p.color === "255,122,26" ? "224,100,10" : "190,24,93");

  particles.forEach((p) => {
    p.x = p.ox + Math.sin(t * p.speed * 200 + p.phase) * 18;
    p.y = p.oy + Math.cos(t * p.speed * 150 + p.phase) * 10;

    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const repel = 120;
    if (dist < repel) {
      const force = (repel - dist) / repel;
      p.x += (dx / dist) * force * 40;
      p.y += (dy / dist) * force * 40;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${getColor(p)},${p.alpha * alphaMultiplier})`;
    ctx.fill();
  });

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 110) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(224,100,10,${0.15 * alphaMultiplier * (1 - dist / 110)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }

  if (!prefersReducedMotion) {
    animId = requestAnimationFrame(draw);
  }
};

  draw(); // always draw one frame; loop above only continues if motion isn't reduced
  onBeforeUnmount(() => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", resize);
  });
});
</script>
