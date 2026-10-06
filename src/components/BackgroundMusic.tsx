import { Audio } from "@remotion/media";
import { interpolate, staticFile, useVideoConfig } from "remotion";
import type { SceneTiming } from "../timeline";

type Props = {
  file: string;
  volume: number;
  duckUnderVoice: boolean;
  timings: SceneTiming[];
};

const DUCK_FACTOR = 0.35;
const DUCK_RAMP = 8; // frames

export const BackgroundMusic: React.FC<Props> = ({ file, volume, duckUnderVoice, timings }) => {
  const { fps, durationInFrames } = useVideoConfig();

  const volumeAt = (f: number) => {
    const fadeIn = interpolate(f, [0, fps], [0, 1], { extrapolateRight: "clamp" });
    const fadeOut = interpolate(f, [durationInFrames - 2 * fps, durationInFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    let duck = 1;
    if (duckUnderVoice) {
      // distance (frames) to the nearest voice segment; 0 inside a segment
      let dist = Infinity;
      for (const t of timings) {
        if (f >= t.voiceStart && f <= t.voiceEnd) {
          dist = 0;
          break;
        }
        dist = Math.min(dist, Math.abs(f - t.voiceStart), Math.abs(f - t.voiceEnd));
      }
      duck = interpolate(dist, [0, DUCK_RAMP], [DUCK_FACTOR, 1], { extrapolateRight: "clamp" });
    }
    return volume * fadeIn * fadeOut * duck;
  };

  return (
    <Audio
      name="music"
      src={staticFile(file)}
      loop
      loopVolumeCurveBehavior="extend"
      volume={volumeAt}
      premountFor={fps}
    />
  );
};
