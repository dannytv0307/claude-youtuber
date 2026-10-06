/**
 * Generate one image per scene with the image provider from ai-providers.json.
 *   npx tsx scripts/gen-images.ts <id> [--force] [--scene=<sceneId>] [--provider=<preset>]
 * Existing files are skipped unless --force or --scene targets them.
 */
import fs from "node:fs";
import { FORMATS } from "../src/schema/video-spec";
import { resolveImageProvider } from "./lib/ai-config";
import { describeImagePreset, generateImage } from "./lib/image-providers";
import { hasFlag, projectPaths, requireProjectId, toPublicAbs } from "./lib/paths";
import { buildRenderData, loadSpec } from "./lib/render-data";
import { isQuotaError, withRetry } from "./lib/retry";

const id = requireProjectId(
  "npx tsx scripts/gen-images.ts <id> [--force] [--scene=<sceneId>] [--provider=<preset>]",
);
const force = hasFlag("force");
const onlyScene = process.argv.find((a) => a.startsWith("--scene="))?.split("=")[1];

const spec = loadSpec(id);
const p = projectPaths(id);
const { aspectRatio } = FORMATS[spec.format];
const { name, preset } = resolveImageProvider(spec);
fs.mkdirSync(p.imagesDir, { recursive: true });

console.log(`Hình ảnh cho "${id}" — provider "${name}" (${describeImagePreset(preset)}), tỷ lệ ${aspectRatio}`);

const failed: string[] = [];
for (const [i, scene] of spec.scenes.entries()) {
  if (onlyScene && scene.id !== onlyScene) continue;
  if (scene.visual.type !== "image") {
    console.log(`  [code] ${scene.id} (cảnh ${scene.visual.type}, vẽ bằng code, không cần ảnh)`);
    continue;
  }
  if (preset.type === "none") {
    console.log(`  [none] ${scene.id} (provider none, dùng placeholder)`);
    continue;
  }
  const out = p.publicImage(i);
  const abs = toPublicAbs(out);
  if (fs.existsSync(abs) && !force && !onlyScene) {
    console.log(`  [skip] ${scene.id} (đã có)`);
    continue;
  }

  const prompt = [
    scene.visualPrompt,
    `Visual style (keep consistent across all scenes): ${spec.style.visual}`,
    `Composition for a ${aspectRatio} ${spec.format === "short" ? "vertical" : "horizontal"} video frame; keep the main subject away from the bottom third (captions go there).`,
    "Do not render any text, letters, captions, logos or watermarks.",
  ].join("\n");

  try {
    const data = await withRetry(scene.id, () =>
      generateImage(preset, { prompt, sceneId: scene.id, spec }),
    );
    fs.writeFileSync(abs, data);
    console.log(`  [ok]   ${scene.id} → ${out} (${(data.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    // Keep going so one blocked/failed scene does not cost the others; rerun with --scene
    failed.push(scene.id);
    console.error(`  [lỗi] ${scene.id}: ${err instanceof Error ? err.message : err}`);
    if (isQuotaError(err)) {
      console.error("  Dừng: hết quota/bị giới hạn tốc độ sau nhiều lần thử lại. Đợi rồi chạy lại.");
      break;
    }
  }
}

const { warnings } = buildRenderData(id);
warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
console.log("Xong.");

if (failed.length) {
  console.error(`Lỗi ở ${failed.length} cảnh: ${failed.join(", ")}. Sửa rồi chạy lại với --scene=<sceneId>.`);
  process.exitCode = 1;
}
