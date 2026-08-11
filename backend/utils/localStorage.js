import fs from "fs";
import path from "path";

// backend/uploads/videos  → original uploads (disk storage target for multer)
// backend/uploads/burned  → burned-caption outputs
export const UPLOADS_ROOT   = path.join(process.cwd(), "backend", "uploads");
export const VIDEOS_DIR     = path.join(UPLOADS_ROOT, "videos");
export const BURNED_DIR     = path.join(UPLOADS_ROOT, "burned");

export const ensureUploadDirs = () => {
  if (process.env.VERCEL) return; // Vercel's filesystem is read-only except /tmp; Cloudinary handles storage there
  [UPLOADS_ROOT, VIDEOS_DIR, BURNED_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
};

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

// Turns an absolute local path under backend/uploads into a URL the frontend can hit
export const toPublicUrl = (absPath) => {
  const relative = path.relative(UPLOADS_ROOT, absPath).split(path.sep).join("/");
  return `${BACKEND_URL}/uploads/${relative}`;
};

export const safeUnlink = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, () => {}); // best-effort, ignore errors (already gone, in use, etc.)
};

// dir: VIDEOS_DIR or BURNED_DIR. Returns the absolute path for a stored filename.
export const localPathFor = (dir, filename) => path.join(dir, filename);