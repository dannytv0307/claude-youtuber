import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { customScenes } from "../custom";
import { fontFamily } from "../fonts";
import { isLayout, LayoutBackground, LayoutScene } from "../layouts";
import type { RenderScene, VideoSpec } from "../schema/video-spec";
import { LEAD_SEC } from "../timeline";
import { Captions } from "./Captions";

type Props = {
  scene: RenderScene;
  index: number;
  spec: VideoSpec;
  /** scene.voiceDurationSec is already divided by this */
  voicePlaybackRate: number;
};

/** Slow zoom/pan ("Ken Burns"), direction alternates per scene. */
const KenBurns: React.FC<{ src: string; index: number }> = ({ src, index }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const zoomIn = index % 2 === 0;
  const scale = zoomIn ? 1 + 0.12 * t : 1.12 - 0.12 * t;
  const dx = (index % 3 === 0 ? -1 : 1) * 2 * t;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${dx}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Shown while the image has not been generated yet (or a custom component is missing). */
const Placeholder: React.FC<{ prompt: string; index: number }> = ({ prompt, index }) => {
  const hue = (index * 47) % 360;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, hsl(${hue} 45% 22%), hsl(${(hue + 60) % 360} 45% 10%))`,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          marginBottom: 200,
          color: "rgba(255,255,255,0.45)",
          fontFamily,
          fontSize: 30,
          lineHeight: 1.4,
          textAlign: "center",
        }}
      >
        [chưa có hình] {prompt}
      </div>
    </AbsoluteFill>
  );
};

/** The frame filler: AI image, code-drawn layout, or custom component */
const Visual: React.FC<{ scene: RenderScene; index: number; spec: VideoSpec }> = ({ scene, index, spec }) => {
  const visual = scene.visual;
  if (isLayout(visual)) return <LayoutScene visual={visual} spec={spec} />;
  if (visual.type === "custom") {
    const Custom = customScenes[visual.component];
    if (!Custom) return <Placeholder prompt={`[thiếu component "${visual.component}"]`} index={index} />;
    return (
      <AbsoluteFill>
        <LayoutBackground spec={spec} />
        <Custom props={visual.props} scene={scene} spec={spec} />
      </AbsoluteFill>
    );
  }
  return scene.image ? (
    <KenBurns src={scene.image} index={index} />
  ) : (
    <Placeholder prompt={scene.visualPrompt} index={index} />
  );
};

export const SceneView: React.FC<Props> = ({ scene, index, spec, voicePlaybackRate }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const headlineIn = spring({ frame: frame - 3, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Visual scene={scene} index={index} spec={spec} />

      {/* Darken top and bottom of images so text stays readable */}
      {scene.visual.type === "image" ? (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)",
          }}
        />
      ) : null}

      {/* Layouts carry their own text, so the headline is only drawn over images and custom scenes */}
      {scene.onScreenText && !isLayout(scene.visual) ? (
        <AbsoluteFill
          style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: vertical ? 220 : 70 }}
        >
          <div
            style={{
              opacity: headlineIn,
              transform: `translateY(${(1 - headlineIn) * -40}px)`,
              maxWidth: width * 0.86,
              textAlign: "center",
              fontFamily,
              fontWeight: 800,
              fontSize: vertical ? 70 : 64,
              lineHeight: 1.15,
              color: spec.style.accentColor,
              textShadow: "0 4px 16px rgba(0,0,0,0.75)",
            }}
          >
            {scene.onScreenText}
          </div>
        </AbsoluteFill>
      ) : null}

      {spec.style.captionStyle !== "none" ? (
        <Captions
          narration={scene.narration}
          voiceDurationSec={scene.voiceDurationSec}
          style={spec.style.captionStyle}
          accentColor={spec.style.accentColor}
          vertical={vertical}
        />
      ) : null}

      {scene.voice ? (
        <Audio
          name={`voice ${scene.id}`}
          src={staticFile(scene.voice)}
          from={Math.round(LEAD_SEC * fps)}
          playbackRate={voicePlaybackRate}
        />
      ) : null}

      {scene.sfx.map((s) => (
        <Sequence key={s.id} name={`sfx ${s.id}`} premountFor={fps}>
          <Audio src={staticFile(s.file)} volume={0.6} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
