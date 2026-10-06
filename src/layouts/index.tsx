/**
 * Motion-graphics layouts drawn entirely in code (no AI image needed).
 * Selected per scene by spec.scenes[].visual.type. Content stays out of the
 * caption zone (bottom of the frame for 16:9, lower-middle for 9:16).
 */
import type React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../fonts";
import type { SceneVisual, VideoSpec } from "../schema/video-spec";

type LayoutVisual = Exclude<SceneVisual, { type: "image" } | { type: "custom" }>;
export type LayoutType = LayoutVisual["type"];

/** Spring 0→1 starting at `delay` frames */
const useEnter = (delay = 0, damping = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/** Pixel unit that scales with the frame; layouts are designed for a 1080px short side */
const useUnit = () => {
  const { width, height } = useVideoConfig();
  return { u: Math.min(width, height) / 1080, vertical: height > width };
};

/** Spread n reveals over the first `share` of the scene, at most `max` frames apart */
const useStagger = (n: number, share = 0.55, max = 18) => {
  const { durationInFrames } = useVideoConfig();
  return Math.min(max, (durationInFrames * share) / Math.max(n, 1));
};

/** Dark base colour with two slow-drifting accent glows. */
export const LayoutBackground: React.FC<{ spec: VideoSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { accentColor, backgroundColor } = spec.style;
  const x1 = 30 + 10 * Math.sin(frame / 90);
  const y1 = 25 + 8 * Math.cos(frame / 110);
  const x2 = 75 + 8 * Math.cos(frame / 100);
  const y2 = 80 + 6 * Math.sin(frame / 80);
  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        backgroundImage: [
          `radial-gradient(circle at ${x1}% ${y1}%, ${accentColor}33 0%, transparent 45%)`,
          `radial-gradient(circle at ${x2}% ${y2}%, ${accentColor}22 0%, transparent 40%)`,
          "radial-gradient(rgba(255,255,255,0.06) 1.5px, transparent 1.5px)",
        ].join(","),
        backgroundSize: "100% 100%, 100% 100%, 36px 36px",
      }}
    />
  );
};

