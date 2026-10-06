/**
 * Which AI generates images / voice, configured in ai-providers.json (root).
 * Each kind has named presets; the one used is, in order:
 *   --provider=<name> on the CLI  >  spec.providers.<kind>  >  file "default"  >  built-in "gemini"
 * Built-in presets "gemini" and "none" (skip generation) always exist.
 * Secrets are never stored here - presets name the env var holding the key (apiKeyEnv).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { VideoSpec } from "../../src/schema/video-spec";
import { readJson, ROOT } from "./paths";

/** AI_PROVIDERS_FILE overrides the location (handy for testing another setup) */
export const AI_CONFIG_PATH = process.env.AI_PROVIDERS_FILE ?? path.join(ROOT, "ai-providers.json");

const Size = { width: z.number().int().positive().optional(), height: z.number().int().positive().optional() };
const Extra = z.record(z.string(), z.unknown()).default({});

export const ImagePresetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gemini"), model: z.string().optional() }),
  /** Skip generation: no API call (layouts/custom scenes need no image; no voice = captions only) */
  z.object({ type: z.literal("none") }),
  /** OpenAI Images API or any server exposing /v1/images/generations */
  z.object({
    type: z.literal("openai"),
    baseUrl: z.string().default("https://api.openai.com/v1"),
    apiKeyEnv: z.string().default("OPENAI_API_KEY"),
    model: z.string(),
    /** e.g. "1536x1024"; default picks landscape/portrait from the video format */
    size: z.string().optional(),
    extra: Extra,
  }),
  /** Stable Diffusion WebUI (AUTOMATIC1111 / Forge / SD.Next), started with --api */
  z.object({
    type: z.literal("a1111"),
    baseUrl: z.string().default("http://127.0.0.1:7860"),
    negativePrompt: z.string().default(""),
    ...Size,
    extra: Extra,
  }),
  /** ComfyUI with a workflow exported via "Save (API format)", using {{prompt}} {{width}} {{height}} {{seed}} */
  z.object({
    type: z.literal("comfyui"),
    baseUrl: z.string().default("http://127.0.0.1:8188"),
    /** Path relative to the repo root */
    workflow: z.string(),
    ...Size,
  }),
  /** Any CLI: placeholders {{prompt_file}} {{out}} {{width}} {{height}} {{aspect}} */
  z.object({
    type: z.literal("command"),
    command: z.string(),
    outputExt: z.string().default("png"),
    ...Size,
  }),
]);

export const VoicePresetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gemini"), model: z.string().optional() }),
  /** Skip generation: no API call (layouts/custom scenes need no image; no voice = captions only) */
  z.object({ type: z.literal("none") }),
  /** OpenAI /v1/audio/speech or a compatible server (Kokoro-FastAPI, LocalAI, openedai-speech…) */
  z.object({
    type: z.literal("openai"),
    baseUrl: z.string().default("https://api.openai.com/v1"),
    apiKeyEnv: z.string().default("OPENAI_API_KEY"),
    model: z.string(),
    /** Provider voice name; falls back to spec.voice.name */
    voice: z.string().optional(),
    /** Send spec.voice.styleInstruction as "instructions" (gpt-4o-mini-tts supports it) */
    useStyleInstruction: z.boolean().default(true),
    speed: z.number().positive().optional(),
    extra: Extra,
  }),
  z.object({
    type: z.literal("elevenlabs"),
    apiKeyEnv: z.string().default("ELEVENLABS_API_KEY"),
    voiceId: z.string(),
    model: z.string().default("eleven_multilingual_v2"),
    extra: Extra,
  }),
  /** Any CLI: placeholders {{text_file}} {{out}} {{voice}} {{language}} */
  z.object({
    type: z.literal("command"),
    command: z.string(),
    outputExt: z.string().default("wav"),
    voice: z.string().optional(),
  }),
]);

export type ImagePreset = z.infer<typeof ImagePresetSchema>;
export type VoicePreset = z.infer<typeof VoicePresetSchema>;

const section = <T extends z.ZodType>(preset: T) =>
  z
    .object({ default: z.string().default("gemini"), presets: z.record(z.string(), preset).default({}) })
    .default({ default: "gemini", presets: {} });

export const AiConfigSchema = z.object({
  image: section(ImagePresetSchema),
  voice: section(VoicePresetSchema),
});

const loadConfig = () => {
  if (!fs.existsSync(AI_CONFIG_PATH)) return AiConfigSchema.parse({});
  const parsed = AiConfigSchema.safeParse(readJson<unknown>(AI_CONFIG_PATH));
  if (!parsed.success) {
    console.error("ai-providers.json không hợp lệ:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
};

const cliProvider = () =>
  process.argv.find((a) => a.startsWith("--provider="))?.split("=")[1];

const resolve = <T>(
  kind: "image" | "voice",
  presets: Record<string, T>,
  fallback: string,
  fromSpec: string | undefined,
  builtins: Record<string, T>,
): { name: string; preset: T } => {
  const name = cliProvider() ?? fromSpec ?? fallback;
  const preset = presets[name] ?? builtins[name];
  if (!preset) {
    const known = [...Object.keys(builtins), ...Object.keys(presets)].filter((v, i, a) => a.indexOf(v) === i);
    console.error(`Không có preset ${kind} "${name}" trong ai-providers.json. Có: ${known.join(", ")}`);
    process.exit(1);
  }
  return { name, preset };
};

export const resolveImageProvider = (spec: VideoSpec) => {
  const cfg = loadConfig().image;
  return resolve<ImagePreset>("image", cfg.presets, cfg.default, spec.providers?.image, {
    gemini: { type: "gemini" },
    none: { type: "none" },
  });
};

export const resolveVoiceProvider = (spec: VideoSpec) => {
  const cfg = loadConfig().voice;
  return resolve<VoicePreset>("voice", cfg.presets, cfg.default, spec.providers?.voice, {
    gemini: { type: "gemini" },
    none: { type: "none" },
  });
};

/** Bearer header from the env var named by the preset; required only for api.openai.com */
export const bearer = (apiKeyEnv: string, baseUrl: string): Record<string, string> => {
  const key = process.env[apiKeyEnv];
  if (key) return { Authorization: `Bearer ${key}` };
  if (/api\.openai\.com/.test(baseUrl)) {
    console.error(`Thiếu ${apiKeyEnv} trong .env.`);
    process.exit(1);
  }
  return {};
};

export const requireEnv = (name: string) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Thiếu ${name} trong .env.`);
    process.exit(1);
  }
  return v;
};
