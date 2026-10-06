/** Image generation backends. Each returns PNG bytes for one scene. */
import fs from "node:fs";
import path from "node:path";
import { FORMATS, type VideoSpec } from "../../src/schema/video-spec";
import { bearer, type ImagePreset } from "./ai-config";
import { firstInlineData, gemini, IMAGE_MODEL } from "./gemini";
import { httpFetch, httpJson, runCommand, toPng } from "./media";
import { ROOT } from "./paths";

export type ImageRequest = { prompt: string; sceneId: string; spec: VideoSpec };

/** Pixel size for local diffusion models (SDXL/Flux-friendly) unless the preset sets one */
const pixelSize = (preset: { width?: number; height?: number }, spec: VideoSpec) => {
  const portrait = spec.format === "short";
  return {
    width: preset.width ?? (portrait ? 768 : 1344),
    height: preset.height ?? (portrait ? 1344 : 768),
  };
};

export const describeImagePreset = (p: ImagePreset) => {
  switch (p.type) {
    case "gemini":
      return `gemini ${p.model ?? IMAGE_MODEL}`;
    case "openai":
      return `openai ${p.model} @ ${p.baseUrl}`;
    case "a1111":
    case "comfyui":
      return `${p.type} @ ${p.baseUrl}`;
    case "command":
    case "none":
      return p.type;
  }
};

export const generateImage = async (preset: ImagePreset, req: ImageRequest): Promise<Buffer> => {
  const { spec, prompt } = req;
  const { aspectRatio } = FORMATS[spec.format];

  switch (preset.type) {
    case "gemini": {
      const response = await gemini().models.generateContent({
        model: preset.model ?? IMAGE_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
      });
      return toPng(firstInlineData(response).data);
    }

    case "openai": {
      const size = preset.size ?? (spec.format === "short" ? "1024x1536" : "1536x1024");
      const json = await httpJson<{ data?: { b64_json?: string; url?: string }[] }>(
        `${preset.baseUrl.replace(/\/$/, "")}/images/generations`,
        { model: preset.model, prompt, size, n: 1, ...preset.extra },
        bearer(preset.apiKeyEnv, preset.baseUrl),
      );
      const item = json.data?.[0];
      if (item?.b64_json) return toPng(Buffer.from(item.b64_json, "base64"));
      if (item?.url) return toPng(Buffer.from(await (await httpFetch(item.url)).arrayBuffer()));
      throw new Error(`Không có ảnh trong phản hồi: ${JSON.stringify(json).slice(0, 300)}`);
    }

    case "a1111": {
      const json = await httpJson<{ images?: string[] }>(
        `${preset.baseUrl.replace(/\/$/, "")}/sdapi/v1/txt2img`,
        { prompt, negative_prompt: preset.negativePrompt, ...pixelSize(preset, spec), ...preset.extra },
      );
      const b64 = json.images?.[0];
      if (!b64) throw new Error("Stable Diffusion WebUI không trả về ảnh");
      return toPng(Buffer.from(b64, "base64"));
    }

    case "comfyui":
      return toPng(await comfyui(preset, prompt, pixelSize(preset, spec)));

    case "none":
      throw new Error("provider none không tạo ảnh");

    case "command": {
      const size = pixelSize(preset, spec);
      return toPng(
        runCommand(preset.command, preset.outputExt, { ...size, aspect: aspectRatio }, { prompt_file: prompt }),
      );
    }
  }
};

type ComfyHistory = Record<
  string,
  { outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>; status?: { status_str?: string } }
>;

/**
 * Queue an API-format workflow, poll until done, download the first output image.
 * String values equal to "{{width}}" / "{{height}}" / "{{seed}}" become numbers;
 * "{{prompt}}" is substituted anywhere inside strings.
 */
const comfyui = async (
  preset: Extract<ImagePreset, { type: "comfyui" }>,
  prompt: string,
  size: { width: number; height: number },
) => {
  const base = preset.baseUrl.replace(/\/$/, "");
  const numbers: Record<string, number> = { ...size, seed: Math.floor(Math.random() * 2 ** 32) };
  const fill = (v: unknown): unknown => {
    if (typeof v === "string") {
      const exact = v.match(/^\{\{(\w+)\}\}$/);
      if (exact && exact[1] in numbers) return numbers[exact[1]];
      return v.replace(/\{\{prompt\}\}/g, prompt);
    }
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]));
    return v;
  };
  const workflow = fill(JSON.parse(fs.readFileSync(path.resolve(ROOT, preset.workflow), "utf8")));

  const { prompt_id } = await httpJson<{ prompt_id: string }>(`${base}/prompt`, { prompt: workflow });
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const history = (await (await httpFetch(`${base}/history/${prompt_id}`)).json()) as ComfyHistory;
    const entry = history[prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === "error") throw new Error("ComfyUI báo lỗi khi chạy workflow");
    for (const out of Object.values(entry.outputs ?? {})) {
      const img = out.images?.[0];
      if (!img) continue;
      const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
      return Buffer.from(await (await httpFetch(`${base}/view?${q}`)).arrayBuffer());
    }
    if (entry.status?.status_str === "success") throw new Error("Workflow ComfyUI không có node lưu ảnh (SaveImage)");
  }
  throw new Error("ComfyUI quá 15 phút chưa xong");
};
