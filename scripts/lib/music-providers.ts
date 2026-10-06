/** Background-music generation backends. Each returns audio bytes (WAV/MP3…) for one clip. */
import "dotenv/config";
import { GoogleAuth } from "google-auth-library";
import type { MusicPreset } from "./ai-config";
import { httpJson, runCommand } from "./media";

export type MusicRequest = { prompt: string; negativePrompt: string; seed: number };

export const describeMusicPreset = (p: MusicPreset) => {
  switch (p.type) {
    case "none":
      return "none (không tạo nhạc)";
    case "lyria":
      return `lyria ${p.model} @ ${p.location}`;
    case "command":
      return "command";
  }
};

/** Approximate length of one generated clip, used to plan how many clips cover a video */
export const clipSeconds = (p: MusicPreset) => (p.type === "command" ? p.seconds : 30);

let auth: GoogleAuth | null = null;

const lyria = async (p: Extract<MusicPreset, { type: "lyria" }>, req: MusicRequest) => {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    console.error("Lyria chạy trên Vertex AI: cần GOOGLE_CLOUD_PROJECT trong .env và đã chạy `gcloud auth application-default login`.");
    process.exit(1);
  }
  auth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  const url = `https://${p.location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${p.location}/publishers/google/models/${p.model}:predict`;
  const json = await httpJson<{ predictions?: { bytesBase64Encoded?: string; audioContent?: string }[] }>(
    url,
    {
      instances: [{ prompt: req.prompt, negative_prompt: req.negativePrompt, seed: req.seed }],
      parameters: { sample_count: 1 },
    },
    { Authorization: `Bearer ${token}` },
  );
  const b64 = json.predictions?.[0]?.bytesBase64Encoded ?? json.predictions?.[0]?.audioContent;
  if (!b64) throw new Error(`Lyria không trả về audio: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
};

export const generateMusicClip = async (preset: MusicPreset, req: MusicRequest): Promise<Buffer> => {
  switch (preset.type) {
    case "none":
      throw new Error("provider none không tạo nhạc");
    case "lyria":
      return lyria(preset, req);
    case "command":
      return runCommand(
        preset.command,
        preset.outputExt,
        { seconds: preset.seconds, seed: req.seed },
        { prompt_file: req.prompt, negative_file: req.negativePrompt },
      );
  }
};
