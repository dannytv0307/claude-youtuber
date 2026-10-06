import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import {
  FORMATS,
  FPS,
  RenderDataSchema,
  totalDurationInFrames,
  VideoPropsSchema,
} from "./schema/video-spec";
import { withPlaybackRate } from "./timeline";
import { VideoFromSpec, type VideoProps } from "./VideoFromSpec";

/**
 * One composition for every project: size and length come from
 * public/projects/<projectId>/render.json (written by the scripts/ tools).
 * Switch project in Studio by editing the "projectId" prop; "playbackRate" speeds the voice up/down.
 */
const calculateMetadata: CalculateMetadataFunction<VideoProps> = async ({
  props,
  abortSignal,
}) => {
  const url = staticFile(`projects/${props.projectId}/render.json`);
  const res = await fetch(`${url}?t=${Date.now()}`, { signal: abortSignal });
  if (!res.ok) {
    return { durationInFrames: 5 * FPS, props: { ...props, data: null } };
  }
  const data = withPlaybackRate(RenderDataSchema.parse(await res.json()), props.playbackRate ?? 1);
  const { width, height } = FORMATS[data.spec.format];
  return {
    durationInFrames: totalDurationInFrames(data.scenes, FPS),
    width,
    height,
    fps: FPS,
    props: { ...props, data },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Video"
      component={VideoFromSpec}
      schema={VideoPropsSchema}
      durationInFrames={5 * FPS}
      fps={FPS}
      width={FORMATS.short.width}
      height={FORMATS.short.height}
      defaultProps={{ projectId: "sample-short-vi", playbackRate: 1 } satisfies VideoProps}
      calculateMetadata={calculateMetadata}
    />
  );
};
