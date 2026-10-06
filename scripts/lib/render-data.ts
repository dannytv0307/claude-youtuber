import fs from "node:fs";
import path from "node:path";
import {
  AudioCatalogSchema,
  FPS,
  RenderDataSchema,
  totalDurationInFrames,
  VideoSpecSchema,
  type AudioCatalog,
  type RenderData,
  type VideoSpec,
} from "../../src/schema/video-spec";
import { wavDurationSec } from "./wav";
import {
  CATALOG_PATH,
  projectPaths,
  readJson,
  ROOT,
  toPublicAbs,
  writeJson,
} from "./paths";

/** Keys registered in src/custom/index.ts, read as text (the components only run in the browser) */
const customComponentKeys = () => {
  const file = path.join(ROOT, "src", "custom", "index.ts");
  if (!fs.existsSync(file)) return [];
  return [...fs.readFileSync(file, "utf8").matchAll(/^\s*["']([^"']+)["']\s*:/gm)].map((m) => m[1]);
};

/** Silence before the voice starts in each scene */
export const LEAD_SEC = 0.3;
/** Silence after the voice ends - must be longer than a transition (0.5s) */
export const TAIL_SEC = 0.7;

/**
 * Rough speaking-time estimate used before the voice is generated.
 * Vietnamese is counted per syllable (space separated), ~3.2 syl/s.
 * Other languages per word, ~2.5 words/s.
 */
export const estimateSpeechSec = (text: string, language: string) => {
  const tokens = text.trim().split(/\s+/).filter(Boolean).length;
  const rate = language.toLowerCase().startsWith("vi") ? 3.2 : 2.5;
  return tokens / rate;
};

export const loadSpec = (id: string): VideoSpec => {
  const raw = readJson<unknown>(projectPaths(id).spec);
  const parsed = VideoSpecSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`spec.json của "${id}" không hợp lệ:`);
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  if (parsed.data.id !== id) {
    console.error(`spec.id ("${parsed.data.id}") phải trùng tên thư mục ("${id}")`);
    process.exit(1);
  }
  return parsed.data;
};

export const loadCatalog = (): AudioCatalog => {
  if (!fs.existsSync(CATALOG_PATH)) return { updatedAt: "", tracks: [] };
  return AudioCatalogSchema.parse(readJson(CATALOG_PATH));
};

/** Merge spec + whatever assets exist into public/projects/<id>/render.json */
export const buildRenderData = (id: string) => {
  const spec = loadSpec(id);
  const p = projectPaths(id);
  const catalog = loadCatalog();
  const warnings: string[] = [];

  const track = (trackId: string) => {
    const t = catalog.tracks.find((x) => x.id === trackId);
    if (!t) warnings.push(`Không có track "${trackId}" trong catalog.json`);
    else if (!fs.existsSync(toPublicAbs(t.file)))
      warnings.push(`File của track "${trackId}" không tồn tại: ${t.file}`);
    return t;
  };

  const scenes = spec.scenes.map((scene, i) => {
    const image =
      scene.visual.type === "image" && fs.existsSync(toPublicAbs(p.publicImage(i)))
        ? p.publicImage(i)
        : null;
    const voicePath = toPublicAbs(p.publicVoice(i));
    const voice = fs.existsSync(voicePath) ? p.publicVoice(i) : null;
    const voiceDurationSec = voice
      ? wavDurationSec(fs.readFileSync(voicePath))
      : estimateSpeechSec(scene.narration, spec.language);
    const sfx = scene.sfx.flatMap((sid) => {
      const t = track(sid);
      return t ? [{ id: sid, file: t.file }] : [];
    });
    return {
      id: scene.id,
      narration: scene.narration,
      onScreenText: scene.onScreenText,
      transition: scene.transition,
      visual: scene.visual,
      image,
      voice,
      voiceDurationSec,
      voiceIsEstimate: !voice,
      durationSec: LEAD_SEC + voiceDurationSec + TAIL_SEC,
      sfx,
      visualPrompt: scene.visualPrompt,
    };
  });

  for (const scene of spec.scenes) {
    if (scene.visual.type === "image" && !scene.visualPrompt.trim())
      warnings.push(`Cảnh "${scene.id}" dùng ảnh AI nhưng thiếu visualPrompt`);
    if (scene.visual.type === "custom" && !customComponentKeys().includes(scene.visual.component))
      warnings.push(
        `Cảnh "${scene.id}": chưa có component "${scene.visual.component}" trong src/custom/index.ts`,
      );
  }

  let music: RenderData["music"] = null;
  if (spec.music) {
    const t = track(spec.music.trackId);
    if (t)
      music = {
        file: t.file,
        volume: spec.music.volume,
        duckUnderVoice: spec.music.duckUnderVoice,
      };
  }

  const data: RenderData = RenderDataSchema.parse({
    spec,
    scenes,
    music,
    generatedAt: new Date().toISOString(),
  });
  writeJson(p.renderData, data);

  const totalSec = totalDurationInFrames(data.scenes, FPS) / FPS;
  return { data, warnings, totalSec };
};
