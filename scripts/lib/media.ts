/**
 * Helpers shared by the image/voice providers: HTTP, shell commands, and
 * normalising whatever a provider returns into PNG / 16-bit PCM WAV.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./paths";
import { parseWav, pcmToWav } from "./wav";

/** fetch that throws on non-2xx, keeping the status code in the message so withRetry can match 429/5xx. */
export const httpFetch = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 600);
    throw new Error(`HTTP ${res.status} từ ${url}: ${body}`);
  }
  return res;
};

export const httpJson = async <T>(url: string, body: unknown, headers: Record<string, string> = {}) => {
  const res = await httpFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
};

export const tmpFile = (ext: string) =>
  path.join(os.tmpdir(), `yt-vtv-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);

/** ffmpeg shipped with Remotion's compositor package, else ffmpeg on PATH. */
const ffmpegBin = () => {
  const dir = path.join(ROOT, "node_modules", "@remotion");
  if (fs.existsSync(dir)) {
    for (const pkg of fs.readdirSync(dir).filter((d) => d.startsWith("compositor-"))) {
      for (const exe of ["ffmpeg.exe", "ffmpeg"]) {
        const p = path.join(dir, pkg, exe);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return "ffmpeg";
};

const ffmpeg = (args: string[]) => {
  const bin = ffmpegBin();
  // The bundled binary loads its shared libs from its own folder
  const libDir = path.dirname(bin);
  const r = spawnSync(bin, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    env: { ...process.env, LD_LIBRARY_PATH: [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") },
  });
  if (r.status !== 0) throw new Error(`ffmpeg lỗi: ${r.error?.message ?? r.stderr}`);
};

const isPng = (buf: Buffer) => buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;

/** ffmpeg picks the image decoder from the file extension, so name temp files by their magic bytes */
const imageExt = (buf: Buffer) => {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 0, 3) === "GIF") return "gif";
  if (buf.toString("ascii", 0, 2) === "BM") return "bmp";
  return "bin";
};

/**
 * JPEG/… → PNG (the pipeline stores scene-NN.png). Remotion's ffmpeg has no
 * WebP decoder; the browser sniffs image bytes anyway, so unconvertible
 * formats are kept as-is.
 */
export const toPng = (buf: Buffer) => {
  if (isPng(buf)) return buf;
  const src = tmpFile(imageExt(buf));
  const dst = tmpFile("png");
  try {
    fs.writeFileSync(src, buf);
    ffmpeg(["-i", src, "-frames:v", "1", "-update", "1", dst]);
    return fs.readFileSync(dst);
  } catch (err) {
    console.warn(`  (không đổi được sang PNG, giữ nguyên định dạng gốc: ${err instanceof Error ? err.message.trim() : err})`);
    return buf;
  } finally {
    fs.rmSync(src, { force: true });
    fs.rmSync(dst, { force: true });
  }
};

/**
 * Any audio (MP3, OGG, float WAV, streamed WAV with a bogus size…) →
 * canonical 16-bit PCM WAV with a 44-byte header.
 */
export const toPcmWav = (buf: Buffer) => {
  const wav = parseWav(buf);
  if (wav && wav.audioFormat === 1 && wav.bitsPerSample === 16 && wav.data.length > 0) {
    return pcmToWav(Buffer.from(wav.data), wav.sampleRate, wav.channels, 16);
  }
  const src = tmpFile("audio");
  const dst = tmpFile("wav");
  try {
    fs.writeFileSync(src, buf);
    ffmpeg(["-i", src, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", dst]);
    return fs.readFileSync(dst);
  } finally {
    fs.rmSync(src, { force: true });
    fs.rmSync(dst, { force: true });
  }
};

/** Any audio → 16-bit PCM WAV with the given sample rate / channel count (for joining music clips). */
export const toPcmWavAs = (buf: Buffer, sampleRate: number, channels: number) => {
  const wav = parseWav(buf);
  if (wav && wav.audioFormat === 1 && wav.bitsPerSample === 16 && wav.sampleRate === sampleRate && wav.channels === channels) {
    return pcmToWav(Buffer.from(wav.data), sampleRate, channels, 16);
  }
  const src = tmpFile("audio");
  const dst = tmpFile("wav");
  try {
    fs.writeFileSync(src, buf);
    ffmpeg(["-i", src, "-ac", String(channels), "-ar", String(sampleRate), "-c:a", "pcm_s16le", dst]);
    return fs.readFileSync(dst);
  } finally {
    fs.rmSync(src, { force: true });
    fs.rmSync(dst, { force: true });
  }
};

const quote =(s: string) => (process.platform === "win32" ? `"${s}"` : `'${s.replace(/'/g, `'\\''`)}'`);

/**
 * Run a user-defined command template. {{name}} placeholders are replaced by
 * vars (file paths are quoted), and also exposed as env vars YT_<NAME>.
 * Returns the bytes the command wrote to {{out}}.
 */
export const runCommand = (
  template: string,
  outputExt: string,
  vars: Record<string, string | number>,
  fileVars: Record<string, string>,
) => {
  const out = tmpFile(outputExt);
  const files: Record<string, string> = {};
  for (const [k, content] of Object.entries(fileVars)) {
    files[k] = tmpFile("txt");
    fs.writeFileSync(files[k], content, "utf8");
  }
  const all: Record<string, string> = { out, ...files };
  for (const [k, v] of Object.entries(vars)) all[k] = String(v);
  const pathKeys = new Set(["out", ...Object.keys(files)]);
  const cmd = template.replace(/\{\{(\w+)\}\}/g, (m, k: string) =>
    k in all ? (pathKeys.has(k) ? quote(all[k]) : all[k]) : m,
  );
  const env = { ...process.env };
  for (const [k, v] of Object.entries(all)) env[`YT_${k.toUpperCase()}`] = v;
  try {
    const r = spawnSync(cmd, { shell: true, cwd: ROOT, env, encoding: "utf8" });
    if (r.status !== 0 || !fs.existsSync(out)) {
      throw new Error(
        `Lệnh thất bại (exit ${r.status})${fs.existsSync(out) ? "" : ", không tạo ra file {{out}}"}\n${(r.stderr || r.stdout || "").slice(-800)}`,
      );
    }
    return fs.readFileSync(out);
  } finally {
    for (const f of [out, ...Object.values(files)]) fs.rmSync(f, { force: true });
  }
};
