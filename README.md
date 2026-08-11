# Dubora AI

Upload a video → transcribe it → figure out who's speaking → translate the
dialogue into 12 languages → dub it with a distinct AI voice per speaker.

Built on the same architecture as Transcripto AI (Vue 3 + Pinia frontend,
Express + Mongoose backend, Cloudinary storage, Groq for transcription and
translation), extended with speaker diarization and ElevenLabs text-to-speech
for the dubbing step.

## Stack

- **Frontend:** Vue 3, Pinia, Vue Router, Tailwind, Vite
- **Backend:** Node/Express 5, Mongoose, MongoDB
- **Storage:** Cloudinary (video + burned/dubbed output)
- **AI:** Groq Whisper large-v3 (transcription), Groq LLaMA 3.3 70B
  (translation + best-effort speaker labeling), ElevenLabs (multilingual TTS)
- **Media:** fluent-ffmpeg / ffmpeg-static / ffprobe-static (audio
  extraction, subtitle burning, TTS time-fitting, audio/video muxing)

## How dubbing works

1. **Transcribe** (`backend/utils/whisper.js`) — Groq Whisper returns
   timestamped segments.
2. **Diarize** (`backend/utils/diarize.js`) — Whisper doesn't identify
   speakers, so a silence-gap heuristic plus a Groq LLaMA pass labels each
   segment `SPEAKER_1`, `SPEAKER_2`, etc. This is best-effort (real
   diarization needs voice embeddings from the raw audio); it works well for
   clearly-alternating dialogue and correctly collapses to one speaker for
   single-narrator video.
3. **Translate** (`backend/controllers/translateController.js`) — optional;
   carries speaker labels through unchanged.
4. **Cast** — each detected speaker is assigned an ElevenLabs voice
   (auto-assigned round-robin by default, or picked by hand in the UI).
5. **Dub** (`backend/controllers/dubController.js`) — synthesizes each line
   with its speaker's voice, speeds up (never slows down, capped at 1.6×)
   any line that would otherwise run into the next one, mixes all lines onto
   one audio track at their real timestamps, and muxes that over the
   original video (video stream untouched).

## Local setup

```sh
# Backend
cd backend
npm install
cp config/config.env.example config/config.env   # if you renamed it — otherwise just fill in config/config.env
npm run dev        # http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Fill in `backend/config/config.env` with your own keys — **do not commit
real secrets**, that file is already gitignored:

| Variable | Used for |
|---|---|
| `DB_LOCAL_URI` / `DB_URI` | MongoDB connection string (local vs. production) |
| `JWT_SECRET` | Auth token signing |
| `CLOUDINARY_*` | Video storage |
| `GROQ_API_KEY` | Transcription, translation, speaker labeling |
| `ELEVENLABS_API_KEY` | Dubbing (text-to-speech) |

Without `ELEVENLABS_API_KEY` set, voice casting falls back to a small
curated list of default ElevenLabs voice IDs but TTS calls themselves will
still fail — you need a real key to actually generate dubs.

## Deploying to Vercel

The backend deploys as a serverless function, same pattern as Transcripto AI:

- `backend/api/index.js` re-exports the Express `app`.
- `backend/vercel.json` rewrites all requests to that function and bundles
  `fonts/**` (used for subtitle burning) into the function's filesystem.
- Vercel's filesystem is read-only except `/tmp` — every temp file
  (extracted audio, TTS clips, burned/dubbed output) is written there and
  uploaded to Cloudinary before the function responds, since Vercel can
  freeze a function immediately after sending a response.
- Set every variable from the table above in **Project Settings →
  Environment Variables** (not in a committed `config.env`).
- Deploy the frontend separately (its own Vercel project, or any static
  host) with `VITE_API_URL` pointing at the backend's deployed URL, and
  update `allowedOrigins` in `backend/app.js` to include the frontend's
  real domain — CORS will silently reject the frontend otherwise.

## Project structure

```
backend/
  controllers/   authController, videoController, captionController,
                 transcribeController, translateController, dubController
  models/        User, Video, Caption
  routes/        auth, video, caption, translate, dub
  middlewares/   auth (isAuthenticatedUser / identifyUser), errors
  utils/         whisper, diarize, elevenlabs, videoSource, localStorage,
                 ownership, jwtToken, errorHandler
frontend/
  src/stores/    auth, video (Pinia)
  src/views/     Home, About, Login, Register, Dashboard, Upload, Video
  src/api/       axios (backend client), cloudinary (direct upload)
```
