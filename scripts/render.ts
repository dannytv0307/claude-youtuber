/**
 * Render a project to out/<id>.mp4.
 *   npx tsx scripts/render.ts <id> [--playback-rate=1.25] [extra remotion render flags]
 * --playback-rate speeds the voice up/down (same as the prop in Studio).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, requireProjectId } from "./lib/paths";
import { buildRenderData } from "./lib/render-data";

const id = requireProjectId("npx tsx scripts/render.ts <id> [--playback-rate=1.25]");
const rateArg = process.argv.find((a) => a.startsWith("--playback-rate="));
const playbackRate = rateArg ? Number(rateArg.split("=")[1]) : 1;
if (!(playbackRate >= 0.5 && playbackRate <= 2)) {
  console.error("--playback-rate phải nằm trong khoảng 0.5 – 2");
  process.exit(1);
}
const { data, warnings, totalSec } = buildRenderData(id);
warnings.forEach((w) => console.warn(`⚠ ${w}`));

const missing = data.scenes.filter((s) => !s.image || !s.voice).map((s) => s.id);
if (missing.length) {
  console.warn(`⚠ Thiếu hình/giọng ở các cảnh: ${missing.join(", ")} — video sẽ dùng placeholder/không có tiếng.`);
}

// Single composition; size/length come from render.json via calculateMetadata
const composition = "Video";
const propsFile = path.join(os.tmpdir(), `yt-vtv-${id}-props.json`);
fs.writeFileSync(propsFile, JSON.stringify({ projectId: id, playbackRate }));
const out = path.join("out", `${id}.mp4`);
const extra = process.argv.slice(2).filter((a) => a.startsWith("--") && a !== rateArg);

const voiceSec = data.scenes.reduce((sum, s) => sum + s.voiceDurationSec, 0);
const estSec = totalSec - voiceSec * (1 - 1 / playbackRate);
console.log(`Render ${composition} → ${out} (≈${estSec.toFixed(1)}s${playbackRate !== 1 ? `, giọng x${playbackRate}` : ""})`);
const cmd = ["npx remotion render", composition, `"${out}"`, `--props="${propsFile}"`, ...extra].join(" ");
const res = spawnSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
process.exit(res.status ?? 1);
