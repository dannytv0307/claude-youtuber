/**
 * Generate voice-over WAV files for every scene with Gemini TTS.
 *   npx tsx scripts/gen-voice.ts <id> [--force] [--scene=<sceneId>]
 * Existing files are skipped unless --force or --scene targets them.
 */
import fs from "node:fs";
import { firstInlineData, gemini, TTS_MODEL, withRetry } from "./lib/gemini";
import { hasFlag, projectPaths, requireProjectId, toPublicAbs } from "./lib/paths";
import { buildRenderData, loadSpec } from "./lib/render-data";
import { pcmToWav, wavDurationSec } from "./lib/wav";

const id = requireProjectId("npx tsx scripts/gen-voice.ts <id> [--force] [--scene=<sceneId>]");
const force = hasFlag("force");
const onlyScene = process.argv.find((a) => a.startsWith("--scene="))?.split("=")[1];

const spec = loadSpec(id);
const p = projectPaths(id);
fs.mkdirSync(p.voiceDir, { recursive: true });

console.log(`Giọng đọc cho "${id}" — model ${TTS_MODEL}, voice ${spec.voice.name}`);

for (const [i, scene] of spec.scenes.entries()) {
  if (onlyScene && scene.id !== onlyScene) continue;
  const out = p.publicVoice(i);
  const abs = toPublicAbs(out);
  if (fs.existsSync(abs) && !force && !onlyScene) {
    console.log(`  [skip] ${scene.id} (đã có)`);
    continue;
  }

  const prompt = [
    `${spec.voice.styleInstruction} Tone: ${spec.style.tone}.`,
    `Speak in language ${spec.language}. Read the text below exactly as written, do not add or omit words:`,
    scene.narration,
  ].join("\n");

  const response = await withRetry(scene.id, () =>
    gemini().models.generateContent({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: spec.voice.name } },
        },
      },
    }),
  );

  const { data } = firstInlineData(response);
  const wav = pcmToWav(data);
  fs.writeFileSync(abs, wav);
  console.log(`  [ok]   ${scene.id} → ${out} (${wavDurationSec(wav).toFixed(1)}s)`);
}

const { totalSec, warnings } = buildRenderData(id);
warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
console.log(`Xong. Tổng thời lượng ước tính: ${totalSec.toFixed(1)}s (mục tiêu ${spec.targetDurationSec}s)`);
