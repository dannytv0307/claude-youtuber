/**
 * Generate voice-over WAV files for every scene with the voice provider from ai-providers.json.
 *   npx tsx scripts/gen-voice.ts <id> [--force] [--scene=<sceneId>] [--provider=<preset>]
 * Existing files are skipped unless --force or --scene targets them.
 */
import fs from "node:fs";
import { resolveVoiceProvider } from "./lib/ai-config";
import { hasFlag, projectPaths, requireProjectId, toPublicAbs } from "./lib/paths";
import { buildRenderData, loadSpec } from "./lib/render-data";
import { isQuotaError, withRetry } from "./lib/retry";
import { describeVoicePreset, generateVoice } from "./lib/voice-providers";
import { wavDurationSec } from "./lib/wav";

const id = requireProjectId(
  "npx tsx scripts/gen-voice.ts <id> [--force] [--scene=<sceneId>] [--provider=<preset>]",
);
const force = hasFlag("force");
const onlyScene = process.argv.find((a) => a.startsWith("--scene="))?.split("=")[1];

const spec = loadSpec(id);
const p = projectPaths(id);
const { name, preset } = resolveVoiceProvider(spec);
fs.mkdirSync(p.voiceDir, { recursive: true });

console.log(`Giọng đọc cho "${id}" — provider "${name}" (${describeVoicePreset(preset, spec)})`);

if (preset.type === "none") {
  console.log("  Bỏ qua: không tạo giọng. Video chỉ có chữ và phụ đề, thời lượng tính theo tốc độ đọc ước tính.");
}

const failed: string[] = [];
for (const [i, scene] of spec.scenes.entries()) {
  if (preset.type === "none") break;
  if (onlyScene && scene.id !== onlyScene) continue;
  const out = p.publicVoice(i);
  const abs = toPublicAbs(out);
  if (fs.existsSync(abs) && !force && !onlyScene) {
    console.log(`  [skip] ${scene.id} (đã có)`);
    continue;
  }

  try {
    const wav = await withRetry(scene.id, () =>
      generateVoice(preset, { text: scene.narration, sceneId: scene.id, spec }),
    );
    fs.writeFileSync(abs, wav);
    console.log(`  [ok]   ${scene.id} → ${out} (${wavDurationSec(wav).toFixed(1)}s)`);
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

const { totalSec, warnings } = buildRenderData(id);
warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
console.log(`Xong. Tổng thời lượng ước tính: ${totalSec.toFixed(1)}s (mục tiêu ${spec.targetDurationSec}s)`);

if (failed.length) {
  console.error(`Lỗi ở ${failed.length} cảnh: ${failed.join(", ")}. Sửa rồi chạy lại với --scene=<sceneId>.`);
  process.exitCode = 1;
}
