import Caption from "../models/caption.js";
import Video from "../models/video.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import cloudinary from "cloudinary";
import { safeUnlink } from "../utils/localStorage.js";
import { transcribeAudioFile } from "../utils/whisper.js";
import { ownerFields, isOwner } from "../utils/ownership.js";
import { getLocalOriginalPath } from "../utils/videoSource.js";


ffmpeg.setFfmpegPath(ffmpegPath);

// Resolved relative to THIS file, not process.cwd() — cwd isn't guaranteed
// to be the function's project root inside Vercel's bundle, the same class
// of bug the config.env loading in app.js had to work around.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "../fonts");

// A single font file only has glyphs for the script(s) it was designed for.
// "Noto Nastaliq Urdu" covers Arabic-script text (Arabic, Urdu, Persian...)
// but nothing else — burning Hindi (Devanagari), Chinese (CJK), Russian
// (Cyrillic), etc. through that one font renders "tofu" placeholder boxes
// for every glyph it doesn't have. So instead of one hardcoded font, we
// scan the caption text's actual Unicode ranges and pick a font that
// covers what's really there. All of these files must exist under
// backend/fonts/ — see backend/fonts/PUT_FONT_HERE.txt for download links.
const SCRIPT_FONTS = [
  {
    name: "arabic",
    // Arabic + Arabic Presentation Forms — covers Arabic and Urdu text.
    test: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/,
    file: "NotoNastaliqUrdu-Regular.ttf",
    family: "Noto Nastaliq Urdu",
  },
  {
    name: "devanagari",
    // Hindi and related languages.
    test: /[\u0900-\u097F]/,
    file: "NotoSansDevanagari-Regular.ttf",
    family: "Noto Sans Devanagari",
  },
  {
    name: "cjk",
    // Chinese (and CJK-shared ideographs).
    test: /[\u4E00-\u9FFF\u3400-\u4DBF]/,
    file: "NotoSansSC-Regular.ttf",
    family: "Noto Sans SC",
  },
  {
    name: "japanese",
    // Hiragana / Katakana — checked separately from CJK so Japanese (which
    // mixes kana with kanji) gets the JP-specific font, not the SC one.
    test: /[\u3040-\u30FF]/,
    file: "NotoSansJP-Regular.ttf",
    family: "Noto Sans JP",
  },
  {
    name: "cyrillic",
    // Russian and related languages.
    test: /[\u0400-\u04FF]/,
    file: "NotoSans-Regular.ttf",
    family: "Noto Sans",
  },
];

// Default: Latin script (English, French, Spanish, German, Turkish,
// Italian, Portuguese) plus anything that matched nothing above.
const DEFAULT_FONT = { name: "latin", file: "NotoSans-Regular.ttf", family: "Noto Sans" };

// Scans the concatenated caption text and returns the font entry for
// whichever non-Latin script appears most. Falls back to DEFAULT_FONT for
// plain Latin text (or if the matching font isn't actually on disk, so a
// missing download doesn't silently break every burn — just non-Latin ones).
const pickFontForCaptions = (captions) => {
  const sample = captions.map((c) => c.text).join(" ");

  let best = null;
  let bestCount = 0;
  for (const script of SCRIPT_FONTS) {
    const matches = sample.match(new RegExp(script.test, "g"));
    const count = matches ? matches.length : 0;
    if (count > bestCount) {
      best = script;
      bestCount = count;
    }
  }

  const chosen = best || DEFAULT_FONT;
  const fontPath = path.join(FONTS_DIR, chosen.file);
  if (!fs.existsSync(fontPath)) {
    console.warn(
      `[burnCaptions] Font file missing: ${fontPath} (needed for "${chosen.name}" script). ` +
      `Falling back to ${DEFAULT_FONT.family} — non-Latin glyphs may render as boxes. ` +
      `See backend/fonts/PUT_FONT_HERE.txt for download links.`
    );
    return DEFAULT_FONT;
  }
  return chosen;
};

// Helper: build .srt content from captions array
const toSRT = (captions) => {
  const pad = (n) => String(Math.floor(n)).padStart(2, "0");
  const toTimecode = (secs) => {
    const h = pad(secs / 3600);
    const m = pad((secs % 3600) / 60);
    const s = pad(secs % 60);
    const ms = String(Math.round((secs % 1) * 1000)).padStart(3, "0");
    return `${h}:${m}:${s},${ms}`;
  };
  return captions
    .map((c, i) => `${i + 1}\n${toTimecode(c.start)} --> ${toTimecode(c.end)}\n${c.text}`)
    .join("\n\n");
};

