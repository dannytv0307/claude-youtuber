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

/**
 * What fills the frame of a scene.
 * - image: AI image generated from visualPrompt (default)
 * - title | big-number | list | timeline | quote | compare: motion-graphics
 *   layouts drawn in code (src/layouts/), no AI needed
 * - custom: a React component Claude writes in src/custom/ (SVG illustration,
 *   animated diagram…), registered in src/custom/index.ts
 * Text in layouts is in spec.language.
 */
export const SceneVisualSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("image") }),
  z.object({ type: z.literal("title"), title: z.string(), subtitle: z.string().optional() }),
  z.object({
    type: z.literal("big-number"),
    value: z.number(),
    prefix: z.string().default(""),
    suffix: z.string().default(""),
    /** Decimal places shown while counting up */
    decimals: z.number().int().min(0).max(3).default(0),
    /** Thousands separators; false for years like 1635 */
    grouping: z.boolean().default(true),
    label: z.string(),
  }),
  z.object({ type: z.literal("list"), title: z.string().optional(), items: z.array(z.string()).min(1).max(6) }),
  z.object({
    type: z.literal("timeline"),
    title: z.string().optional(),
    events: z.array(z.object({ label: z.string(), text: z.string() })).min(2).max(6),
    /** Index of the event to emphasise */
    highlight: z.number().int().min(0).optional(),
  }),
  z.object({ type: z.literal("quote"), text: z.string(), author: z.string().optional() }),
  z.object({
    type: z.literal("compare"),
    title: z.string().optional(),
    left: z.object({ label: z.string(), items: z.array(z.string()).max(5) }),
    right: z.object({ label: z.string(), items: z.array(z.string()).max(5) }),
  }),
  z.object({
    type: z.literal("custom"),
    /** Key in src/custom/index.ts, e.g. "<projectId>/<ComponentName>" */
    component: z.string(),
    props: z.record(z.string(), z.unknown()).default({}),
  }),
]);

export type SceneVisual = z.infer<typeof SceneVisualSchema>;

export const SceneSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "scene id: lowercase letters, digits, dashes"),
  /** Text read by the voice-over (or shown as captions when there is no voice), in spec.language */
  narration: z.string().min(1),
  visual: SceneVisualSchema.default({ type: "image" }),
  /** English prompt for the image model, describing ONLY this scene's content. Required when visual.type is "image" */
  visualPrompt: z.string().default(""),
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
    /** Base colour behind code-drawn scenes (layouts, custom) */
    backgroundColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#11151c"),
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
  /** Preset names from ai-providers.json; omitted = that file's "default" */
  providers: z
    .object({ image: z.string().optional(), voice: z.string().optional(), music: z.string().optional() })
    .optional(),
  /**
   * Background music generated by AI (scripts/gen-music.ts). The result is
   * saved as catalog track "ai-<id>"; set music.trackId to that to use it.
   */
  musicPrompt: z
    .object({
      /** English description: genre, instruments, mood, tempo */
      prompt: z.string().min(1),
      negativePrompt: z.string().default("vocals, singing, lyrics, speech"),
      /** Clips generated and joined with crossfades (Lyria: ~30s each) */
      clips: z.number().int().min(1).max(10).default(1),
    })
    .optional(),
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
  visual: SceneVisualSchema,
  /** Path relative to public/, or null if not generated yet (always null for non-image visuals) */
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

/** Props of the "Video" composition, editable in Remotion Studio's props panel */
export const VideoPropsSchema = z.object({
  projectId: z.string(),
  /**
   * Voice speed: 1 = as generated, 1.25 = 25% faster. Pitch is kept; scenes,
   * captions and music ducking are re-timed so there are no gaps.
   */
  playbackRate: z.number().min(0.5).max(2).step(0.05).optional(),
});
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
