import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

export const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
export const TTS_MODEL =
  process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";

let client: GoogleGenAI | null = null;

/** Vertex AI (billed via Cloud Billing, uses ADC) when GOOGLE_GENAI_USE_VERTEXAI=true */
export const USE_VERTEX = /^(1|true)$/i.test(process.env.GOOGLE_GENAI_USE_VERTEXAI ?? "");

export const gemini = () => {
  if (client) return client;
  if (USE_VERTEX) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) {
      console.error("Thiếu GOOGLE_CLOUD_PROJECT trong .env (chế độ Vertex AI).");
      process.exit(1);
    }
    // Otherwise the SDK warns that project/location override the AI Studio key
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
    });
    return client;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "Thiếu GEMINI_API_KEY. Copy .env.example thành .env và điền key từ https://aistudio.google.com/apikey",
    );
    process.exit(1);
  }
  client = new GoogleGenAI({ apiKey });
  return client;
};

/** Extract the first inline binary part (image or audio) from a response. */
export const firstInlineData = (
  response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>,
) => {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType ?? "",
      };
    }
  }
  const text = parts.map((p) => p.text ?? "").join(" ").trim();
  const reason = response.candidates?.[0]?.finishReason;
  throw new Error(
    `Model không trả về dữ liệu nhị phân (finishReason=${reason ?? "?"}). ${text}`,
  );
};
