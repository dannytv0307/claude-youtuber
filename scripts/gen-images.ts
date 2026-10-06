/**
 * Generate one image per scene with Gemini image generation.
 *   npx tsx scripts/gen-images.ts <id> [--force] [--scene=<sceneId>]
 * Existing files are skipped unless --force or --scene targets them.
 */
import fs from "node:fs";
import { FORMATS } from "../src/schema/video-spec";
import { firstInlineData, gemini, IMAGE_MODEL, withRetry } from "./lib/gemini";
import { hasFlag, projectPaths, requireProjectId, toPublicAbs } from "./lib/paths";
import { buildRenderData, loadSpec } from "./lib/render-data";

const id = requireProjectId("npx tsx scripts/gen-images.ts <id> [--force] [--scene=<sceneId>]");
const force = hasFlag("force");
const onlyScene = process.argv.find((a) => a.startsWith("--scene="))?.split("=")[1];

const spec = loadSpec(id);
const p = projectPaths(id);
const { aspectRatio } = FORMATS[spec.format];
fs.mkdirSync(p.imagesDir, { recursive: true });

console.log(`Hình ảnh cho "${id}" — model ${IMAGE_MODEL}, tỷ lệ ${aspectRatio}`);

for (const [i, scene] of spec.scenes.entries()) {
  if (onlyScene && scene.id !== onlyScene) continue;
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

  const response = await withRetry(scene.id, () =>
    gemini().models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio },
      },
    }),
  );

  const { data, mimeType } = firstInlineData(response);
  fs.writeFileSync(abs, data);
  console.log(`  [ok]   ${scene.id} → ${out} (${mimeType}, ${(data.length / 1024).toFixed(0)} KB)`);
}

const { warnings } = buildRenderData(id);
warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
console.log("Xong.");
