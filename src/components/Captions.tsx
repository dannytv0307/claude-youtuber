import { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../fonts";
import { captionChunks } from "../timeline";

type Props = {
  narration: string;
  voiceDurationSec: number;
  style: "karaoke" | "subtitle";
  accentColor: string;
  vertical: boolean;
};

export const Captions: React.FC<Props> = ({
  narration,
  voiceDurationSec,
  style,
  accentColor,
  vertical,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const chunks = useMemo(
    () =>
      captionChunks(narration, voiceDurationSec, fps, style === "karaoke" ? 4 : 12),
    [narration, voiceDurationSec, fps, style],
  );
  const chunk = chunks.find((c) => frame >= c.from && frame < c.to);
  if (!chunk) return null;

  if (style === "subtitle") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
        <div
          style={{
            marginBottom: vertical ? 360 : 90,
            maxWidth: width * 0.85,
            padding: "14px 28px",
            borderRadius: 12,
            background: "rgba(0,0,0,0.65)",
            color: "white",
            fontFamily,
            fontWeight: 600,
            fontSize: vertical ? 48 : 44,
            lineHeight: 1.3,
            textAlign: "center",
          }}
        >
          {chunk.text}
        </div>
      </AbsoluteFill>
    );
  }

  // Karaoke: big words, the "current" word highlighted by proportional timing
  const pop = spring({ frame: frame - chunk.from, fps, config: { damping: 14, mass: 0.6 } });
  const progress = interpolate(frame, [chunk.from, chunk.to], [0, chunk.words.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: vertical ? "center" : "flex-end",
        alignItems: "center",
        paddingTop: vertical ? 520 : 0,
        paddingBottom: vertical ? 0 : 110,
      }}
    >
      <div
        style={{
          transform: `scale(${0.85 + 0.15 * pop})`,
          maxWidth: width * 0.88,
          textAlign: "center",
          fontFamily,
          fontWeight: 800,
          fontSize: vertical ? 84 : 72,
          lineHeight: 1.15,
          textTransform: "uppercase",
          color: "white",
          WebkitTextStroke: `${vertical ? 4 : 3}px black`,
          paintOrder: "stroke fill",
          textShadow: "0 6px 18px rgba(0,0,0,0.6)",
        }}
      >
        {chunk.words.map((w, i) => (
          <span key={i} style={{ color: i < progress && i >= progress - 1 ? accentColor : "white" }}>
            {w}
            {i < chunk.words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
