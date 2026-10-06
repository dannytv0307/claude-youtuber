import { z } from "zod";

/**
 * Shared schemas for the whole pipeline.
 * - VideoSpec: the structured script Claude writes to projects/<id>/spec.json
 * - RenderData: spec + generated assets, written to public/projects/<id>/render.json
 * - AudioCatalog: index of tracks downloaded from YouTube Audio Library
 */

export const FORMATS = {
  short: { width: 1080, height: 1920, aspectRatio: "9:16" },
  long: { width: 1920, height: 1080, aspectRatio: "16:9" },
} as const;

export const FPS = 30;

export const TransitionSchema = z.enum([
  "none",
  "fade",
  "slide-left",
  "slide-up",
  "wipe",
]);

export const SceneSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "scene id: lowercase letters, digits, dashes"),
  /** Text read by the voice-over, in spec.language */
  narration: z.string().min(1),
  /** English prompt for the image model, describing ONLY this scene's content */
  visualPrompt: z.string().min(1),
  /** Short headline shown on screen (optional, in spec.language) */
  onScreenText: z.string().optional(),
  /** Track ids from public/audio-library/catalog.json (type: sfx) */
  sfx: z.array(z.string()).default([]),
  /** Transition INTO the next scene */
  transition: TransitionSchema.default("fade"),
  /** Optional chapter title (long videos) - starts a YouTube chapter at this scene */
  chapter: z.string().optional(),
});

export const VideoSpecSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id: lowercase letters, digits, dashes"),
  format: z.enum(["short", "long"]),
  /** BCP-47 code, e.g. "vi-VN", "en-US" */
  language: z.string().min(2),
  title: z.string().min(1),
  targetDurationSec: z.number().positive(),
  style: z.object({
    /** Shared visual style guide appended to every image prompt (English) */
    visual: z.string().min(1),
    /** Narration tone, e.g. "energetic", "calm documentary" */
    tone: z.string().min(1),
    captionStyle: z.enum(["karaoke", "subtitle", "none"]).default("karaoke"),
    /** Hex accent color used for captions/headlines */
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#FFD400"),
  }),
  voice: z.object({
    /** Gemini prebuilt voice name, e.g. "Kore", "Puck", "Charon" */
    name: z.string().default("Kore"),
    /** Natural-language delivery instruction sent to Gemini TTS */
    styleInstruction: z.string().default("Read clearly and naturally."),
  }),
  music: z
    .object({
      trackId: z.string(),
      volume: z.number().min(0).max(1).default(0.25),
      /** Lower the music while the voice is speaking */
      duckUnderVoice: z.boolean().default(true),
    })
    .nullable()
    .default(null),
  scenes: z.array(SceneSchema).min(1),
});

export type VideoSpec = z.infer<typeof VideoSpecSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Transition = z.infer<typeof TransitionSchema>;

export const RenderSceneSchema = z.object({
  id: z.string(),
  narration: z.string(),
  onScreenText: z.string().optional(),
  transition: TransitionSchema,
  /** Path relative to public/, or null if not generated yet */
  image: z.string().nullable(),
  voice: z.string().nullable(),
  /** Real voice duration (from WAV) or an estimate when voice is missing */
  voiceDurationSec: z.number(),
  voiceIsEstimate: z.boolean(),
  /** Scene length on the timeline, including padding */
  durationSec: z.number(),
  sfx: z.array(z.object({ id: z.string(), file: z.string() })),
  visualPrompt: z.string(),
});

export const RenderDataSchema = z.object({
  spec: VideoSpecSchema,
  scenes: z.array(RenderSceneSchema),
  music: z
    .object({
      file: z.string(),
      volume: z.number(),
      duckUnderVoice: z.boolean(),
    })
    .nullable(),
  generatedAt: z.string(),
});

export type RenderData = z.infer<typeof RenderDataSchema>;
export type RenderScene = z.infer<typeof RenderSceneSchema>;

export const AudioTrackSchema = z.object({
  id: z.string(),
  type: z.enum(["music", "sfx"]),
  /** Path relative to public/, e.g. "audio-library/music/foo.mp3" */
  file: z.string(),
  title: z.string(),
  artist: z.string().default(""),
  genre: z.string().default(""),
  mood: z.string().default(""),
  durationSec: z.number().nullable(),
  /** YouTube Audio Library marks some tracks as "Attribution required" */
  attributionRequired: z.boolean().default(false),
  attributionText: z.string().default(""),
  notes: z.string().default(""),
});

export const AudioCatalogSchema = z.object({
  updatedAt: z.string(),
  tracks: z.array(AudioTrackSchema),
});

export type AudioTrack = z.infer<typeof AudioTrackSchema>;
export type AudioCatalog = z.infer<typeof AudioCatalogSchema>;

/** Transition length in frames (0 for "none") */
export const transitionFrames = (t: Transition, fps: number) =>
  t === "none" ? 0 : Math.round(0.5 * fps);

/** Total timeline length: sum of scenes minus transition overlaps */
export const totalDurationInFrames = (scenes: RenderScene[], fps: number) => {
  let total = 0;
  scenes.forEach((s, i) => {
    total += Math.ceil(s.durationSec * fps);
    if (i < scenes.length - 1) total -= transitionFrames(s.transition, fps);
  });
  return Math.max(total, 1);
};