// Helper: build .ass content from captions array, with the chosen font baked
// into the [V4+ Styles] header.
//
// WHY ASS INSTEAD OF SRT FOR BURNING: ffmpeg's `subtitles` filter (which
// consumes .srt) hardcodes libass to "simple" (FriBidi-only) shaping — that
// filter's AVOption table has no `shaping` knob, so the field is left
// zero-initialized (= ASS_SHAPING_SIMPLE) and unconditionally applied.
// Simple shaping never runs HarfBuzz, so it can't resolve the GSUB
// positional/contextual substitutions Arabic-family scripts need — Nastaliq
// Urdu in particular has no real "standalone" letterforms, everything is
// substituted in from a joined/positional form. Without that substitution,
// libass draws whatever's in the bare cmap slot, which renders as tofu
// boxes. The sibling `ass` filter DOES expose `shaping=complex`, but it
// reads a real .ass file (native libass track reader) instead of decoding
// SRT through avcodec's subtitle decoder — so we build the .ass ourselves,
// with style (font, size, colors) in the header instead of force_style
// (which the `ass` filter doesn't support).
const toASS = (captions, font) => {
  const pad2 = (n) => String(Math.floor(n)).padStart(2, "0");
  const toTimecode = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = pad2((secs % 3600) / 60);
    const s = pad2(secs % 60);
    const cs = String(Math.round((secs % 1) * 100)).padStart(2, "0");
    return `${h}:${m}:${s}.${cs}`;
  };
  const header =
