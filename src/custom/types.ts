import type { RenderScene, VideoSpec } from "../schema/video-spec";

/**
 * Props every custom scene receives. Animate only from useCurrentFrame()
 * (frame 0 = scene start); useVideoConfig().durationInFrames = scene length.
 * Keep important content out of the caption zone (bottom ~25% for 16:9,
 * lower-middle for 9:16).
 */
export type CustomSceneProps = {
  /** visual.props from spec.json */
  props: Record<string, unknown>;
  scene: RenderScene;
  spec: VideoSpec;
};
