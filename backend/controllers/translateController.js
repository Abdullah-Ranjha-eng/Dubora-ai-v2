import Caption from "../models/caption.js";
import Video from "../models/video.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import { ownerFields, isOwner } from "../utils/ownership.js";
import Groq from "groq-sdk";

const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });

const SUPPORTED_LANGUAGES = [
  "English", "Arabic", "French", "Spanish", "German", "Urdu", "Hindi",
  "Chinese", "Turkish", "Russian", "Italian", "Portuguese", "Japanese"
];

// Translate captions => POST /api/v1/videos/:videoId/translate.
export const translateCaptions = catchAsyncErrors(async (req, res, next) => {
  const { targetLanguage } = req.body;
  if (!targetLanguage)
    return next(new ErrorHandler("Please provide a targetLanguage.", 400));

  if (!SUPPORTED_LANGUAGES.includes(targetLanguage))
    return next(new ErrorHandler(
      `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`, 400
    ));

  const video = await Video.findById(req.params.videoId);
  if (!video) return next(new ErrorHandler("Video not found.", 404));
  if (!isOwner(video, req))
    return next(new ErrorHandler("Not authorized.", 403));

  const captionDoc = await Caption.findOne({ video: video._id, ...ownerFields(req) });
  if (!captionDoc)
    return next(new ErrorHandler("No captions found. Generate captions first.", 404));

  // Send all texts to Groq LLaMA for translation
  const textsJSON = JSON.stringify(captionDoc.captions.map((c) => c.text));

  const completion = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a professional subtitle translator. 
Translate the following JSON array of strings to ${targetLanguage}.
Return ONLY a valid JSON array of translated strings in the same order.
Do not add any explanation, markdown, or extra text.`,
      },
      { role: "user", content: textsJSON },
    ],
    temperature: 0.3,
  });

  let translatedTexts;
  try {
    const raw = completion.choices[0].message.content.trim();
    const clean = raw.replace(/```json|```/g, "").trim();
    translatedTexts = JSON.parse(clean);
  } catch {
    return next(new ErrorHandler("Translation failed. Please try again.", 500));
  }

  const translatedCaptions = captionDoc.captions.map((cap, i) => ({
    start: cap.start,
    end: cap.end,
    text: translatedTexts[i] || cap.text,
    // Speaker identity doesn't change across languages — carry it through
    // untouched so the dub step (dubController.js) can reuse the same
    // speaker → voice casting regardless of which language is being dubbed.
    speaker: cap.speaker || "SPEAKER_1",
  }));

  // Upsert translated caption doc. Also carries over the source doc's
  // speakerVoices if the target doc doesn't have its own yet — saves the
  // user from re-casting voices every time they translate into a new
  // language, while still letting them override per-language afterward via
  // PUT /videos/:videoId/captions/speakers.
  let translatedDoc = await Caption.findOne({
    video: video._id,
    ...ownerFields(req),
    language: targetLanguage,
  });

  if (translatedDoc) {
    translatedDoc.captions = translatedCaptions;
    await translatedDoc.save();
  } else {
    translatedDoc = await Caption.create({
      video: video._id,
      ...ownerFields(req),
      language: targetLanguage,
      captions: translatedCaptions,
      speakerVoices: captionDoc.speakerVoices,
    });
  }

  video.status = "translated";
  await video.save();

  res.status(200).json({ success: true, captions: translatedDoc });
});
