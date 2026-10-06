/** Gemini TTS returns raw 16-bit little-endian mono PCM at 24 kHz. */
export const TTS_SAMPLE_RATE = 24000;

export const pcmToWav = (
  pcm: Buffer,
  sampleRate = TTS_SAMPLE_RATE,
  channels = 1,
  bitsPerSample = 16,
) => {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

/**
 * Walk the RIFF chunks of a WAV file. Tolerates extra chunks (LIST…) and
 * streamed files whose data size is 0xFFFFFFFF. Returns null if not a WAV.
 */
export const parseWav = (wav: Buffer) => {
  if (wav.length < 12 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }
  let fmt: { audioFormat: number; channels: number; sampleRate: number; byteRate: number; bitsPerSample: number } | null = null;
  for (let off = 12; off + 8 <= wav.length; ) {
    const id = wav.toString("ascii", off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      fmt = {
        audioFormat: wav.readUInt16LE(body),
        channels: wav.readUInt16LE(body + 2),
        sampleRate: wav.readUInt32LE(body + 4),
        byteRate: wav.readUInt32LE(body + 8),
        bitsPerSample: wav.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      if (!fmt) return null;
      const end = Math.min(body + size, wav.length);
      return { ...fmt, data: wav.subarray(body, end) };
    }
    off = body + size + (size % 2);
  }
  return null;
};

/** Duration of a WAV file, from its fmt/data chunks. */
export const wavDurationSec = (wav: Buffer) => {
  const parsed = parseWav(wav);
  if (!parsed) throw new Error("File không phải WAV hợp lệ");
  return parsed.data.length / parsed.byteRate;
};
