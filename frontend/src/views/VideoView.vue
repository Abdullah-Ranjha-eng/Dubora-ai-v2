<template>
  <main class="max-w-5xl mx-auto px-6 pt-32 pb-16">
    <LoadingSpinner v-if="store.loading && !store.currentVideo" />

    <template v-else-if="store.currentVideo">
      <div class="flex items-center gap-3 mb-6">
        <RouterLink to="/dashboard" class="text-sm text-gray-500 hover:text-orange-400">← Dashboard</RouterLink>
        <span class="text-gray-700">/</span>
        <h1 class="text-xl font-bold truncate">{{ store.currentVideo.title }}</h1>
        <span class="text-xs px-2 py-0.5 rounded-full ml-auto" :class="statusClass(store.currentVideo.status)">
          {{ store.currentVideo.status }}
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Left: video player -->
        <div class="space-y-4">
          <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden aspect-video">
            <video v-if="activeVideoUrl" :src="activeVideoUrl" controls class="w-full h-full object-contain" />
            <div v-else-if="isThisVideoUploading" class="w-full h-full flex flex-col items-center justify-center gap-3 px-8">
              <span class="text-3xl">📤</span>
              <div class="w-full max-w-xs">
                <div class="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Uploading video…</span>
                  <span class="font-semibold text-orange-400">{{ store.uploadProgress }}%</span>
                </div>
                <div class="w-full rounded-full h-2 overflow-hidden bg-gray-800">
                  <div class="h-full rounded-full bg-gradient-to-r from-orange-500 to-pink-400 transition-all duration-200"
                    :style="{ width: store.uploadProgress + '%' }"></div>
                </div>
              </div>
              
            </div>
            <div v-else-if="store.uploadFailed" class="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-8">
              <span class="text-3xl">⚠️</span>
              <p class="text-sm text-red-400">Video upload failed. Please delete this and try again.</p>
            </div>
            <div v-else class="w-full h-full flex items-center justify-center text-gray-600 text-4xl">🎬</div>
          </div>

          <!-- Background cloud sync indicator (video already plays locally, this is just informational) -->
          <p v-if="activeCloudStatus === 'uploading' || activeCloudStatus === 'pending'"
            class="text-xs text-gray-500 flex items-center gap-1.5">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
            Saving to cloud storage in the background…
          </p>

          <!-- Toggle original / dubbed -->
          <div v-if="store.currentVideo.dubbedVideo?.url" class="flex gap-2">
            <button @click="activeView = 'original'"
              :class="activeView === 'original' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'"
              class="flex-1 py-2 rounded-lg text-sm font-medium transition">Original</button>
            <button @click="activeView = 'dubbed'"
              :class="activeView === 'dubbed' ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-400'"
              class="flex-1 py-2 rounded-lg text-sm font-medium transition">Dubbed 🎙️</button>
          </div>

          <!-- Action buttons -->
          <!-- Nothing in this block appears until the video itself has
               finished uploading (videoReady — see its definition below for
               why that's checked via activeVideoUrl and not `status`) —
               captions/translate/burn only make sense once there's a
               finished video to work with, so we gate the whole sequence on
               that first instead of racing it. -->
          <div v-if="!videoReady" class="rounded-lg py-2.5 text-sm text-center text-gray-500 bg-gray-900/60 border border-gray-800">
            <span v-if="store.uploadFailed">Video upload failed — captions and dubbing aren't available until it's re-uploaded.</span>
            <span v-else>Waiting for the video to finish uploading before captions can be generated…</span>
          </div>
          <div v-else class="grid grid-cols-2 gap-2">
            <button v-if="!hasCaptions" @click="handleGenerate"
              :disabled="store.loading"
              class="col-span-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 rounded-lg py-2.5 text-sm font-semibold transition">
              {{ store.loading && step === 'generate' ? "Generating…" : "🎙️ Generate Captions" }}
            </button>

            <template v-if="hasCaptions">
              <!-- Translate -->
              <div class="col-span-2 flex gap-2">
                <select v-model="targetLang" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">Select language…</option>
                  <option v-for="l in LANGUAGES" :key="l">{{ l }}</option>
                </select>
                <button @click="handleTranslate"
                  :disabled="!targetLang || store.loading"
                  class="px-4 bg-pink-700 hover:bg-pink-600 disabled:opacity-40 rounded-lg text-sm font-semibold transition">
                  {{ store.loading && step === 'translate' ? "…" : "Translate" }}
                </button>
              </div>

              <!-- Dub — voice casting happens inline per-line in the Caption
                   Editor now (see speakerVoiceMap), so this just saves
                   whatever's currently picked there and dubs. -->
              <button @click="handleDub"
                :disabled="store.dubbing"
                class="col-span-2 bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 disabled:opacity-40 rounded-lg py-2.5 text-sm font-semibold transition">
                {{ store.dubbing ? "Dubbing… (this can take a minute)" : "🎭 AI Dub" }}
              </button>

              <!-- Download -->
              <div class="relative col-span-2" ref="dlMenu">
                <button @click="showDlMenu = !showDlMenu"
                  class="w-full bg-gray-800 hover:bg-gray-700 rounded-lg py-2.5 text-sm font-semibold transition">
                  📥 Download ▾
                </button>
                <div v-if="showDlMenu"
                  class="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden z-10 shadow-xl">
                  <button @click="dl('srt')"    class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700">Download SRT</button>
                  <button @click="dl('txt')"    class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700">Download TXT</button>
                  <template v-if="targetLang">
                    <div class="border-t border-gray-700 my-1"></div>
                    <button @click="dl('srt', targetLang)" class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700">{{ targetLang }} SRT</button>
                    <button @click="dl('txt', targetLang)" class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700">{{ targetLang }} TXT</button>
                  </template>
                </div>
              </div>
            </template>
          </div>

          <p v-if="store.error" class="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {{ store.error }}
          </p>
          <p v-if="successMsg" class="text-sm text-green-400 bg-green-900/20 border border-green-800 rounded-lg px-3 py-2">
            {{ successMsg }}
          </p>
        </div>

        <!-- Right: caption editor -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-sm text-gray-300">Caption Editor</h2>
            <button v-if="hasCaptions && captionsEdited"
              @click="handleSave"
              :disabled="store.loading"
              class="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg font-medium transition">
              Save Changes
            </button>
          </div>

          <p v-if="!videoReady" class="text-gray-600 text-sm text-center my-auto">
            Waiting for the video to finish uploading…
          </p>
          <p v-else-if="!hasCaptions" class="text-gray-600 text-sm text-center my-auto">
            Generate captions to see them here.
          </p>

          <div v-else class="overflow-y-auto flex-1 space-y-2 max-h-[500px] pr-1">
            <div v-for="(cap, i) in editableCaptions" :key="i"
              class="bg-gray-800 rounded-xl p-3 flex gap-3 items-start">
              <span class="text-xs text-gray-500 shrink-0 mt-0.5 w-8 text-right">{{ i + 1 }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="text-xs text-indigo-400">{{ fmtTime(cap.start) }} → {{ fmtTime(cap.end) }}</span>

                  <!-- Editable speaker — pick an existing speaker or add a
                       new one. Options always come from `speakers` (derived
                       live from editableCaptions) or the auto-generated
                       nextSpeakerLabel(), so a line can never end up on a
                       speaker label that conflicts with / duplicates
                       another one already in the doc. -->
                  <select :value="cap.speaker || 'SPEAKER_1'" @change="onSpeakerChange(cap, $event.target.value)"
                    class="text-[10px] font-medium rounded-full px-2 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    :class="speakerColor(cap.speaker)">
                    <option v-for="sp in speakers" :key="sp" :value="sp">{{ speakerLabel(sp) }}</option>
                    <option value="__new__">+ New speaker</option>
                  </select>

                  <!-- Voice for this speaker — Male 1/2, Female 1/2 (from
                       whichever voices the /voices catalog returned).
                       Changing it here updates speakerVoiceMap for every
                       line spoken by this same speaker, since a voice is
                       cast per-speaker, not per-line. -->
                  <select :value="speakerVoiceMap[cap.speaker || 'SPEAKER_1']"
                    @change="onVoiceChange(cap.speaker || 'SPEAKER_1', $event.target.value)"
                    class="text-xs bg-gray-700 border border-gray-600 rounded-lg px-2 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                    <option v-for="o in voiceOptions" :key="o.voiceId" :value="o.voiceId">{{ o.label }}</option>
                  </select>
                </div>
                <textarea v-model="cap.text" rows="2"
                  class="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
                  @input="captionsEdited = true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <p v-else class="text-center text-gray-500 py-20">Video not found.</p>
  </main>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useVideoStore } from "../stores/video.js";
import LoadingSpinner from "../components/LoadingSpinner.vue";

const store = useVideoStore();
const route = useRoute();
const videoId = route.params.id;

const LANGUAGES = ["Arabic","French","Spanish","German","English","Urdu","Hindi","Chinese","Turkish","Russian","Italian","Portuguese","Japanese"];

const activeView = ref("original"); // "original" | "dubbed"
const targetLang = ref("");
const step = ref("");
const successMsg = ref("");
const showDlMenu = ref(false);
const captionsEdited = ref(false);
const editableCaptions = ref([]);
const speakerVoiceMap = ref({}); // { SPEAKER_1: voiceId, ... }

const activeVideoUrl = computed(() => {
  if (activeView.value === "dubbed") return store.currentVideo?.dubbedVideo?.url;
  return store.currentVideo?.originalVideo?.url;
});

const activeCloudStatus = computed(() => {
  if (activeView.value === "dubbed") return store.currentVideo?.dubbedVideo?.cloudStatus;
  return store.currentVideo?.originalVideo?.cloudStatus;
});

// True only while THIS video (not some other one the store might still be
// tracking from a prior upload) is mid-upload — i.e. we navigated here
// straight from the upload form and runVideoUpload hasn't finalized yet.
const isThisVideoUploading = computed(() =>
  store.currentVideo?._id === videoId &&
  store.currentVideo?.status === "uploading" &&
  !activeVideoUrl.value
);

// The video's `status` field moves to "captioned" as soon as the background
// audio-transcription pipeline finishes — which races independently of, and
// often finishes before, the actual video upload to Cloudinary. So status
// alone can't tell us the video is ready; it only tells us captions might
// be. The one thing that actually means "the video finished uploading" is
// having a real URL to play, which is exactly what finalizeVideo sets.
const videoReady = computed(() => !!activeVideoUrl.value);

// store.captions can be a truthy Caption document with an empty `captions`
// array (e.g. a doc created before every segment was filtered out, or one
// a background pass upserted without content yet) — every gate below needs
// to check there's actually something in it, not just that the object
// exists, or the UI shows Translate with nothing to act on and the
// server correctly 404s when you click them.
const hasCaptions = computed(() => !!store.captions?.captions?.length);

// Poll while the original video is still syncing to Cloudinary in the
// background, so the badge above clears and the URL swaps over
// automatically once done.
let pollTimer = null;
const startPollingIfNeeded = () => {
  const stillSyncing = ["pending", "uploading"].includes(store.currentVideo?.originalVideo?.cloudStatus);

  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (!stillSyncing) return;

  pollTimer = setInterval(async () => {
    await store.refreshVideoQuietly(videoId);
    const done = !["pending", "uploading"].includes(store.currentVideo?.originalVideo?.cloudStatus);
    if (done && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }, 4000);
};

watch(() => store.currentVideo?.status, startPollingIfNeeded);

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
};

const statusClass = (s) => ({
  uploading:  "bg-orange-900 text-orange-300",
  uploaded:   "bg-gray-700 text-gray-300",
  processing: "bg-yellow-800 text-yellow-300",
  captioned:  "bg-blue-800 text-blue-300",
  translated: "bg-purple-800 text-purple-300",
  burned:     "bg-green-800 text-green-300",
  dubbing:    "bg-pink-900 text-pink-300",
  dubbed:     "bg-pink-800 text-pink-300",
}[s] || "bg-gray-700 text-gray-300");

// Distinct speakers found in the currently-loaded caption doc, in first-
// appearance order — drives the caption editor's speaker dropdowns and the
// per-speaker voice pickers.
const speakers = computed(() => {
  const seen = [];
  for (const c of editableCaptions.value) {
    const sp = c.speaker || "SPEAKER_1";
    if (!seen.includes(sp)) seen.push(sp);
  }
  return seen;
});

const speakerLabel = (sp) => (sp || "SPEAKER_1").replace("SPEAKER_", "Speaker ");

// Generates a brand-new speaker label that can't collide with one already
// in the doc — checks membership rather than just using speakers.length+1,
// since a doc could have gaps (e.g. SPEAKER_1 and SPEAKER_3 only, after
// manual reassignment merged SPEAKER_2 into one of the others).
const nextSpeakerLabel = () => {
  let n = speakers.value.length + 1;
  while (speakers.value.includes(`SPEAKER_${n}`)) n++;
  return `SPEAKER_${n}`;
};

// Reassigns a caption line to a different (or brand-new) speaker. Only ever
// writes a label that's either already known (picked from the dropdown, so
// it exactly matches an existing speaker) or freshly minted by
// nextSpeakerLabel() — never free-typed — so speaker identities can't drift
// into near-duplicates ("Speaker 2" vs "SPEAKER_2" vs "speaker2") the way a
// text input would allow.
const onSpeakerChange = (cap, value) => {
  const speaker = value === "__new__" ? nextSpeakerLabel() : value;
  cap.speaker = speaker;
  if (!(speaker in speakerVoiceMap.value)) {
    speakerVoiceMap.value[speaker] = voiceOptions.value[0]?.voiceId || "";
  }
  captionsEdited.value = true;
};

// Cycles through a small fixed palette so the same speaker keeps the same
// color across the editor without needing a lookup table maintained by hand.
const SPEAKER_COLORS = [
  "bg-orange-900 text-orange-300",
  "bg-pink-900 text-pink-300",
  "bg-emerald-900 text-emerald-300",
  "bg-amber-900 text-amber-300",
  "bg-sky-900 text-sky-300",
  "bg-purple-900 text-purple-300",
];
const speakerColor = (sp) => {
  const idx = speakers.value.indexOf(sp);
  return SPEAKER_COLORS[idx >= 0 ? idx % SPEAKER_COLORS.length : 0];
};

// Simplified voice picker: up to 2 male + 2 female voices from whatever the
// /voices catalog returned (real ElevenLabs account voices, or the curated
// fallback — see backend/utils/elevenlabs.js), labeled "Male 1"/"Male 2"/
// "Female 1"/"Female 2" instead of showing raw ElevenLabs voice names.
const voiceOptions = computed(() => {
  const byGender = (g) => store.voices.filter((v) => (v.gender || "").toLowerCase() === g).slice(0, 2);
  const label = (list, prefix) => list.map((v, i) => ({ voiceId: v.voiceId, label: `${prefix} ${i + 1}` }));
  return [...label(byGender("male"), "Male"), ...label(byGender("female"), "Female")];
});

// Casts a voice for every line spoken by `speaker` at once — voice is a
// per-speaker property (see Caption.speakerVoices on the backend), not
// per-line, so changing it on one caption row updates every other row with
// the same speaker too.
const onVoiceChange = (speaker, voiceId) => {
  speakerVoiceMap.value[speaker] = voiceId;
};

watch(() => store.captions, (val) => {
  if (val?.captions?.length) {
    editableCaptions.value = val.captions.map((c) => ({ ...c }));
    captionsEdited.value = false;

    // Seed the voice picker from whatever's already cast for this caption
    // doc; any speaker without a saved voice yet falls back to the first
    // available voice option so the dropdown is never empty.
    const saved = new Map((val.speakerVoices || []).map((sv) => [sv.speaker, sv.voiceId]));
    const map = {};
    for (const c of val.captions) {
      const sp = c.speaker || "SPEAKER_1";
      if (!(sp in map)) map[sp] = saved.get(sp) || voiceOptions.value[0]?.voiceId || "";
    }
    speakerVoiceMap.value = map;
  } else {
    editableCaptions.value = [];
    speakerVoiceMap.value = {};
  }
}, { immediate: true });

const flash = (msg) => {
  successMsg.value = msg;
  setTimeout(() => { successMsg.value = ""; }, 4000);
};

const handleGenerate = async () => {
  step.value = "generate";
  const ok = await store.generateCaptions(videoId);
  if (ok) flash("Captions generated successfully!");
};

const handleTranslate = async () => {
  if (!targetLang.value) return;
  step.value = "translate";
  const ok = await store.translateCaptions(videoId, targetLang.value);
  if (ok) flash(`Translated to ${targetLang.value}!`);
};

// Saves whatever voices are currently picked in the caption editor's
// per-line dropdowns. Called internally by handleDub right before dubbing
// so what the user sees cast is exactly what gets used — no separate "Save
// Casting" step needed anymore.
const handleSaveCasting = async () => {
  const language = targetLang.value || store.currentVideo.detectedLanguage || "en";
  const speakerVoicesArray = Object.entries(speakerVoiceMap.value).map(([speaker, voiceId]) => ({
    speaker,
    voiceId,
    name: store.voices.find((v) => v.voiceId === voiceId)?.name || "",
  }));
  return store.setSpeakerVoices(videoId, language, speakerVoicesArray);
};

const handleDub = async () => {
  await handleSaveCasting();
  const language = targetLang.value || store.currentVideo.detectedLanguage || "en";
  const result = await store.dubVideo(videoId, language);
  if (result) {
    activeView.value = "dubbed";
    flash("Video dubbed successfully!");
  }
};

const handleSave = async () => {
  const ok = await store.updateCaptions(videoId, editableCaptions.value);
  if (ok) { captionsEdited.value = false; flash("Captions saved!"); }
};

const dl = (format, lang = null) => {
  store.downloadCaptions(videoId, format, lang);
  showDlMenu.value = false;
};

// close dropdown on outside click
const dlMenu = ref(null);
const onClickOutside = (e) => {
  if (dlMenu.value && !dlMenu.value.contains(e.target)) showDlMenu.value = false;
};

onMounted(async () => {
  // If we just came from the upload form, store.currentVideo/captions for
  // this exact id are already live and being updated in place by the
  // background pipelines — re-fetching here would race a 404 (captions
  // not saved yet) against them and could momentarily clobber the state.
  const alreadyTracking = store.currentVideo?._id === videoId;
  if (!alreadyTracking) {
    await store.fetchVideo(videoId);
    await store.fetchCaptions(videoId);
  }
  await store.fetchVoices();
  document.addEventListener("click", onClickOutside);
  startPollingIfNeeded();
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickOutside);
  if (pollTimer) clearInterval(pollTimer);
});
</script>