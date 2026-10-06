import {
  linearTiming,
  TransitionSeries,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Fragment, useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { z } from "zod";
import { BackgroundMusic } from "./components/BackgroundMusic";
import { SceneView } from "./components/SceneView";
import { fontFamily } from "./fonts";
import {
  transitionFrames,
  type RenderData,
  type Transition,
  type VideoPropsSchema,
} from "./schema/video-spec";
import { computeTimings } from "./timeline";

export type VideoProps = z.infer<typeof VideoPropsSchema> & {
  /** Filled by calculateMetadata from public/projects/<id>/render.json, already re-timed for playbackRate */
  data?: RenderData | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presentationFor = (t: Transition): TransitionPresentation<any> => {
  switch (t) {
    case "slide-left":
      return slide({ direction: "from-right" });
    case "slide-up":
      return slide({ direction: "from-bottom" });
    case "wipe":
      return wipe({ direction: "from-left" });
    default:
      return fade();
  }
};

export const VideoFromSpec: React.FC<VideoProps> = ({ projectId, playbackRate, data }) => {
  const { fps } = useVideoConfig();
  const timings = useMemo(() => (data ? computeTimings(data.scenes, fps) : []), [data, fps]);

  if (!data) {
    return (
      <AbsoluteFill
        style={{ backgroundColor: "#111", color: "white", fontFamily, fontSize: 40, padding: 80 }}
      >
        Chưa có render.json cho “{projectId}”. Chạy: npx tsx scripts/validate-spec.ts {projectId}
      </AbsoluteFill>
    );
  }

  const last = data.scenes.length - 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <TransitionSeries>
        {data.scenes.map((scene, i) => (
          <Fragment key={scene.id}>
            <TransitionSeries.Sequence
              name={scene.id}
              durationInFrames={timings[i].duration}
              premountFor={fps}
            >
              <SceneView scene={scene} index={i} spec={data.spec} voicePlaybackRate={playbackRate ?? 1} />
            </TransitionSeries.Sequence>
            {i < last && scene.transition !== "none" ? (
              <TransitionSeries.Transition
                presentation={presentationFor(scene.transition)}
                timing={linearTiming({ durationInFrames: transitionFrames(scene.transition, fps) })}
              />
            ) : null}
          </Fragment>
        ))}
      </TransitionSeries>
      {data.music ? (
        <BackgroundMusic
          file={data.music.file}
          volume={data.music.volume}
          duckUnderVoice={data.music.duckUnderVoice}
          // Duck only where a voice file actually plays (captions-only scenes keep full music)
          timings={timings.filter((_, i) => data.scenes[i].voice)}
        />
      ) : null}
    </AbsoluteFill>
  );
};
