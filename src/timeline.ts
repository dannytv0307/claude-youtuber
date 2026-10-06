import { transitionFrames, type RenderData, type RenderScene } from "./schema/video-spec";

/** Silence before the voice in each scene - keep in sync with scripts/lib/render-data.ts */
export const LEAD_SEC = 0.3;

export type SceneTiming = {
  start: number;
  duration: number;
  voiceStart: number;
  voiceEnd: number;
};

/**
 * Speed the voice up/down by `rate`: each voice gets shorter by voice*(1-1/rate)
 * and its scene shrinks by the same amount, keeping lead/tail padding intact.
 */
export const withPlaybackRate = (data: RenderData, rate: number): RenderData =>
  rate === 1
    ? data
    : {
        ...data,
        scenes: data.scenes.map((s) => {
          const voiceDurationSec = s.voiceDurationSec / rate;
          return { ...s, voiceDurationSec, durationSec: s.durationSec - s.voiceDurationSec + voiceDurationSec };
        }),
      };

/** Absolute frame positions of each scene, accounting for transition overlaps. */
export const computeTimings = (scenes: RenderScene[], fps: number) => {
  const timings: SceneTiming[] = [];
  let cursor = 0;
  scenes.forEach((s, i) => {
    const duration = Math.ceil(s.durationSec * fps);
    const voiceStart = cursor + Math.round(LEAD_SEC * fps);
    timings.push({
      start: cursor,
      duration,
      voiceStart,
      voiceEnd: voiceStart + Math.round(s.voiceDurationSec * fps),
    });
    cursor += duration;
    if (i < scenes.length - 1) cursor -= transitionFrames(s.transition, fps);
  });
  return timings;
};

export type CaptionChunk = { text: string; words: string[]; from: number; to: number };

/**
 * Split narration into caption chunks and spread them over the voice duration
 * proportionally to their character length (no word-level timestamps needed).
 * Frames are relative to the scene start.
 */
export const captionChunks = (
  narration: string,
  voiceDurationSec: number,
  fps: number,
  maxWords: number,
): CaptionChunk[] => {
  const sentences = narration
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…;:])\s+/)
    .filter(Boolean);
  const chunks: string[][] = [];
  for (const sentence of sentences) {
    const words = sentence.split(" ");
    const n = Math.ceil(words.length / maxWords);
    const size = Math.ceil(words.length / n);
    for (let i = 0; i < words.length; i += size) chunks.push(words.slice(i, i + size));
  }
  const totalChars = chunks.reduce((s, c) => s + c.join(" ").length, 0) || 1;
  const lead = Math.round(LEAD_SEC * fps);
  const voiceFrames = voiceDurationSec * fps;
  let acc = 0;
  return chunks.map((words) => {
    const len = words.join(" ").length;
    const from = lead + Math.round((acc / totalChars) * voiceFrames);
    acc += len;
    const to = lead + Math.round((acc / totalChars) * voiceFrames);
    return { text: words.join(" "), words, from, to };
  });
};
