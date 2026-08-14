import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve the .env path relative to THIS file, not process.cwd(). Previously
// this was the hardcoded relative string "backend/config/config.env", which
// only worked when the process happened to be started from the repo root.
// Starting it from inside backend/ (e.g. `cd backend && npm run dev`) made
// dotenv silently fail to find the file, leaving every env var (DB_URI,
// JWT_SECRET, etc.) undefined — which is what caused the
// "users.insertOne() buffering timed out" errors.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envResult = dotenv.config({ path: path.join(__dirname, "config/config.env") });

if (envResult.error) {
  console.warn(
    `[config] Could not load config/config.env (${envResult.error.message}). ` +
    `Falling back to whatever environment variables are already set on the process ` +
    `(this is expected on Vercel — set them in Project Settings → Environment Variables).`
  );
}

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connectDatabase } from "./config/dbConnect.js";
import errorMiddleware from "./middlewares/errors.js";
import { ensureUploadDirs, UPLOADS_ROOT } from "./utils/localStorage.js";

ensureUploadDirs(); // no-op on Vercel — see utils/localStorage.js

// Routes
import authRoutes from "./routes/auth.js";
import videoRoutes from "./routes/video.js";
import captionRoutes from "./routes/caption.js";
import translateRoutes from "./routes/translate.js";
import dubRoutes from "./routes/dub.js";

process.on("uncaughtException", (err) => {
  // CHANGED: log the full stack, not just err.message — the message alone
  // gives no way to tell WHICH line/module actually failed. This matters a
  // lot here specifically because...
  console.error("[uncaughtException]", err.stack || err);
  if (!process.env.VERCEL) process.exit(1);
});

const dbUriInUse = process.env.NODE_ENV === "DEVELOPMENT" ? process.env.DB_LOCAL_URI : process.env.DB_URI;
if (!dbUriInUse) {
  console.error(
    "[db] No Mongo connection string found in the environment " +
    `(NODE_ENV="${process.env.NODE_ENV}", expected ${process.env.NODE_ENV === "DEVELOPMENT" ? "DB_LOCAL_URI" : "DB_URI"}). ` +
    "Every DB-touching request will hang for 10s and fail with a buffering timeout until this is fixed."
  );
}

const dbConnectionPromise = connectDatabase();

const app = express();

// Works locally (Vite dev server) and in production (deployed frontend).
// This must be the FRONTEND's origin — no trailing slash, since browsers
// never send one in the Origin header, so a mismatched slash silently
// breaks every CORS check.
const allowedOrigins = [
  "http://localhost:5173",
  "https://dubora-ai-v2.vercel.app",
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));
app.use(cookieParser());

// Serves backend/uploads/videos and backend/uploads/burned so locally-saved
// files are watchable immediately, before/without waiting on Cloudinary.
app.use("/uploads", express.static(UPLOADS_ROOT));

// Wait for the (cached, resolved-once) DB connection before touching any
// route that needs it. Without this, on a cold start, a request could reach
// a Mongo query before the connection has finished — Mongoose then buffers
// the operation and only waits up to its default 10s timeout, which can be
// tighter than a genuinely slow cold-start handshake to Atlas. Explicitly
// awaiting the same promise here removes that race and gives a clear 503
// instead of a cryptic "buffering timed out" error.
app.use("/api/v1", async (req, res, next) => {
  const connected = await dbConnectionPromise;
  if (!connected) {
    return res.status(503).json({
      success: false,
      message: "Database temporarily unavailable. Please try again in a moment.",
    });
  }
  next();
});

app.use("/api/v1", authRoutes);
app.use("/api/v1", videoRoutes);
app.use("/api/v1", captionRoutes);
app.use("/api/v1", translateRoutes);
app.use("/api/v1", dubRoutes);

app.use(errorMiddleware);

// On Vercel, the platform invokes the exported app directly as a request
// handler — app.listen() is only for local/traditional server environments.
if (!process.env.VERCEL) {
  dbConnectionPromise.then((connected) => {
    if (!connected) {
      console.error("[db] Startup aborted: could not connect to MongoDB. Fix the connection string / network access and try again.");
      process.exit(1);
    }

    const server = app.listen(process.env.PORT, () => {
      console.log(`Server on PORT ${process.env.PORT} in ${process.env.NODE_ENV} mode.`);
    });

    process.on("unhandledRejection", (err) => {
      // ...an unhandledRejection ANYWHERE in the app (a stray promise in
      // the video-download stream, the @gradio/client connection during a
      // Zero-GPU cold start, etc.) kills the ENTIRE server process here —
      // not just the one in-flight request. Every client connected at that
      // moment (including whatever request triggered it) sees its
      // connection abruptly severed, which is exactly what shows up in the
      // browser as a generic "aborted" network error, with no indication
      // it was actually a full server crash. Logging the full stack (not
      // just err.message, which was here before) is what makes it possible
      // to actually find and fix the real source next time this fires,
      // instead of just seeing "aborted" with no further clues.
      console.error("[unhandledRejection]", err.stack || err);
      server.close(() => process.exit(1));
    });
  });
}

export default app;