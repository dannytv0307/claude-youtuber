/**
 * Render a project to out/<id>.mp4.
 *   npx tsx scripts/render.ts <id> [extra remotion render flags]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, requireProjectId } from "./lib/paths";
import { buildRenderData } from "./lib/render-data";

const id = requireProjectId("npx tsx scripts/render.ts <id>");
const { data, warnings, totalSec } = buildRenderData(id);
warnings.forEach((w) => console.warn(`⚠ ${w}`));

const missing = data.scenes.filter((s) => !s.image || !s.voice).map((s) => s.id);
if (missing.length) {
  console.warn(`⚠ Thiếu hình/giọng ở các cảnh: ${missing.join(", ")} — video sẽ dùng placeholder/không có tiếng.`);
}

// Single composition; size/length come from render.json via calculateMetadata
const composition = "Video";
const propsFile = path.join(os.tmpdir(), `yt-vtv-${id}-props.json`);
fs.writeFileSync(propsFile, JSON.stringify({ projectId: id }));
const out = path.join("out", `${id}.mp4`);
const extra = process.argv.slice(2).filter((a) => a.startsWith("--"));

console.log(`Render ${composition} → ${out} (≈${totalSec.toFixed(1)}s)`);
const cmd = ["npx remotion render", composition, `"${out}"`, `--props="${propsFile}"`, ...extra].join(" ");
const res = spawnSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
process.exit(res.status ?? 1);