`[Script Info]
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 384
PlayResY: 288

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font.family},20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events = captions
    .map((c) => `Dialogue: 0,${toTimecode(c.start)},${toTimecode(c.end)},Default,,0,0,0,,${c.text.replace(/\n/g, "\\N")}`)
    .join("\n");
  return header + events;
};

// ── Generate captions => POST /api/v1/videos/:videoId/captions ───────────
export const generateCaptions = catchAsyncErrors(async (req, res, next) => {
  const video = await Video.findById(req.params.videoId);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  // Get the source video — reuses the local file from upload when possible
  // (skips the Cloudinary download entirely, which is the slow part).
  const { filePath: sourceVideo, isTemp } = await getLocalOriginalPath(video);
  const tmpAudio = path.join(os.tmpdir(), `${video._id}_${Date.now()}.mp3`);

  // Extract audio using FFmpeg (much smaller than video)
  await new Promise((resolve, reject) => {
    ffmpeg(sourceVideo)
      .output(tmpAudio)
      .audioCodec("libmp3lame")
      .audioBitrate("64k")       // low bitrate = smaller file
      .noVideo()                 // strip video, audio only
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  // Check audio file size
  const audioStats = fs.statSync(tmpAudio);
  const audioSizeMB = audioStats.size / (1024 * 1024);
  console.log(`Audio extracted: ${audioSizeMB.toFixed(2)} MB`);

  // Transcribe with Groq Whisper. We ask for word-level timestamps too:
  // Whisper's segment.start often includes leading silence before the
  // speaker actually starts talking (especially after a pause), which makes
  // captions appear too early. Word timestamps let us tighten each caption
  // to when speech genuinely begins. (Shared with the audio-first flow in
  // transcribeController.js so both paths behave identically.)
  let captions, language, speakerCount;
  try {
    ({ captions, language, speakerCount } = await transcribeAudioFile(tmpAudio));
  } finally {
    // Only clean up the source video if it was a temp download — the local
    // upload copy is reused by later steps (translate/burn), so keep it.
    if (isTemp) fs.unlink(sourceVideo, () => {});
    fs.unlink(tmpAudio, () => {});
  }

  if (captions.length === 0)
    return next(new ErrorHandler("Could not generate captions. Try a clearer audio.", 400));

  let captionDoc = await Caption.findOne({ video: video._id, ...ownerFields(req) });
  if (captionDoc) {
    captionDoc.captions = captions;
    captionDoc.language = language;
    await captionDoc.save();
  } else {
    captionDoc = await Caption.create({
      video: video._id,
      ...ownerFields(req),
      language,
      captions,
    });
  }

  video.status = "captioned";
  video.detectedLanguage = language;
  video.speakerCount = speakerCount;
  await video.save();

  res.status(200).json({ success: true, captions: captionDoc });
});

// ── Get captions => GET /api/v1/videos/:videoId/captions ─────────────────
export const getVideoCaptions = catchAsyncErrors(async (req, res, next) => {
  const captionDoc = await Caption.findOne({
    video: req.params.videoId,
    ...ownerFields(req),
  });
  if (!captionDoc) return next(new ErrorHandler("Captions not found.", 404));
  res.status(200).json({ success: true, captions: captionDoc });
});

// ── Update captions => PUT /api/v1/videos/:videoId/captions ──────────────
export const updateCaptions = catchAsyncErrors(async (req, res, next) => {
  const { captions } = req.body;
  if (!captions || !Array.isArray(captions))
    return next(new ErrorHandler("Please provide captions array.", 400));

  const captionDoc = await Caption.findOne({
    video: req.params.videoId,
    ...ownerFields(req),
  });
  if (!captionDoc) return next(new ErrorHandler("Captions not found.", 404));

  captionDoc.captions = captions;
  await captionDoc.save();
  res.status(200).json({ success: true, captions: captionDoc });
});

// ── Delete captions => DELETE /api/v1/videos/:videoId/captions ───────────
export const deleteCaptions = catchAsyncErrors(async (req, res, next) => {
  const captionDoc = await Caption.findOneAndDelete({
    video: req.params.videoId,
    ...ownerFields(req),
  });
  if (!captionDoc) return next(new ErrorHandler("Captions not found.", 404));
  res.status(200).json({ success: true, message: "Captions deleted." });
});

// ── Burn captions => POST /api/v1/videos/:videoId/captions/burn ──────────
export const burnCaptions = catchAsyncErrors(async (req, res, next) => {
  const video = await Video.findById(req.params.videoId);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  const { language } = req.body;
  const query = { video: video._id, ...ownerFields(req) };
  if (language) query.language = language;

  const captionDoc = await Caption.findOne(query);
  if (!captionDoc)
    return next(new ErrorHandler("No captions found. Generate or translate captions first.", 404));

  if (captionDoc.captions.length === 0)
    return next(new ErrorHandler("Captions are empty.", 400));

  // 1. Write ASS to temp file (see toASS for why ASS instead of SRT here —
  // short version: only the `ass` ffmpeg filter supports shaping=complex,
  // and it needs a real .ass file rather than force_style on top of SRT).
  const chosenFont = pickFontForCaptions(captionDoc.captions);
  const assContent = toASS(captionDoc.captions, chosenFont);
  const tmpDir = os.tmpdir();
  const assPath = path.join(tmpDir, `${video._id}_${Date.now()}.ass`);
  const burnedFilename = `${video._id}_${randomUUID()}.mp4`;
  // /tmp is the ONLY writable location on Vercel — BURNED_DIR (under
  // backend/uploads) doesn't exist there and can't be created at runtime,
  // which is exactly what caused "Error opening output file ... No such
  // file or directory". Burn into /tmp and upload the result to Cloudinary
  // before responding, rather than the old local-folder + background-sync
  // pattern, which also isn't safe here: Vercel can freeze the function
  // right after the response is sent, killing an in-flight background
  // upload before it finishes.
  const outputPath = path.join(tmpDir, burnedFilename);

  fs.writeFileSync(assPath, assContent, "utf8");

  // 2. Get source video — reuses the local upload copy, no re-download
  const { filePath: inputPath, isTemp: inputIsTemp } = await getLocalOriginalPath(video);

  // 3. Burn subtitles with FFmpeg into /tmp
  //
  // NOTE on fonts: libass needs an actual font file to rasterize glyphs.
  // Locally this "just works" because your OS has system fonts covering
  // most scripts. On Vercel there are NO system fonts and no fontconfig
  // cache — when libass can't resolve a font it silently draws nothing
  // (ffmpeg still exits 0), so the burn "succeeds" but the output has no
  // visible captions. `fontsdir` below points libass at fonts we ship in
  // the repo instead of relying on the OS.
  //
  // A single font only covers the script(s) it was designed for, and this
  // app translates into Arabic, Urdu, Hindi, Chinese, Russian, and more —
  // so the font is picked per burn by scanning the caption text itself
  // (see pickFontForCaptions), not hardcoded to one script's font, and
  // baked into the .ass Style header built by toASS().
  //
  // NOTE on the `ass` filter vs `subtitles` filter: we use `ass` here
  // (not `subtitles`) specifically because `ass` exposes `shaping=complex`,
  // which routes glyph selection through HarfBuzz. `subtitles` hardcodes
  // libass to simple/FriBidi-only shaping with no way to override it — fine
  // for Latin/Cyrillic/CJK/Devanagari base glyphs, but Arabic-family
  // scripts (Arabic, Urdu/Nastaliq) have no meaningful standalone
  // letterforms — every visible shape comes from GSUB positional/ligature
  // substitution, which simple shaping never runs. Without it, libass
  // draws the bare (effectively blank/placeholder) cmap glyph instead,
  // which is why Urdu/Arabic burned as tofu boxes even though the font
  // file itself was fine. `ass` reads a real .ass file via libass's own
  // track reader rather than SRT decoded through avcodec, which is why
  // toASS() exists and why force_style isn't used anymore (the `ass`
  // filter doesn't support it — style lives in the .ass header instead).
  //
  // IMPORTANT: outputOptions() must be called with -vf and its value as
  // SEPARATE ARGUMENTS to this function call — NOT as two items inside one
  // array. fluent-ffmpeg's outputOptions() re-applies a naive space-based
  // heuristic to every item independently even when they're already split
  // apart in an array: if `String(item).split(' ')` produces exactly 2
  // pieces, it silently re-splits that item into two separate ffmpeg
  // arguments. Font family names are exactly the kind of value that trips
  // this — e.g. "Noto Sans" (one space) gets sliced in half, and the
  // second half ends up as a stray bare argument that ffmpeg misreads as
  // an output filename. Calling outputOptions(a, b, c, ...) with
  // individual arguments — instead of outputOptions([a, b, c, ...]) —
  // disables this heuristic entirely (verified against the library's own
  // source), so it's safe regardless of how many spaces any value has.
  const escapedFontsDir = FONTS_DIR.replace(/\\/g, "/").replace(/:/g, "\\:");

  await new Promise((resolve, reject) => {
    const escapedAss = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    const vfValue = `ass='${escapedAss}':fontsdir='${escapedFontsDir}':shaping=complex`;

    ffmpeg(inputPath)
      .outputOptions(
        "-vf", vfValue,
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "fast",
        "-c:a", "copy",
      )
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  // 4. Cleanup the SRT (and the input, if it was a temp download fallback).
  safeUnlink(assPath);
  if (inputIsTemp) safeUnlink(inputPath);

  // 5. Remember the previous burned Cloudinary asset so we can delete it
  //    once the new one finishes uploading (not before — avoids a gap
  //    where neither copy exists in Cloudinary).
  const previousBurnedPublicId = video.burnedVideo?.public_id || null;

  // 6. Upload the burned file to Cloudinary NOW, before responding — this
  //    is the part that used to be a "fire and forget" background job,
  //    which isn't reliable on Vercel (see note above). It's slower for
  //    the user, but it means the URL we return is always real and
  //    immediately playable, not a promise of one.
  const uploadResult = await cloudinary.v2.uploader.upload(outputPath, {
    resource_type: "video",
    folder: "transcripto-ai/burned",
    chunk_size: 6000000,
    timeout: 180000,
  });

  safeUnlink(outputPath);

  video.burnedVideo = {
    public_id: uploadResult.public_id,
    url: uploadResult.secure_url,
    cloudStatus: "done",
  };
  video.status = "burned";
  await video.save();

  res.status(200).json({
    success: true,
    message: "Captions burned into video successfully.",
    burnedVideo: video.burnedVideo,
  });

  // 7. Clean up the previous burned asset now that the new one is
  //    confirmed live in Cloudinary. This runs after the response but is
  //    just a delete — if the function gets frozen before it completes,
  //    worst case is a harmless orphaned asset in Cloudinary, not a
  //    broken video for the user.
  if (previousBurnedPublicId) {
    cloudinary.v2.uploader
      .destroy(previousBurnedPublicId, { resource_type: "video" })
      .catch(() => {});
  }
});

// ── Download captions => GET /api/v1/videos/:videoId/captions/download ────
// Query params: ?format=srt (default) or ?format=txt
//               ?language=Arabic (optional, defaults to original)
export const downloadCaptions = catchAsyncErrors(async (req, res, next) => {
  const { format = "srt", language } = req.query;

  if (!["srt", "txt"].includes(format))
    return next(new ErrorHandler("Invalid format. Use 'srt' or 'txt'.", 400));

  const video = await Video.findById(req.params.videoId);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  const query = { video: video._id, ...ownerFields(req) };
  if (language) query.language = language;

  const captionDoc = await Caption.findOne(query);
  if (!captionDoc)
    return next(new ErrorHandler("Captions not found.", 404));

  if (captionDoc.captions.length === 0)
    return next(new ErrorHandler("Captions are empty.", 400));

  const safeTitle = video.title.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const langSuffix = language ? `_${language}` : "";

  if (format === "srt") {
    const content = toSRT(captionDoc.captions);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeTitle}${langSuffix}.srt"`
    );
    return res.send(content);
  }

  // format === "txt"
  const content = captionDoc.captions.map((c) => c.text).join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeTitle}${langSuffix}.txt"`
  );
  return res.send(content);
});