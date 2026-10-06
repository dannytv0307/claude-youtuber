/**
 * Generate background music for a video with the music provider from ai-providers.json.
 *   npx tsx scripts/gen-music.ts <id> [--force] [--clips=N] [--provider=<preset>]
 * Uses spec.musicPrompt; generates N clips, joins them with crossfades and saves
 * public/audio-library/music/ai-<id>.wav as catalog track "ai-<id>".
 * Set spec.music.trackId = "ai-<id>" to use it. The video loops the track if it is shorter.
 */
import fs from "node:fs";
import path from "node:path";
import type { AudioTrack } from "../src/schema/video-spec";
import { resolveMusicProvider } from "./lib/ai-config";
import { toPcmWavAs } from "./lib/media";
import { clipSeconds, describeMusicPreset, generateMusicClip } from "./lib/music-providers";
import { AUDIO_LIBRARY_DIR, CATALOG_PATH, hasFlag, PUBLIC_DIR, requireProjectId, writeJson } from "./lib/paths";
import { buildRenderData, loadCatalog, loadSpec } from "./lib/render-data";
import { withRetry } from "./lib/retry";
import { parseWav, pcmToWav } from "./lib/wav";

const RATE = 48000;
const CHANNELS = 2;
const CROSSFADE_SEC = 3;

const id = requireProjectId("npx tsx scripts/gen-music.ts <id> [--force] [--clips=N] [--provider=<preset>]");
const spec = loadSpec(id);
const { name, preset } = resolveMusicProvider(spec);
const trackId = `ai-${id}`;
const abs = path.join(AUDIO_LIBRARY_DIR, "music", `${trackId}.wav`);
const file = path.relative(PUBLIC_DIR, abs).split(path.sep).join("/");

console.log(`Nhạc nền cho "${id}" — provider "${name}" (${describeMusicPreset(preset)})`);

if (preset.type === "none") {
  console.log("  Bỏ qua: provider none. Dùng nhạc từ YouTube Audio Library (/scan-audio) hoặc chọn preset lyria.");
  process.exit(0);
}
if (!spec.musicPrompt) {
  console.error('  Thiếu "musicPrompt" trong spec.json (prompt tiếng Anh mô tả thể loại, nhạc cụ, mood, tempo).');
  process.exit(1);
}
if (fs.existsSync(abs) && !hasFlag("force")) {
  console.log(`  [skip] ${file} đã có. Dùng --force để tạo lại.`);
} else {
  const clipsArg = Number(process.argv.find((a) => a.startsWith("--clips="))?.split("=")[1]);
  const clips = clipsArg > 0 ? Math.min(10, clipsArg) : spec.musicPrompt.clips;
  const { prompt, negativePrompt } = spec.musicPrompt;
  const planned = clips * clipSeconds(preset) - (clips - 1) * CROSSFADE_SEC;
  console.log(`  ${clips} clip ≈ ${planned}s nhạc (video ngắn hơn thì cắt, dài hơn thì lặp lại)`);

  // Each clip → 48 kHz stereo 16-bit PCM samples
  const parts: Int16Array[] = [];
  for (let i = 0; i < clips; i++) {
    const raw = await withRetry(`clip ${i + 1}`, () =>
      generateMusicClip(preset, { prompt, negativePrompt, seed: 1000 + i * 7919 }),
    );
    const wav = parseWav(toPcmWavAs(raw, RATE, CHANNELS));
    if (!wav) throw new Error("Không đọc được audio trả về");
    const pcm = new Int16Array(wav.data.buffer, wav.data.byteOffset, wav.data.length / 2);
    parts.push(pcm);
    console.log(`  [ok]   clip ${i + 1}/${clips} (${(pcm.length / CHANNELS / RATE).toFixed(1)}s)`);
  }

  // Join with linear crossfades (Remotion's ffmpeg has no acrossfade filter)
  const fade = CROSSFADE_SEC * RATE * CHANNELS;
  let out = parts[0];
  for (const next of parts.slice(1)) {
    const n = Math.min(fade, out.length, next.length);
    const joined = new Int16Array(out.length + next.length - n);
    joined.set(out.subarray(0, out.length - n));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      joined[out.length - n + k] = Math.round(out[out.length - n + k] * (1 - t) + next[k] * t);
    }
    joined.set(next.subarray(n), out.length);
    out = joined;
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, pcmToWav(Buffer.from(out.buffer, out.byteOffset, out.byteLength), RATE, CHANNELS, 16));
  const durationSec = Math.round((out.length / CHANNELS / RATE) * 10) / 10;

  // Upsert the catalog entry (scan-audio keeps entries whose file still exists)
  const catalog = loadCatalog();
  const entry: AudioTrack = {
    id: trackId,
    type: "music",
    file,
    title: `AI: ${spec.title}`,
    artist: `AI (${name})`,
    genre: "AI-generated",
    mood: prompt.slice(0, 80),
    durationSec,
    attributionRequired: false,
    attributionText: "",
    notes: `Tạo bằng AI (${describeMusicPreset(preset)}). Prompt: ${prompt}`,
  };
  const tracks = [...catalog.tracks.filter((t) => t.id !== trackId && t.file !== file), entry];
  writeJson(CATALOG_PATH, { updatedAt: new Date().toISOString(), tracks });
  console.log(`  → ${file} (${durationSec}s), catalog track "${trackId}"`);
}

if (spec.music?.trackId !== trackId) {
  console.warn(`  ⚠ spec.music.trackId chưa là "${trackId}". Đặt "music": { "trackId": "${trackId}" } để dùng nhạc này.`);
}
const { warnings } = buildRenderData(id);
warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
console.log("Xong.");
