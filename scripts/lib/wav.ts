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

/** Duration of a PCM WAV file written by pcmToWav (reads its header). */
export const wavDurationSec = (wav: Buffer) => {
  const byteRate = wav.readUInt32LE(28);
  const dataSize = wav.readUInt32LE(40);
  return dataSize / byteRate;
};
