/**
 * Index tracks downloaded manually from YouTube Audio Library.
 *   npx tsx scripts/scan-audio-library.ts
 *
 * Scans public/audio-library/{music,sfx}/ and merges into catalog.json:
 * - new files get an entry (title parsed from the file name, duration measured)
 * - existing entries keep their hand-edited fields (mood, genre, attribution…)
 * - entries whose file disappeared are removed
 */
import fs from "node:fs";
import path from "node:path";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";
import type { AudioTrack } from "../src/schema/video-spec";
import { AUDIO_LIBRARY_DIR, CATALOG_PATH, PUBLIC_DIR, writeJson } from "./lib/paths";
import { loadCatalog } from "./lib/render-data";

const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg"]);

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const duration = async (abs: string) => {
  try {
    const { durationInSeconds } = await parseMedia({
      src: abs,
      reader: nodeReader,
      fields: { durationInSeconds: true },
      acknowledgeRemotionLicense: true,
    });
    return durationInSeconds ? Math.round(durationInSeconds * 10) / 10 : null;
  } catch {
    return null;
  }
};

const old = loadCatalog();
const byFile = new Map(old.tracks.map((t) => [t.file, t]));
const tracks: AudioTrack[] = [];
let added = 0;

for (const type of ["music", "sfx"] as const) {
  const dir = path.join(AUDIO_LIBRARY_DIR, type);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir).sort()) {
    if (!AUDIO_EXT.has(path.extname(name).toLowerCase())) continue;
    const abs = path.join(dir, name);
    const file = path.relative(PUBLIC_DIR, abs).split(path.sep).join("/");
    const existing = byFile.get(file);
    if (existing) {
      tracks.push({ ...existing, durationSec: existing.durationSec ?? (await duration(abs)) });
      continue;
    }
    // YouTube Audio Library downloads are usually named "<Title> - <Artist>.mp3"
    const base = path.basename(name, path.extname(name));
    const [title, artist = ""] = base.split(" - ").map((s) => s.trim());
    let id = `${type}-${slug(title)}`;
    while (tracks.some((t) => t.id === id)) id += "-2";
    tracks.push({
      id,
      type,
      file,
      title,
      artist,
      genre: "",
      mood: "",
      durationSec: await duration(abs),
      attributionRequired: false,
      attributionText: "",
      notes: "",
    });
    added++;
  }
}

const removed = old.tracks.filter((t) => !tracks.some((n) => n.file === t.file)).length;
writeJson(CATALOG_PATH, { updatedAt: new Date().toISOString(), tracks });

console.log(`catalog.json: ${tracks.length} track (+${added} mới, -${removed} đã xoá)`);
const incomplete = tracks.filter((t) => !t.mood || !t.genre);
if (incomplete.length) {
  console.log("Cần bổ sung genre/mood (và attribution nếu YouTube yêu cầu) cho:");
  incomplete.forEach((t) => console.log(`  - ${t.id} (${t.file})`));
}
