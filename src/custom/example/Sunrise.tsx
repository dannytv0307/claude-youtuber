/**
 * Reference custom scene: a flat SVG landscape where the sun rises.
 * props: { "skyTop"?: string, "skyBottom"?: string }
 */
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CustomSceneProps } from "../types";

export const Sunrise: React.FC<CustomSceneProps> = ({ props, spec }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const skyTop = typeof props.skyTop === "string" ? props.skyTop : "#1b2a4a";
  const skyBottom = typeof props.skyBottom === "string" ? props.skyBottom : "#f28c38";
  const sunY = interpolate(t, [0, 1], [height * 0.75, height * 0.35]);
  const drift = interpolate(t, [0, 1], [0, width * 0.08]);

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skyTop} />
            <stop offset="100%" stopColor={skyBottom} />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#sky)" />
        <circle cx={width * 0.5} cy={sunY} r={Math.min(width, height) * 0.12} fill={spec.style.accentColor} />
        {/* Clouds drift slowly to the right */}
        <g fill="rgba(255,255,255,0.75)" transform={`translate(${drift} 0)`}>
          <ellipse cx={width * 0.2} cy={height * 0.22} rx={width * 0.09} ry={height * 0.03} />
          <ellipse cx={width * 0.7} cy={height * 0.15} rx={width * 0.12} ry={height * 0.035} />
        </g>
        {/* Two layers of hills cover the lower part of the sun */}
        <path
          d={`M0 ${height * 0.62} Q ${width * 0.3} ${height * 0.5} ${width * 0.6} ${height * 0.6} T ${width} ${height * 0.58} V ${height} H 0 Z`}
          fill="#3d5a3a"
        />
        <path
          d={`M0 ${height * 0.72} Q ${width * 0.4} ${height * 0.62} ${width} ${height * 0.7} V ${height} H 0 Z`}
          fill="#2a4029"
        />
      </svg>
    </AbsoluteFill>
  );
};
