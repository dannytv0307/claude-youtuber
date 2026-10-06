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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry on rate limits / transient server errors with exponential backoff. */
export const withRetry = async <T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 5,
): Promise<T> => {
  let delay = 4000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "limit: 0" = model not available on this key's tier; retrying cannot help
      if (/limit: 0\b/.test(msg)) {
        const model = msg.match(/model: ([\w.-]+)/)?.[1] ?? "?";
        console.error(
          `  ${label}: model ${model} không có quota cho key này (free tier = 0). Cần key từ project đã gắn billing, hoặc đặt ảnh thủ công vào public/projects/<id>/images/.`,
        );
        process.exit(1);
      }
      // 402 = AI Studio prepaid credits empty; retrying cannot help
      if (/"code":402|prepayment credits/i.test(msg)) {
        console.error(
          `  ${label}: hết prepaid credit của Gemini API. Nạp tại https://aistudio.google.com (Projects → Billing).`,
        );
        process.exit(1);
      }
      const retryable = /429|RESOURCE_EXHAUSTED|500|503|UNAVAILABLE|deadline/i.test(
        msg,
      );
      if (!retryable || i >= attempts) throw err;
      console.warn(`  ${label}: lỗi tạm thời (${i}/${attempts}), thử lại sau ${delay / 1000}s`);
      await sleep(delay);
      delay *= 2;
    }
  }
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
