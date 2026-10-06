/**
 * Validate projects/<id>/spec.json and (re)build public/projects/<id>/render.json.
 *   npx tsx scripts/validate-spec.ts <id>
 * Works before any asset exists (durations are estimated from the narration).
 */
import { FPS, totalDurationInFrames } from "../src/schema/video-spec";
import { requireProjectId } from "./lib/paths";
import { buildRenderData } from "./lib/render-data";

const id = requireProjectId("npx tsx scripts/validate-spec.ts <id>");
const { data, warnings } = buildRenderData(id);
const { spec, scenes } = data;

const totalSec = totalDurationInFrames(scenes, FPS) / FPS;
const diff = totalSec - spec.targetDurationSec;
const problems: string[] = [...warnings];

if (spec.format === "short" && totalSec > 180)
  problems.push(`Short dài ${totalSec.toFixed(0)}s, vượt giới hạn 180s của YouTube Shorts`);
if (Math.abs(diff) > Math.max(5, spec.targetDurationSec * 0.15))
  problems.push(
    `Thời lượng ${totalSec.toFixed(1)}s lệch ${diff > 0 ? "+" : ""}${diff.toFixed(1)}s so với mục tiêu ${spec.targetDurationSec}s — chỉnh độ dài lời đọc`,
  );
const ids = new Set<string>();
for (const s of spec.scenes) {
  if (ids.has(s.id)) problems.push(`Trùng scene id "${s.id}"`);
  ids.add(s.id);
}

console.log(`Spec "${id}" hợp lệ theo schema.`);
console.log(`  format=${spec.format} language=${spec.language} scenes=${scenes.length}`);
console.log(`  thời lượng ≈ ${totalSec.toFixed(1)}s (mục tiêu ${spec.targetDurationSec}s)`);
console.log(
  `  giọng đọc: ${scenes.filter((s) => s.voice).length}/${scenes.length}, hình ảnh: ${scenes.filter((s) => s.image).length}/${scenes.length}`,
);
console.log(`  nhạc nền: ${data.music ? data.music.file : "không có"}`);
if (problems.length) {
  console.log("Cảnh báo:");
  problems.forEach((w) => console.log(`  ⚠ ${w}`));
}