/** Content box above the caption zone */
const Stage: React.FC<{ children: React.ReactNode; justify?: React.CSSProperties["justifyContent"] }> = ({
  children,
  justify = "center",
}) => {
  const { vertical, u } = useUnit();
  return (
    <div
      style={{
        position: "absolute",
        left: (vertical ? 70 : 140) * u,
        right: (vertical ? 70 : 140) * u,
        top: (vertical ? 200 : 70) * u,
        bottom: (vertical ? 820 : 250) * u,
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        alignItems: "center",
        fontFamily,
        color: "white",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
};

const Heading: React.FC<{ text: string; accent: string }> = ({ text, accent }) => {
  const { u } = useUnit();
  const t = useEnter(0);
  return (
    <div style={{ marginBottom: 40 * u, opacity: t, transform: `translateY(${(1 - t) * -30}px)` }}>
      <div style={{ fontWeight: 800, fontSize: 64 * u, lineHeight: 1.15 }}>{text}</div>
      <div
        style={{
          height: 8 * u,
          width: `${interpolate(t, [0, 1], [0, 40])}%`,
          margin: `${16 * u}px auto 0`,
          borderRadius: 4 * u,
          background: accent,
        }}
      />
    </div>
  );
};

const TitleLayout: React.FC<{ v: Extract<LayoutVisual, { type: "title" }>; spec: VideoSpec }> = ({ v, spec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useUnit();
  const words = v.title.split(/\s+/);
  const sub = useEnter(words.length * 3 + 8);
  const bar = useEnter(words.length * 3 + 4);
  return (
    <Stage>
      <div style={{ fontWeight: 800, fontSize: 120 * u, lineHeight: 1.08, textTransform: "uppercase" }}>
        {words.map((w, i) => {
          const t = spring({ frame: frame - i * 3, fps, config: { damping: 14 } });
          return (
            <span
              key={i}
              style={{ display: "inline-block", opacity: t, transform: `translateY(${(1 - t) * 60}px)`, marginRight: "0.25em" }}
            >
              {w}
            </span>
          );
        })}
      </div>
      <div
        style={{
          height: 12 * u,
          width: `${interpolate(bar, [0, 1], [0, 30])}%`,
          margin: `${36 * u}px 0`,
          borderRadius: 6 * u,
          background: spec.style.accentColor,
        }}
      />
      {v.subtitle ? (
        <div style={{ fontWeight: 600, fontSize: 52 * u, opacity: sub, color: "rgba(255,255,255,0.85)" }}>
          {v.subtitle}
        </div>
      ) : null}
    </Stage>
  );
};

const BigNumberLayout: React.FC<{ v: Extract<LayoutVisual, { type: "big-number" }>; spec: VideoSpec }> = ({
  v,
  spec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useUnit();
  const progress = interpolate(frame, [0, 1.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const shown = new Intl.NumberFormat(spec.language, {
    minimumFractionDigits: v.decimals,
    maximumFractionDigits: v.decimals,
    useGrouping: v.grouping,
  }).format(v.value * progress);
  const label = useEnter(Math.round(0.9 * fps));
  const pop = spring({ frame: frame - 1.4 * fps, fps, config: { damping: 8 } });
  return (
    <Stage>
      <div
        style={{
          fontWeight: 800,
          fontSize: 220 * u,
          lineHeight: 1,
          color: spec.style.accentColor,
          transform: `scale(${1 + 0.06 * Math.sin(pop * Math.PI)})`,
          fontVariantNumeric: "tabular-nums",
          textShadow: `0 0 ${60 * u}px ${spec.style.accentColor}66`,
        }}
      >
        {v.prefix}
        {shown}
        {v.suffix}
      </div>
      <div
        style={{
          marginTop: 40 * u,
          fontWeight: 600,
          fontSize: 56 * u,
          opacity: label,
          transform: `translateY(${(1 - label) * 30}px)`,
        }}
      >
        {v.label}
      </div>
    </Stage>
  );
};

const ListLayout: React.FC<{ v: Extract<LayoutVisual, { type: "list" }>; spec: VideoSpec }> = ({ v, spec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useUnit();
  const gap = useStagger(v.items.length);
  const start = v.title ? 10 : 0;
  return (
    <Stage>
      {v.title ? <Heading text={v.title} accent={spec.style.accentColor} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 26 * u, alignSelf: "stretch" }}>
        {v.items.map((item, i) => {
          const t = spring({ frame: frame - start - i * gap, fps, config: { damping: 16 } });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28 * u,
                opacity: t,
                transform: `translateX(${(1 - t) * -80}px)`,
                textAlign: "left",
              }}
            >
              <div
                style={{
                  flex: "none",
                  width: 76 * u,
                  height: 76 * u,
                  borderRadius: "50%",
                  background: spec.style.accentColor,
                  color: spec.style.backgroundColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 40 * u,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontWeight: 600, fontSize: 50 * u, lineHeight: 1.2 }}>{item}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

const TimelineLayout: React.FC<{ v: Extract<LayoutVisual, { type: "timeline" }>; spec: VideoSpec }> = ({
  v,
  spec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useUnit();
  const gap = useStagger(v.events.length);
  const start = v.title ? 10 : 0;
  const lastAt = start + (v.events.length - 1) * gap;
  const line = interpolate(frame, [start, lastAt + 10], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const accent = spec.style.accentColor;

  return (
    <Stage>
      {v.title ? <Heading text={v.title} accent={accent} /> : null}
      <div
        style={{
          position: "relative",
          alignSelf: "stretch",
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          justifyContent: "space-between",
          gap: 20 * u,
        }}
      >
        {/* Track drawn progressively behind the dots */}
        <div
          style={{
            position: "absolute",
            background: "rgba(255,255,255,0.18)",
            ...(vertical
              ? { left: 23 * u, top: 0, bottom: 0, width: 6 * u }
              : { top: 23 * u, left: 0, right: 0, height: 6 * u }),
          }}
        />
        <div
          style={{
            position: "absolute",
            background: accent,
            ...(vertical
              ? { left: 23 * u, top: 0, height: `${line}%`, width: 6 * u }
              : { top: 23 * u, left: 0, width: `${line}%`, height: 6 * u }),
          }}
        />
        {v.events.map((e, i) => {
          const t = spring({ frame: frame - start - i * gap, fps, config: { damping: 14 } });
          const hi = v.highlight === i;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                flex: 1,
                display: "flex",
                flexDirection: vertical ? "row" : "column",
                alignItems: vertical ? "flex-start" : "center",
                gap: 20 * u,
                opacity: t,
                textAlign: vertical ? "left" : "center",
              }}
            >
              <div
                style={{
                  flex: "none",
                  width: 52 * u,
                  height: 52 * u,
                  borderRadius: "50%",
                  background: hi ? accent : spec.style.backgroundColor,
                  border: `${6 * u}px solid ${accent}`,
                  transform: `scale(${t * (hi ? 1.25 : 1)})`,
                  boxShadow: hi ? `0 0 ${40 * u}px ${accent}` : "none",
                }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: (hi ? 50 : 42) * u, color: accent }}>{e.label}</div>
                <div style={{ fontWeight: 600, fontSize: 34 * u, lineHeight: 1.25, marginTop: 6 * u }}>{e.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

const QuoteLayout: React.FC<{ v: Extract<LayoutVisual, { type: "quote" }>; spec: VideoSpec }> = ({ v, spec }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { u } = useUnit();
  const mark = useEnter(0, 10);
  const words = v.text.split(/\s+/);
  const perWord = Math.min(4, (durationInFrames * 0.5) / words.length);
  const author = useEnter(Math.round(words.length * perWord + 0.3 * fps));
  return (
    <Stage>
      <div
        style={{
          fontWeight: 800,
          fontSize: 220 * u,
          lineHeight: 0.6,
          height: 120 * u,
          color: spec.style.accentColor,
          transform: `scale(${mark})`,
        }}
      >
        “
      </div>
      <div style={{ fontWeight: 600, fontSize: 60 * u, lineHeight: 1.3 }}>
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              opacity: interpolate(frame, [i * perWord, i * perWord + 6], [0.15, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {w}{" "}
          </span>
        ))}
      </div>
      {v.author ? (
        <div style={{ marginTop: 40 * u, fontWeight: 600, fontSize: 40 * u, opacity: author, color: spec.style.accentColor }}>
          — {v.author}
        </div>
      ) : null}
    </Stage>
  );
};

const CompareLayout: React.FC<{ v: Extract<LayoutVisual, { type: "compare" }>; spec: VideoSpec }> = ({
  v,
  spec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useUnit();
  const accent = spec.style.accentColor;
  const rows = Math.max(v.left.items.length, v.right.items.length);
  const gap = useStagger(rows * 2 + 2);
  const start = v.title ? 10 : 0;
  const vs = useEnter(start + gap, 10);

  const column = (side: typeof v.left, offset: number, highlight: boolean) => {
    const t = spring({ frame: frame - start - offset * gap, fps, config: { damping: 16 } });
    return (
      <div
        style={{
          flex: 1,
          padding: 36 * u,
          borderRadius: 28 * u,
          background: highlight ? `${accent}26` : "rgba(255,255,255,0.07)",
          border: `${3 * u}px solid ${highlight ? accent : "rgba(255,255,255,0.15)"}`,
          opacity: t,
          transform: `translateY(${(1 - t) * 50}px)`,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 52 * u, color: highlight ? accent : "white", marginBottom: 20 * u }}>
          {side.label}
        </div>
        {side.items.map((item, i) => {
          const it = spring({ frame: frame - start - (2 + i * 2 + offset) * gap, fps, config: { damping: 16 } });
          return (
            <div key={i} style={{ fontWeight: 600, fontSize: 38 * u, lineHeight: 1.3, marginTop: 12 * u, opacity: it }}>
              {item}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Stage>
      {v.title ? <Heading text={v.title} accent={accent} /> : null}
      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          alignItems: "stretch",
          gap: 30 * u,
          position: "relative",
        }}
      >
        {column(v.left, 0, false)}
        <div
          style={{
            alignSelf: "center",
            fontWeight: 800,
            fontSize: 56 * u,
            color: accent,
            transform: `scale(${vs})`,
          }}
        >
          VS
        </div>
        {column(v.right, 1, true)}
      </div>
    </Stage>
  );
};

export const isLayout = (v: SceneVisual): v is LayoutVisual => v.type !== "image" && v.type !== "custom";

export const LayoutScene: React.FC<{ visual: LayoutVisual; spec: VideoSpec }> = ({ visual, spec }) => {
  const body = (() => {
    switch (visual.type) {
      case "title":
        return <TitleLayout v={visual} spec={spec} />;
      case "big-number":
        return <BigNumberLayout v={visual} spec={spec} />;
      case "list":
        return <ListLayout v={visual} spec={spec} />;
      case "timeline":
        return <TimelineLayout v={visual} spec={spec} />;
      case "quote":
        return <QuoteLayout v={visual} spec={spec} />;
      case "compare":
        return <CompareLayout v={visual} spec={spec} />;
    }
  })();
  return (
    <AbsoluteFill>
      <LayoutBackground spec={spec} />
      {body}
    </AbsoluteFill>
  );
};
