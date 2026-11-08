import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "remotion";
import { CursorActor } from "./effects/CursorActor";
import { LuminousMistEffect } from "./effects/LuminousMistEffect";
import { StackedKineticTypography } from "./effects/StackedKineticTypography";

export const VIDMAKE_LAUNCH_FRAMES = 1080; // 36.00s @ 30fps — Dynamic Rhythm (Slow Reads + Snappy Transitions)

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const DISPLAY_FONT =
  "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, BlinkMacSystemFont, sans-serif";
const SANS_FONT = "Inter, -apple-system, BlinkMacSystemFont, sans-serif";

const HOOK_LIBRARY_META = [
  { views: "2.4M", tag: "SaaS Hook", niche: "AI Productivity" },
  { views: "3.4M", tag: "98% Hold", niche: "Part-Time Job Hook" },
  { views: "1.9M", tag: "Top 1%", niche: "Founder POV" },
  { views: "4.8M", tag: "Viral Format", niche: "App Reveal" },
  { views: "2.9M", tag: "High ROAS", niche: "Stop Scrolling" },
  { views: "5.1M", tag: "Trending", niche: "Before / After" },
  { views: "1.7M", tag: "Organic Hit", niche: "Secret Tool" },
  { views: "3.8M", tag: "96% Hook", niche: "Reaction Split" },
];

const TH_LIBRARY_META = [
  { views: "2.7M", tag: "Creator Pitch", niche: "SaaS Walkthrough" },
  { views: "1.8M", tag: "UGC Review", niche: "Mobile App Demo" },
  { views: "4.1M", tag: "99% Lip-Sync", niche: "AI Creator Pitch" },
  { views: "3.2M", tag: "Viral Script", niche: "Problem → Fix" },
  { views: "2.5M", tag: "High Convert", niche: "AI Tool Breakdown" },
  { views: "3.9M", tag: "Top Creator", niche: "Day in the Life" },
  { views: "1.6M", tag: "Hook + Demo", niche: "Productivity Hack" },
  { views: "4.4M", tag: "Viral Testimonial", niche: "Growth Case" },
];

const SLIDE_LIBRARY_META = [
  { views: "3.1M", tag: "6 Slides", niche: "App Blocker" },
  { views: "4.6M", tag: "6 Slides", niche: "5 Tips Listicle" },
  { views: "2.2M", tag: "6 Slides", niche: "Focus Timer" },
  { views: "5.4M", tag: "6 Slides", niche: "Study Helper" },
  { views: "1.9M", tag: "6 Slides", niche: "Marketing AI" },
  { views: "3.7M", tag: "6 Slides", niche: "Habit Tracker" },
  { views: "2.8M", tag: "6 Slides", niche: "Fitness Coach" },
  { views: "4.2M", tag: "6 Slides", niche: "Language App" },
];

/**
 * RecreatedHookTextOverlay renders the native TikTok-style hook text from HookVideoPromo
 * ("Coding for 6 months ❌ / This can make content for me ✅") on the recreated Hook Video.
 */
const RecreatedHookTextOverlay: React.FC = () => {
  const thinStrokeShadow =
    "-0.85px -0.85px 0 rgba(0, 0, 0, 0.85), 0.85px -0.85px 0 rgba(0, 0, 0, 0.85), -0.85px 0.85px 0 rgba(0, 0, 0, 0.85), 0.85px 0.85px 0 rgba(0, 0, 0, 0.85), 0px 2px 6px rgba(0, 0, 0, 0.5)";

  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        pointerEvents: "none",
        zIndex: 15,
      }}
    >
      <div
        style={{
          fontFamily: SANS_FONT,
          fontWeight: 700,
          fontSize: 20,
          lineHeight: 1.24,
          color: "#FFFFFF",
          textAlign: "center",
          textShadow: thinStrokeShadow,
        }}
      >
        Coding for 6 months ❌
      </div>
      <div
        style={{
          fontFamily: SANS_FONT,
          fontWeight: 700,
          fontSize: 20,
          lineHeight: 1.24,
          color: "#FFFFFF",
          textAlign: "center",
          textShadow: thinStrokeShadow,
        }}
      >
        This can make content for me ✅
      </div>
    </div>
  );
};

/**
 * FourPointShootingStar renders the Arcjet-inspired 4-point glowing star (`✦`)
 * with a directional light trail that streaks across the frame during transitions.
 */
const FourPointShootingStar: React.FC<{
  startFrame: number;
  durationFrames?: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color?: string;
  size?: number;
}> = ({
  startFrame,
  durationFrames = 22,
  fromX,
  fromY,
  toX,
  toY,
  color = "#00F0FF",
  size = 44,
}) => {
  const frame = useCurrentFrame();
  if (frame < startFrame || frame > startFrame + durationFrames) return null;

  const rel = frame - startFrame;
  const p = interpolate(rel, [0, durationFrames], [0, 1], CLAMP);
  const eased = 1 - Math.pow(1 - p, 2.6);

  const x = interpolate(eased, [0, 1], [fromX, toX]);
  const y = interpolate(eased, [0, 1], [fromY, toY]);
  const opacity = interpolate(p, [0, 0.15, 0.82, 1], [0, 1, 1, 0], CLAMP);
  const rot = interpolate(p, [0, 1], [0, 180]);
  const angleDeg = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate3d(${x}px, ${y}px, 0)`,
        opacity,
        zIndex: 110,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 0,
          top: -4,
          width: 220,
          height: 8,
          borderRadius: 999,
          background: `linear-gradient(90deg, transparent 0%, ${color} 70%, #FFFFFF 100%)`,
          transformOrigin: "right center",
          transform: `rotate(${angleDeg}deg)`,
          filter: "blur(3px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `rotate(${rot}deg)`,
          color: "#FFFFFF",
          fontSize: size,
          textShadow: `0 0 18px #FFFFFF, 0 0 36px ${color}, 0 0 64px #FF176B`,
        }}
      >
        ✦
      </div>
    </div>
  );
};

/**
 * OpticalBloomText renders the Arcjet-style word-by-word optical chromatic blur-to-sharp
 * reveal with per-character high-energy flicker.
 */
const OpticalBloomText: React.FC<{
  words: Array<{
    text: string;
    accent?: "cyan" | "magenta" | "lime" | "white";
    underline?: boolean;
  }>;
  startFrame: number;
  staggerFrames?: number;
  fontSize?: number;
  lineHeight?: number;
  justify?: "center" | "flex-start";
}> = ({
  words,
  startFrame,
  staggerFrames = 4,
  fontSize = 86,
  lineHeight = 0.96,
  justify = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: justify,
        gap: "12px 20px",
      }}
    >
      {words.map((w, idx) => {
        const wStart = startFrame + idx * staggerFrames;
        const rel = frame - wStart;
        if (rel < 0) return null;

        const spr = spring({
          frame: rel,
          fps,
          config: { damping: 12, mass: 0.38, stiffness: 360 },
        });

        const blurPx = interpolate(rel, [0, 4, 10], [22, 6, 0], CLAMP);
        const y = interpolate(spr, [0, 1], [34, 0]);
        const scale = interpolate(spr, [0, 0.7, 1], [1.24, 0.96, 1]);
        const opacity = interpolate(rel, [0, 3], [0, 1], CLAMP);

        const flicker =
          rel >= 2 && rel <= 5 && idx % 2 === 1 ? (rel % 2 === 0 ? 0.65 : 1) : 1;

        const colorMap = {
          white: "#FFFFFF",
          cyan: "#00F0FF",
          magenta: "#FF176B",
          lime: "#D4FF00",
        };
        const textColor = colorMap[w.accent ?? "white"];
        const glowShadow =
          w.accent === "cyan"
            ? "0 0 36px rgba(0, 240, 255, 0.75), 0 12px 32px rgba(0, 0, 0, 0.9)"
            : w.accent === "magenta"
              ? "0 0 38px rgba(255, 23, 107, 0.8), 0 12px 32px rgba(0, 0, 0, 0.9)"
              : w.accent === "lime"
                ? "0 0 36px rgba(212, 255, 0, 0.75), 0 12px 32px rgba(0, 0, 0, 0.9)"
                : "0 0 28px rgba(99, 102, 241, 0.55), 0 12px 32px rgba(0, 0, 0, 0.92)";

        const underlineW = w.underline
          ? interpolate(rel, [3, 13], [0, 100], CLAMP)
          : 0;

        return (
          <span
            key={idx}
            style={{
              position: "relative",
              display: "inline-block",
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize,
              lineHeight,
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
              color: textColor,
              textShadow: glowShadow,
              transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
              opacity: opacity * flicker,
              filter: blurPx > 0.2 ? `blur(${blurPx}px)` : "none",
            }}
          >
            {w.text}
            {w.underline && (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: -10,
                  width: `${underlineW}%`,
                  height: 8,
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, #00F0FF 0%, #FF176B 65%, #D4FF00 100%)",
                  boxShadow:
                    "0 0 24px rgba(0, 240, 255, 0.9), 0 0 36px rgba(255, 23, 107, 0.8)",
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
};

/**
 * PushableRecreateButton renders the 3D tactile "✦ Recreate" button at the bottom-right
 * of the isolated Viral Format container, matching the user's hand-drawn sketch.
 */
const PushableRecreateButton: React.FC<{
  relFrame: number;
  hoverRelFrame: number;
  clickRelFrame: number;
  label?: string;
  doneLabel?: string;
}> = ({
  relFrame,
  hoverRelFrame,
  clickRelFrame,
  label = "Recreate",
  doneLabel = "Recreated ✓",
}) => {
  const { fps } = useVideoConfig();
  const enterSpr = spring({
    frame: Math.max(0, relFrame),
    fps,
    config: { damping: 12, mass: 0.4, stiffness: 320 },
  });

  const hoverProg = interpolate(
    relFrame,
    [hoverRelFrame, hoverRelFrame + 5],
    [0, 1],
    CLAMP
  );
  const isClicked = relFrame >= clickRelFrame;
  const isDone = relFrame >= clickRelFrame + 12;
  const clickAge = Math.max(0, relFrame - clickRelFrame);

  const frontY = isClicked
    ? interpolate(clickAge, [0, 3, 8], [-12, -2, -10], CLAMP)
    : interpolate(hoverProg, [0, 1], [-8, -14]);

  const pulseGlow = interpolate(hoverProg, [0, 1], [0.45, 0.95]);
  const scale = interpolate(enterSpr, [0, 1], [0.7, 1]);

  return (
    <div
      style={{
        position: "relative",
        width: 280,
        height: 76,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -8,
          borderRadius: 24,
          background: isDone
            ? "radial-gradient(circle, rgba(0, 240, 255, 0.65) 0%, transparent 72%)"
            : "radial-gradient(circle, rgba(255, 23, 107, 0.72) 0%, rgba(0, 240, 255, 0.4) 55%, transparent 75%)",
          filter: "blur(14px)",
          opacity: pulseGlow,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          background: isDone
            ? "linear-gradient(90deg, #0369A1 0%, #0284C7 50%, #0369A1 100%)"
            : "linear-gradient(90deg, #880E4F 0%, #BE123C 50%, #880E4F 100%)",
          boxShadow: "0 16px 34px rgba(0, 0, 0, 0.85)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 18,
          background: isDone
            ? "linear-gradient(135deg, #00F0FF 0%, #38BDF8 100%)"
            : "linear-gradient(135deg, #FF176B 0%, #FF4D94 55%, #7C3AED 100%)",
          border: "1.5px solid rgba(255, 255, 255, 0.48)",
          boxShadow: "inset 0 2px 0 rgba(255, 255, 255, 0.38)",
          transform: `translateY(${frontY}px)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: isDone ? "#03040A" : "#FFFFFF",
        }}
      >
        <span
          style={{
            fontSize: 28,
            lineHeight: 1,
            transform: `rotate(${isClicked ? clickAge * 24 : 0}deg)`,
            display: "inline-block",
          }}
        >
          ✦
        </span>
        <span
          style={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {isDone ? doneLabel : isClicked ? "Recreating..." : label}
        </span>
      </div>
    </div>
  );
};

/**
 * WorkflowTopBanner renders the sleek top step indicator ("01 / HOOK VIDEO", "02 / TALKING HEAD", "03 / SLIDESHOW").
 */
const WorkflowTopBanner: React.FC<{
  stepNum: string;
  workflowName: string;
  activeStage: 0 | 1 | 2;
  accentColor: string;
}> = ({ stepNum, workflowName, activeStage, accentColor }) => {
  const stages = [
    "1. BROWSE VIRAL LIBRARY",
    "2. CLICK ✦ RECREATE",
    "3. RECREATED FOR YOUR SAAS",
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 32,
        left: 56,
        right: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 80,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 24px",
          borderRadius: 999,
          backgroundColor: "rgba(7, 9, 16, 0.88)",
          border: `1.5px solid ${accentColor}`,
          boxShadow: `0 14px 36px rgba(0, 0, 0, 0.85), 0 0 24px ${accentColor}44`,
        }}
      >
        <span
          style={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 900,
            fontSize: 22,
            color: accentColor,
            letterSpacing: "0.08em",
          }}
        >
          {stepNum}
        </span>
        <span
          style={{
            width: 1.5,
            height: 20,
            backgroundColor: "rgba(255, 255, 255, 0.22)",
          }}
        />
        <span
          style={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 900,
            fontSize: 24,
            color: "#FFFFFF",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
          }}
        >
          {workflowName}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {stages.map((label, idx) => {
          const isCurrent = idx === activeStage;
          const isPassed = idx < activeStage;
          return (
            <div
              key={label}
              style={{
                padding: "9px 20px",
                borderRadius: 999,
                backgroundColor: isCurrent
                  ? accentColor
                  : isPassed
                    ? "rgba(0, 240, 255, 0.14)"
                    : "rgba(15, 18, 28, 0.78)",
                border: isCurrent
                  ? "1.5px solid #FFFFFF"
                  : isPassed
                    ? "1.5px solid rgba(0, 240, 255, 0.5)"
                    : "1px solid rgba(255, 255, 255, 0.14)",
                boxShadow: isCurrent ? `0 0 26px ${accentColor}88` : "none",
                fontFamily: DISPLAY_FONT,
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: "0.06em",
                color: isCurrent
                  ? "#03040A"
                  : isPassed
                    ? "#00F0FF"
                    : "rgba(255, 255, 255, 0.52)",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * ViralLibrary4x2Grid renders the Left Box of the user's hand-drawn sketch:
 * An 8-card (4 columns x 2 rows) dark-glass library of proven viral videos/slideshows,
 * with all 8 cards fitting cleanly inside the container (`minmax(0, 1fr)`).
 */
const ViralLibrary4x2Grid: React.FC<{
  relFrame: number;
  thumbnails: string[];
  meta: Array<{ views: string; tag: string; niche: string }>;
  selectedIndex: number;
  highlightRelFrame: number;
  accentColor: string;
  libraryTitle: string;
}> = ({
  relFrame,
  thumbnails,
  meta,
  selectedIndex,
  highlightRelFrame,
  accentColor,
  libraryTitle,
}) => {
  const { fps } = useVideoConfig();
  const containerSpr = spring({
    frame: Math.max(0, relFrame),
    fps,
    config: { damping: 13, mass: 0.45, stiffness: 280 },
  });

  const scale = interpolate(containerSpr, [0, 1], [0.9, 1]);
  const rotateX = interpolate(containerSpr, [0, 1], [10, 2]);

  return (
    <div
      style={{
        position: "relative",
        width: 1520,
        height: 820,
        marginTop: 52,
        borderRadius: 32,
        backgroundColor: "rgba(8, 11, 20, 0.88)",
        border: "1.5px solid rgba(255, 255, 255, 0.18)",
        boxShadow:
          "0 40px 95px rgba(0, 0, 0, 0.92), inset 0 1px 0 rgba(255, 255, 255, 0.22)",
        padding: "22px 34px 28px 34px",
        display: "flex",
        flexDirection: "column",
        transform: `perspective(1400px) rotateX(${rotateX}deg) scale(${scale})`,
      }}
    >
      {/* Library Container Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: accentColor,
              boxShadow: `0 0 14px ${accentColor}`,
            }}
          />
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize: 26,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
              textTransform: "uppercase",
            }}
          >
            {libraryTitle}
          </span>
        </div>
        <div
          style={{
            padding: "6px 18px",
            borderRadius: 999,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            fontFamily: SANS_FONT,
            fontWeight: 700,
            fontSize: 15,
            color: "#E2E8F0",
          }}
        >
          🔥 10,000+ Proven Viral Formats
        </div>
      </div>

      {/* 4 Columns x 2 Rows Grid — Explicit minmax(0, 1fr) so both rows fit 100% cleanly! */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          gap: 18,
          flex: 1,
          minHeight: 0,
        }}
      >
        {thumbnails.slice(0, 8).map((src, idx) => {
          const cardDelay = idx * 1.4;
          const cardSpr = spring({
            frame: Math.max(0, relFrame - cardDelay),
            fps,
            config: { damping: 13, mass: 0.4, stiffness: 300 },
          });

          const isSelected = idx === selectedIndex;
          const isHighlighted = isSelected && relFrame >= highlightRelFrame;
          const highlightSpr = isHighlighted
            ? spring({
                frame: relFrame - highlightRelFrame,
                fps,
                config: { damping: 10, mass: 0.38, stiffness: 360 },
              })
            : 0;

          const cardScale =
            interpolate(cardSpr, [0, 1], [0.82, 1]) *
            interpolate(highlightSpr, [0, 1], [1, 1.04]);
          const dimOthers =
            relFrame >= highlightRelFrame && !isSelected
              ? interpolate(
                  relFrame,
                  [highlightRelFrame, highlightRelFrame + 10],
                  [1, 0.35],
                  CLAMP
                )
              : 1;

          const itemMeta = meta[idx] ?? {
            views: "2.5M",
            tag: "Viral",
            niche: "SaaS",
          };

          return (
            <div
              key={idx}
              style={{
                position: "relative",
                minHeight: 0,
                height: "100%",
                borderRadius: 18,
                overflow: "hidden",
                backgroundColor: "#0D111C",
                border: isHighlighted
                  ? `3px solid ${accentColor}`
                  : "1.5px solid rgba(255, 255, 255, 0.14)",
                boxShadow: isHighlighted
                  ? `0 0 38px ${accentColor}, 0 20px 44px rgba(0, 0, 0, 0.9)`
                  : "0 12px 28px rgba(0, 0, 0, 0.75)",
                transform: `scale(${cardScale})`,
                opacity: dimOthers,
                zIndex: isHighlighted ? 25 : 5,
              }}
            >
              <Img
                src={src}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 22%",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.48) 0%, transparent 32%, transparent 56%, rgba(0,0,0,0.88) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  right: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    backgroundColor: "rgba(0, 0, 0, 0.78)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    fontFamily: SANS_FONT,
                    fontWeight: 800,
                    fontSize: 12.5,
                    color: "#FFFFFF",
                  }}
                >
                  🔥 {itemMeta.views}
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    backgroundColor: isHighlighted
                      ? accentColor
                      : "rgba(255, 23, 107, 0.85)",
                    fontFamily: SANS_FONT,
                    fontWeight: 800,
                    fontSize: 11.5,
                    color: isHighlighted ? "#03040A" : "#FFFFFF",
                    textTransform: "uppercase",
                  }}
                >
                  {itemMeta.tag}
                </span>
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: 12,
                  right: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontWeight: 800,
                    fontSize: 16,
                    color: "#FFFFFF",
                  }}
                >
                  {itemMeta.niche}
                </span>
                {isHighlighted && (
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: 999,
                      backgroundColor: accentColor,
                      color: "#03040A",
                      fontFamily: DISPLAY_FONT,
                      fontWeight: 900,
                      fontSize: 12.5,
                      textTransform: "uppercase",
                      boxShadow: `0 0 16px ${accentColor}`,
                    }}
                  >
                    ✦ Select
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * IsolatedViralCardWithRecreate renders the Right Box of the user's hand-drawn sketch:
 * - Header at top: "VIRAL HOOK" / "VIRAL TALKING HEAD" / "VIRAL SLIDESHOW"
 * - Center vertical card showing the selected viral video/slideshow
 * - Bottom-right: The tactile "✦ Recreate" button pill that the cursor clicks!
 */
const IsolatedViralCardWithRecreate: React.FC<{
  relFrame: number;
  headerTitle: string;
  viewsLabel: string;
  nicheLabel: string;
  accentColor: string;
  hoverRelFrame: number;
  clickRelFrame: number;
  mediaNode: React.ReactNode;
}> = ({
  relFrame,
  headerTitle,
  viewsLabel,
  nicheLabel,
  accentColor,
  hoverRelFrame,
  clickRelFrame,
  mediaNode,
}) => {
  const { fps } = useVideoConfig();
  const snapSpr = spring({
    frame: Math.max(0, relFrame),
    fps,
    config: { damping: 12, mass: 0.4, stiffness: 330 },
  });

  const scale = interpolate(snapSpr, [0, 0.7, 1], [0.68, 1.04, 1]);
  const rotateY = interpolate(snapSpr, [0, 1], [-16, 0]);
  const isClicked = relFrame >= clickRelFrame;

  return (
    <div
      style={{
        position: "relative",
        width: 1180,
        height: 810,
        marginTop: 48,
        borderRadius: 36,
        backgroundColor: "rgba(9, 12, 22, 0.9)",
        border: `2px solid ${isClicked ? "#00F0FF" : accentColor}`,
        boxShadow: `0 44px 110px rgba(0, 0, 0, 0.95), 0 0 60px ${accentColor}38`,
        padding: "32px 48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        transform: `perspective(1300px) rotateY(${rotateY}deg) scale(${scale})`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 900,
            fontSize: 54,
            lineHeight: 0.92,
            letterSpacing: "-0.035em",
            color: "#FFFFFF",
            textTransform: "uppercase",
            textShadow: `0 0 28px ${accentColor}88`,
          }}
        >
          {headerTitle}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: SANS_FONT,
            fontWeight: 700,
            fontSize: 18,
            color: "#94A3B8",
          }}
        >
          <span style={{ color: accentColor }}>🔥 {viewsLabel}</span>
          <span>•</span>
          <span>{nicheLabel}</span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: 348,
          height: 590,
          borderRadius: 26,
          overflow: "hidden",
          backgroundColor: "#05070E",
          border: "2px solid rgba(255, 255, 255, 0.28)",
          boxShadow:
            "0 30px 75px rgba(0, 0, 0, 0.92), 0 0 42px rgba(255, 23, 107, 0.28)",
        }}
      >
        {mediaNode}
      </div>

      <div
        style={{
          position: "absolute",
          right: 54,
          bottom: 42,
        }}
      >
        <PushableRecreateButton
          relFrame={relFrame}
          hoverRelFrame={hoverRelFrame}
          clickRelFrame={clickRelFrame}
          label="Recreate"
          doneLabel="Recreated ✓"
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 54,
          bottom: 56,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span
          style={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 800,
            fontSize: 20,
            color: "#00F0FF",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          ✦ 1-CLICK CLONE ENGINE
        </span>
        <span
          style={{
            fontFamily: SANS_FONT,
            fontWeight: 600,
            fontSize: 16,
            color: "rgba(255, 255, 255, 0.68)",
            maxWidth: 260,
          }}
        >
          Keeps the exact viral pacing, camera & structure for your brand.
        </span>
      </div>
    </div>
  );
};

export const VidmakeLaunchPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Audio Assets — High-Momentum Fastlane Rhythm + Synced UI SFX
  const fastlaneMusicSrc = staticFile(
    "explore/covers/sources/vidmake/fastlane-music.mp3"
  );
  const sfxImpactSrc = staticFile(
    "explore/covers/sources/vidmake/sfx-impact.mp3"
  );
  const sfxWhooshSrc = staticFile(
    "explore/covers/sources/vidmake/sfx-whoosh.mp3"
  );
  const sfxClickSrc = staticFile(
    "explore/covers/sources/vidmake/sfx-click.mp3"
  );
  const sfxPopSrc = staticFile("explore/covers/sources/vidmake/sfx-pop.mp3");

  // Workflow Media Assets (Authentic AI Character + Hook + Demo + Talking Head)
  const aiCharFemaleFinalSrc = staticFile(
    "explore/covers/sources/aichar/aichar-part2-female-final.jpg"
  );
  const aiCharTraitLatinaSrc = staticFile(
    "explore/covers/sources/aichar/eth-latina.png"
  );
  const aiCharTraitMiddleEasternSrc = staticFile(
    "explore/covers/sources/aichar/eth-middle-eastern.png"
  );
  const aiCharTraitEastAsianSrc = staticFile(
    "explore/covers/sources/aichar/eth-east-asian.png"
  );

  const hookRecreatedVideoSrc = staticFile(
    "explore/covers/sources/hook-recreated-video.mp4"
  );
  const audioDragVideoSrc = staticFile(
    "explore/covers/sources/vidmake/audio-drag-video.mp4"
  );
  const thRecreatedVideoSrc = staticFile(
    "explore/covers/sources/talking-head-source.mp4"
  );

  const MONO_FONT = "'JetBrains Mono', monospace";
  const CLEAN_SANS =
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  // =========================================================================
  // VIDMAKE DESIGN TOKENS (from app/globals.css .dark)
  //   --background: #121212
  //   --card: #292929 / --surface-subtle: #242424
  //   --brand / --primary: #0078D4 (Vidmake Primary Blue)
  //   --instagram-orange: #FF5A1F / #FF7A18 (Warm Viral Accent)
  //   --success: #10B981 / #46B879 (Emerald Completion)
  // =========================================================================
  const VIDMAKE_BLUE = "#0078D4";
  const VIDMAKE_BLUE_BRIGHT = "#38BDF8";
  const VIDMAKE_ORANGE = "#FF7A18";
  const VIDMAKE_EMERALD = "#10B981";
  const VIDMAKE_EMERALD_TEXT = "#34D399";

  // Shared 3-Square L-Grid Spinner (in Vidmake Primary Blue #0078D4)
  const spinnerStep = Math.floor(frame / 3) % 4;
  const slotCoords = [
    { x: 2, y: 2 },
    { x: 18, y: 2 },
    { x: 18, y: 18 },
    { x: 2, y: 18 },
  ];
  const activeSlots = [
    slotCoords[(spinnerStep + 0) % 4],
    slotCoords[(spinnerStep + 1) % 4],
    slotCoords[(spinnerStep + 2) % 4],
  ];

  const renderThreeSquareSpinner = () => (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: "rgba(0, 120, 212, 0.18)",
        border: "1.5px solid rgba(56, 189, 248, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 0 18px rgba(0, 120, 212, 0.42)",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 32 32">
        {activeSlots.map((slot, idx) => (
          <rect
            key={idx}
            x={slot.x}
            y={slot.y}
            width="12"
            height="12"
            rx="3"
            fill={idx === 0 ? VIDMAKE_BLUE_BRIGHT : "#FFFFFF"}
          />
        ))}
      </svg>
    </div>
  );

  const renderCompletedBadge = () => (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: "rgba(16, 185, 129, 0.16)",
        border: "1.5px solid rgba(52, 211, 153, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: CLEAN_SANS,
        fontWeight: 800,
        fontSize: 20,
        color: VIDMAKE_EMERALD_TEXT,
      }}
    >
      ✓
    </div>
  );

  // Fastlane-Inspired Camera Momentum:
  // Smoothly zooms into the Input Bar while typing so the viewer can read the prompt clearly,
  // then whip-pans back out to 1.0x when Send is clicked!
  const getTypingCameraTransform = (
    typeStart: number,
    clickFrame: number
  ) => {
    if (frame < typeStart - 6 || frame > clickFrame + 16) {
      return "none";
    }
    const zoomIn = interpolate(
      frame,
      [typeStart - 6, typeStart + 14],
      [0, 1],
      CLAMP
    );
    const zoomOut = interpolate(
      frame,
      [clickFrame, clickFrame + 12],
      [0, 1],
      CLAMP
    );
    const activeZoom = zoomIn * (1 - zoomOut);
    const scale = 1 + activeZoom * 0.15;
    const tiltX = activeZoom * 2.0;
    return `perspective(1600px) scale(${scale.toFixed(4)}) rotateX(${tiltX.toFixed(2)}deg)`;
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#121212",
        overflow: "hidden",
        fontFamily: SANS_FONT,
      }}
    >
      {/* =================================================================== */}
      {/* UPGRADED HIGH-MOMENTUM AUDIO TRACK + SYNCED TRANSITION SFX          */}
      {/* =================================================================== */}
      <Audio
        src={fastlaneMusicSrc}
        startFrom={60}
        volume={(f) =>
          interpolate(f, [0, 15, 1045, 1080], [0, 0.48, 0.48, 0], CLAMP)
        }
      />
      {[4, 46, 150, 212, 258, 376, 424, 462, 590, 624, 780, 862, 968, 1040].map(
        (f) => (
          <Sequence key={`impact-${f}`} from={f} durationInFrames={30}>
            <Audio src={sfxImpactSrc} volume={0.52} />
          </Sequence>
        )
      )}
      {[44, 100, 168, 240, 336, 386, 448, 548, 676, 738, 926].map((f) => (
        <Sequence key={`whoosh-${f}`} from={f} durationInFrames={24}>
          <Audio src={sfxWhooshSrc} volume={0.55} />
        </Sequence>
      ))}
      {[150, 212, 376, 424, 590, 676, 780, 968].map((f) => (
        <Sequence key={`click-${f}`} from={f} durationInFrames={18}>
          <Audio src={sfxClickSrc} volume={0.78} />
        </Sequence>
      ))}
      {[254, 294, 458, 502, 624, 694, 788, 862, 1012, 1040].map((f) => (
        <Sequence key={`pop-${f}`} from={f} durationInFrames={18}>
          <Audio src={sfxPopSrc} volume={0.64} />
        </Sequence>
      ))}

      <style>
        {`
          @font-face {
            font-family: 'Silkscreen Pixel';
            font-style: normal;
            font-weight: 400;
            src: url('${staticFile("fonts/silkscreen-400.woff2")}') format('woff2');
          }
          @font-face {
            font-family: 'JetBrains Mono';
            font-style: normal;
            font-weight: 700;
            src: url('${staticFile("fonts/jetbrains-mono-700.woff2")}') format('woff2');
          }
        `}
      </style>

      {/* =================================================================== */}
      {/* VIDMAKE DARK STUDIO STAGE (#121212 + #0078D4 Blue + #FF5A1F Orange) */}
      {/* =================================================================== */}
      {(() => {
        const orangeShiftX = interpolate(
          frame,
          [0, 100, 220, 336, 548, 738, 926, 1080],
          [24, 60, 32, 58, 28, 62, 36, 52],
          CLAMP
        );
        return (
          <AbsoluteFill
            style={{ backgroundColor: "#121212", pointerEvents: "none" }}
          >
            {/* Subtle Studio Grid Texture */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
                opacity: 0.45,
              }}
            />
            {/* Vidmake Primary Blue (#0078D4) Horizon Glow */}
            <div
              style={{
                position: "absolute",
                left: "-15%",
                right: "-15%",
                bottom: "-28%",
                height: "76%",
                background:
                  "radial-gradient(ellipse 85% 65% at 50% 100%, rgba(0, 120, 212, 0.78) 0%, rgba(0, 88, 168, 0.48) 40%, rgba(18, 18, 18, 0) 76%)",
                filter: "blur(38px)",
              }}
            />
            {/* Vidmake Warm Orange (#FF5A1F / #FF7A18) Secondary Studio Bloom */}
            <div
              style={{
                position: "absolute",
                left: `${orangeShiftX - 25}%`,
                bottom: "-18%",
                width: "54%",
                height: "60%",
                background:
                  "radial-gradient(ellipse at 50% 85%, rgba(255, 90, 31, 0.62) 0%, rgba(214, 41, 118, 0.28) 48%, rgba(18, 18, 18, 0) 78%)",
                filter: "blur(48px)",
                opacity: 0.78,
              }}
            />
          </AbsoluteFill>
        );
      })()}

      {/* =================================================================== */}
      {/* OPENING TITLE BEATS (Frames 0–100 / 0.0s–3.33s):                    */}
      {/*   Beat 1 (0–44):   "Introducing Vidmake" + 3D 4-Point Blue/Orange   */}
      {/*   Beat 2 (44–100): "Higgsfield for / SaaS & Sales Marketing"        */}
      {/* =================================================================== */}
      {frame < 100 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {(() => {
            const beat1Chars = Array.from("Introducing Vidmake");
            const beat1ExitOpacity = interpolate(frame, [35, 43], [1, 0], CLAMP);
            const beat1ExitBlur = interpolate(frame, [35, 43], [0, 12], CLAMP);
            const beat1ExitScale = interpolate(frame, [35, 43], [1, 0.94], CLAMP);

            const starEnterSpr = spring({
              frame: Math.max(0, frame - 1),
              fps,
              config: { damping: 12, mass: 0.42, stiffness: 250 },
            });
            const starScale =
              interpolate(starEnterSpr, [0, 1], [1.45, 1]) *
              interpolate(frame, [28, 39], [1, 0], CLAMP);
            const starY = interpolate(starEnterSpr, [0, 1], [58, 0]);
            const starRot = interpolate(frame, [0, 39], [-18, 28], CLAMP);
            const starOpacity =
              interpolate(frame, [0, 5], [0, 1], CLAMP) *
              interpolate(frame, [28, 39], [1, 0], CLAMP);

            const b2Rel = frame - 44;
            const beat2ExitOpacity = interpolate(frame, [89, 99], [1, 0], CLAMP);
            const beat2ExitBlur = interpolate(frame, [89, 99], [0, 12], CLAMP);
            const beat2ExitScale = interpolate(frame, [89, 99], [1, 0.94], CLAMP);

            const beat2Line1Words = [
              { text: "Higgsfield", color: "#F5F3F0", delay: 0 },
              { text: "for", color: VIDMAKE_BLUE_BRIGHT, delay: 5 },
            ];
            const beat2Line2Words = [
              { text: "SaaS", color: "#F5F3F0", delay: 9 },
              { text: "&", color: "rgba(245,243,240,0.72)", delay: 13 },
              { text: "Sales", color: "#F5F3F0", delay: 17 },
              { text: "Marketing", color: VIDMAKE_ORANGE, delay: 21 },
            ];

            const dropletProg = interpolate(b2Rel, [3, 24], [0, 1], CLAMP);
            const dropletX = interpolate(dropletProg, [0, 1], [-140, 165]);
            const dropletY =
              interpolate(dropletProg, [0, 0.5, 1], [-55, -110, -18]) +
              Math.sin(dropletProg * Math.PI) * -28;
            const dropletOpacity = interpolate(
              b2Rel,
              [3, 8, 20, 26],
              [0, 1, 0.9, 0],
              CLAMP
            );

            return (
              <div
                style={{
                  position: "relative",
                  width: 1680,
                  height: 920,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {frame < 44 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `scale(${beat1ExitScale})`,
                      opacity: beat1ExitOpacity,
                      filter:
                        beat1ExitBlur > 0.2 ? `blur(${beat1ExitBlur}px)` : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "pre",
                      }}
                    >
                      {beat1Chars.map((ch, idx) => {
                        const cStart = 1 + idx * 0.85;
                        const cRel = frame - cStart;
                        const cOpacity = interpolate(
                          cRel,
                          [0, 3, 7],
                          [0, 0.42, 1],
                          CLAMP
                        );
                        const cBlur = interpolate(
                          cRel,
                          [0, 3, 7],
                          [10, 3, 0],
                          CLAMP
                        );
                        const cY = interpolate(cRel, [0, 7], [10, 0], CLAMP);

                        return (
                          <span
                            key={idx}
                            style={{
                              display: "inline-block",
                              fontFamily: CLEAN_SANS,
                              fontWeight: 700,
                              fontSize: 92,
                              lineHeight: 1.08,
                              letterSpacing: "-0.035em",
                              color: "#F5F3F0",
                              opacity: cOpacity,
                              transform: `translate3d(0, ${cY}px, 0)`,
                              filter: cBlur > 0.2 ? `blur(${cBlur}px)` : "none",
                            }}
                          >
                            {ch}
                          </span>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        marginTop: 22,
                        transform: `translate3d(0, ${starY}px, 0) scale(${starScale}) rotate(${starRot}deg)`,
                        opacity: starOpacity,
                        filter:
                          "drop-shadow(0 0 24px rgba(0, 120, 212, 0.92)) drop-shadow(0 0 48px rgba(255, 122, 24, 0.55))",
                      }}
                    >
                      <svg width="96" height="96" viewBox="0 0 100 100">
                        <defs>
                          <radialGradient
                            id="vidmakeStarGrad"
                            cx="50%"
                            cy="50%"
                            r="50%"
                          >
                            <stop offset="0%" stopColor="#FFFFFF" />
                            <stop offset="40%" stopColor="#38BDF8" />
                            <stop offset="75%" stopColor="#0078D4" />
                            <stop offset="100%" stopColor="#FF7A18" />
                          </radialGradient>
                        </defs>
                        <path
                          d="M50 4 C54 34, 66 46, 96 50 C66 54, 54 66, 50 96 C46 66, 34 54, 4 50 C34 46, 46 34, 50 4 Z"
                          fill="url(#vidmakeStarGrad)"
                        />
                        <path
                          d="M50 14 C52.5 36, 64 47.5, 86 50 C64 52.5, 52.5 64, 50 86 C47.5 64, 36 52.5, 14 50 C36 47.5, 47.5 36, 50 14 Z"
                          fill="#FFFFFF"
                          opacity="0.75"
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {frame >= 44 && (
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      transform: `scale(${beat2ExitScale})`,
                      opacity: beat2ExitOpacity,
                      filter:
                        beat2ExitBlur > 0.2 ? `blur(${beat2ExitBlur}px)` : "none",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: 28,
                        height: 54,
                        borderRadius: 999,
                        background:
                          "linear-gradient(180deg, rgba(56, 189, 248, 0.95) 0%, rgba(255, 122, 24, 0.3) 100%)",
                        boxShadow: "0 0 32px rgba(0, 120, 212, 0.9)",
                        transform: `translate3d(${dropletX}px, ${dropletY}px, 0) rotate(28deg)`,
                        opacity: dropletOpacity,
                        filter: "blur(3px)",
                        pointerEvents: "none",
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 22,
                      }}
                    >
                      {beat2Line1Words.map((w, idx) => {
                        const wRel = b2Rel - w.delay;
                        const wOp = interpolate(
                          wRel,
                          [0, 3, 8],
                          [0, 0.36, 1],
                          CLAMP
                        );
                        const wBlur = interpolate(
                          wRel,
                          [0, 4, 8],
                          [10, 3, 0],
                          CLAMP
                        );
                        const wY = interpolate(wRel, [0, 8], [14, 0], CLAMP);
                        return (
                          <span
                            key={idx}
                            style={{
                              fontFamily: CLEAN_SANS,
                              fontWeight: 700,
                              fontSize: 82,
                              lineHeight: 1.08,
                              letterSpacing: "-0.035em",
                              color: w.color,
                              opacity: wOp,
                              transform: `translate3d(0, ${wY}px, 0)`,
                              filter: wBlur > 0.2 ? `blur(${wBlur}px)` : "none",
                            }}
                          >
                            {w.text}
                          </span>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 22,
                      }}
                    >
                      {beat2Line2Words.map((w, idx) => {
                        const wRel = b2Rel - w.delay;
                        const wOp = interpolate(
                          wRel,
                          [0, 3, 8],
                          [0, 0.36, 1],
                          CLAMP
                        );
                        const wBlur = interpolate(
                          wRel,
                          [0, 4, 8],
                          [10, 3, 0],
                          CLAMP
                        );
                        const wY = interpolate(wRel, [0, 8], [14, 0], CLAMP);
                        return (
                          <span
                            key={idx}
                            style={{
                              fontFamily: CLEAN_SANS,
                              fontWeight: 700,
                              fontSize: 82,
                              lineHeight: 1.08,
                              letterSpacing: "-0.035em",
                              color: w.color,
                              opacity: wOp,
                              transform: `translate3d(0, ${wY}px, 0)`,
                              filter: wBlur > 0.2 ? `blur(${wBlur}px)` : "none",
                            }}
                          >
                            {w.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* STEP 1: AI CHARACTER WORKFLOW (Frames 100–336 / 3.33s–11.20s)       */}
      {/*   1A (100–168): Camera Zoom on Input Bar typing                     */}
      {/*                 "Create an AI character" -> Docks top-right         */}
      {/*                 + Left "OK" + "[3-square spinner] selecting traits" */}
      {/*   1B (168–252): Interactive AI Character Trait Selection Pull-Up    */}
      {/*                 (Using our authentic aichar workflow images!)       */}
      {/*                 -> Selects Latina · Natural Bob -> Holds to read    */}
      {/*   1C (252–336): "[3-square spinner] generating AI character" ->     */}
      {/*                 Reveals single generated AI Influencer card         */}
      {/*                 (aichar-part2-female-final.jpg) in the center!      */}
      {/* =================================================================== */}
      {frame >= 100 && frame < 336 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: getTypingCameraTransform(106, 150),
          }}
        >
          {(() => {
            const PROMPT_1 = "Create an AI character";
            const typedCount = Math.floor(
              interpolate(frame, [106, 140], [0, PROMPT_1.length], CLAMP)
            );
            const typedStr = PROMPT_1.slice(0, typedCount);

            const barEnterSpr = spring({
              frame: Math.max(0, frame - 100),
              fps,
              config: { damping: 13, mass: 0.42, stiffness: 260 },
            });
            const barOpacity = interpolate(frame, [100, 108], [0, 1], CLAMP);

            const isClicked = frame >= 150;
            const clickAge = Math.max(0, frame - 150);
            const postSendSpr = isClicked
              ? spring({
                  frame: frame - 150,
                  fps,
                  config: { damping: 14, mass: 0.44, stiffness: 260 },
                })
              : 0;

            const sendBtnScale = isClicked
              ? interpolate(clickAge, [0, 3, 8, 14], [1, 0.82, 1.14, 1], CLAMP)
              : interpolate(frame, [140, 149], [1, 1.07], CLAMP);

            const barX = interpolate(postSendSpr, [0, 1], [0, 410]);
            const barY =
              interpolate(barEnterSpr, [0, 1], [32, 0]) +
              interpolate(postSendSpr, [0, 1], [0, -365]);
            const barWidth = interpolate(postSendSpr, [0, 1], [940, 620]);
            const barHeight = interpolate(postSendSpr, [0, 1], [92, 74]);

            // Pull-Up AI Character Trait Selector (168–252)
            const pullUpActive = interpolate(
              frame,
              [168, 176, 240, 252],
              [0, 1, 1, 0],
              CLAMP
            );
            const chatScale = interpolate(pullUpActive, [0, 1], [1, 0.9]);
            const chatY = interpolate(pullUpActive, [0, 1], [0, -75]);
            const chatOpacity = interpolate(pullUpActive, [0, 1], [1, 0.24]);
            const chatBlur = interpolate(pullUpActive, [0, 1], [0, 6]);

            const pullEnterSpr = spring({
              frame: Math.max(0, frame - 169),
              fps,
              config: { damping: 13, mass: 0.46, stiffness: 240 },
            });
            const pullCloseProg = interpolate(
              frame,
              [240, 251],
              [0, 1],
              CLAMP
            );
            const pullY =
              interpolate(pullEnterSpr, [0, 1], [210, 20]) +
              interpolate(pullCloseProg, [0, 1], [0, 110]);
            const pullScale =
              interpolate(pullEnterSpr, [0, 1], [0.84, 1]) *
              interpolate(pullCloseProg, [0, 1], [1, 0.76]);
            const pullOpacity =
              interpolate(frame, [169, 176], [0, 1], CLAMP) *
              interpolate(frame, [240, 251], [1, 0], CLAMP);
            const pullBlur = interpolate(frame, [240, 251], [0, 14], CLAMP);

            const isTraitSelected = frame >= 212;
            const selectSpr = isTraitSelected
              ? spring({
                  frame: frame - 212,
                  fps,
                  config: { damping: 12, mass: 0.42, stiffness: 290 },
                })
              : 0;

            const traitCards = [
              {
                src: aiCharTraitMiddleEasternSrc,
                label: "Middle Eastern",
                sub: "Studio Wall · Bold",
                xOffset: -330,
                rot: -3.5,
              },
              {
                src: aiCharTraitLatinaSrc,
                label: "Latina · Natural Bob",
                sub: "Cream Room · Female 24",
                xOffset: 0,
                rot: 0,
              },
              {
                src: aiCharTraitEastAsianSrc,
                label: "East Asian",
                sub: "Workspace · Average",
                xOffset: 330,
                rot: 3.5,
              },
            ];

            const agentReplySpr =
              frame >= 156
                ? spring({
                    frame: frame - 156,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 280 },
                  })
                : 0;
            const genCharRowSpr =
              frame >= 254
                ? spring({
                    frame: frame - 254,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;
            const charCardSpr =
              frame >= 256
                ? spring({
                    frame: frame - 256,
                    fps,
                    config: { damping: 13, mass: 0.46, stiffness: 250 },
                  })
                : 0;

            const isCharReady = frame >= 294;
            const shimmerProgress = interpolate(
              frame,
              [260, 298],
              [-120, 220],
              CLAMP
            );

            return (
              <div
                style={{
                  position: "relative",
                  width: 1680,
                  height: 920,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* MAIN CHAT STAGE */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: `translate3d(0, ${chatY}px, 0) scale(${chatScale})`,
                    opacity: chatOpacity,
                    filter: chatBlur > 0.2 ? `blur(${chatBlur}px)` : "none",
                  }}
                >
                  {/* Prompt Input Bar -> Docks top-right */}
                  <div
                    style={{
                      position: "absolute",
                      width: barWidth,
                      height: barHeight,
                      left: "50%",
                      top: "50%",
                      marginLeft: -barWidth / 2,
                      marginTop: -barHeight / 2,
                      transform: `translate3d(${barX}px, ${barY}px, 0)`,
                      opacity: barOpacity,
                      borderRadius: 999,
                      backgroundColor: isClicked
                        ? "rgba(0, 120, 212, 0.22)"
                        : "rgba(36, 36, 36, 0.94)",
                      border: isClicked
                        ? "2px solid rgba(56, 189, 248, 0.88)"
                        : "1.5px solid rgba(255, 255, 255, 0.22)",
                      boxShadow: isClicked
                        ? "0 24px 60px rgba(0, 0, 0, 0.85), 0 0 42px rgba(0, 120, 212, 0.42)"
                        : "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(0, 120, 212, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: isClicked ? "0 28px" : "0 18px 0 36px",
                      zIndex: 60,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        fontFamily: CLEAN_SANS,
                        fontWeight: 600,
                        fontSize: isClicked ? 26 : 31,
                        letterSpacing: "-0.015em",
                        color: "#F5F3F0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{typedStr || "Ask Vidmake..."}</span>
                      {!isClicked && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 3,
                            height: 34,
                            marginLeft: 6,
                            borderRadius: 2,
                            backgroundColor: VIDMAKE_BLUE_BRIGHT,
                            opacity: Math.floor(frame / 4) % 2 === 0 ? 1 : 0.2,
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        width: isClicked ? 44 : 64,
                        height: isClicked ? 44 : 64,
                        borderRadius: 999,
                        background: isClicked
                          ? "linear-gradient(135deg, #0078D4 0%, #38BDF8 100%)"
                          : "linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 100%)",
                        boxShadow: isClicked
                          ? "0 0 28px rgba(0, 120, 212, 0.85)"
                          : "0 8px 24px rgba(255, 255, 255, 0.28)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: `scale(${sendBtnScale})`,
                        flexShrink: 0,
                      }}
                    >
                      {isClicked ? (
                        <span
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 900,
                            fontSize: 18,
                            color: "#FFFFFF",
                          }}
                        >
                          ✓
                        </span>
                      ) : (
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M5 12H19M19 12L13 6M19 12L13 18"
                            stroke="#121212"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Cursor clicking Send */}
                  {frame >= 134 && frame < 158 && (
                    <CursorActor
                      x={interpolate(frame, [134, 147], [600, 428], CLAMP)}
                      y={interpolate(frame, [134, 147], [260, 12], CLAMP)}
                      clickFrame={150}
                      showRipple={false}
                    />
                  )}

                  {/* Left Agent Status Stack */}
                  {frame >= 156 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 110,
                        top: frame >= 254 ? 330 : 390,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 20,
                        transform: `translate3d(0, ${interpolate(agentReplySpr, [0, 1], [30, 0])}px, 0)`,
                        opacity: interpolate(frame, [156, 162], [0, 1], CLAMP),
                      }}
                    >
                      <div
                        style={{
                          padding: "8px 22px",
                          borderRadius: 999,
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          border: "1.5px solid rgba(255, 255, 255, 0.24)",
                          fontFamily: CLEAN_SANS,
                          fontWeight: 700,
                          fontSize: 24,
                          color: "#F5F3F0",
                        }}
                      >
                        OK
                      </div>

                      {/* Line 1: selecting traits */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          opacity: frame >= 254 ? 0.68 : 1,
                        }}
                      >
                        {frame >= 252
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 28,
                            color: frame >= 254 ? "#CBD5E1" : "#F5F3F0",
                            letterSpacing: "0.01em",
                          }}
                        >
                          selecting traits
                        </div>
                      </div>

                      {/* Line 2 (254+): generating AI character */}
                      {frame >= 254 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            transform: `translate3d(0, ${interpolate(genCharRowSpr, [0, 1], [22, 0])}px, 0)`,
                            opacity: interpolate(
                              frame,
                              [254, 260],
                              [0, 1],
                              CLAMP
                            ),
                          }}
                        >
                          {isCharReady
                            ? renderCompletedBadge()
                            : renderThreeSquareSpinner()}
                          <div
                            style={{
                              fontFamily: MONO_FONT,
                              fontWeight: 700,
                              fontSize: 28,
                              color: isCharReady
                                ? VIDMAKE_EMERALD_TEXT
                                : "#F5F3F0",
                              letterSpacing: "0.01em",
                            }}
                          >
                            {isCharReady
                              ? "AI character ready"
                              : "generating AI character"}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SINGLE GENERATED AI CHARACTER CARD IN CENTER (Frames 256–336) */}
                  {frame >= 256 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 780,
                        top: 236,
                        width: 344,
                        height: 612,
                        transform: `translate3d(0, ${interpolate(charCardSpr, [0, 1], [44, 0])}px, 0) scale(${interpolate(charCardSpr, [0, 1], [0.88, 1])})`,
                        opacity: interpolate(frame, [256, 264], [0, 1], CLAMP),
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                          borderRadius: 28,
                          overflow: "hidden",
                          backgroundColor: "#1C1E24",
                          border: isCharReady
                            ? "2.5px solid #38BDF8"
                            : "2px solid rgba(255, 255, 255, 0.26)",
                          boxShadow: isCharReady
                            ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 54px rgba(0, 120, 212, 0.5)"
                            : "0 36px 90px rgba(0, 0, 0, 0.92), 0 0 36px rgba(0, 120, 212, 0.25)",
                        }}
                      >
                        <Img
                          src={aiCharFemaleFinalSrc}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            filter:
                              frame < 284
                                ? `blur(${interpolate(frame, [256, 284], [14, 0], CLAMP)}px)`
                                : "none",
                            transform: `scale(${interpolate(frame, [256, 332], [1.06, 1], CLAMP)})`,
                          }}
                        />

                        {/* Studio Light Shimmer Sweep during synthesis */}
                        {frame < 302 && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background: `linear-gradient(115deg, transparent ${shimmerProgress - 35}%, rgba(56, 189, 248, 0.38) ${shimmerProgress}%, transparent ${shimmerProgress + 35}%)`,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* INTERACTIVE AI CHARACTER TRAIT PULL-UP SCREEN (Frames 168–252) */}
                {frame >= 168 && frame < 252 && (
                  <div
                    style={{
                      position: "relative",
                      width: 1540,
                      height: 740,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `translate3d(0, ${pullY}px, 0) scale(${pullScale})`,
                      opacity: pullOpacity,
                      filter: pullBlur > 0.2 ? `blur(${pullBlur}px)` : "none",
                      zIndex: 50,
                    }}
                  >
                    {/* Pull-Up Header */}
                    <div
                      style={{
                        marginBottom: 28,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "10px 26px",
                        borderRadius: 999,
                        backgroundColor: "rgba(36, 36, 36, 0.92)",
                        border: "1.5px solid rgba(255, 255, 255, 0.2)",
                        boxShadow: "0 18px 44px rgba(0, 0, 0, 0.75)",
                      }}
                    >
                      {isTraitSelected
                        ? renderCompletedBadge()
                        : renderThreeSquareSpinner()}
                      <span
                        style={{
                          fontFamily: CLEAN_SANS,
                          fontWeight: 700,
                          fontSize: 28,
                          letterSpacing: "-0.02em",
                          color: "#F5F3F0",
                        }}
                      >
                        {isTraitSelected
                          ? "Selected AI Character traits"
                          : "Choose AI Character traits"}
                      </span>
                    </div>

                    {/* 3 Curated Character Studio Trait Cards from our AI Character Workflow */}
                    <div
                      style={{
                        position: "relative",
                        width: 1200,
                        height: 460,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {traitCards.map((card, idx) => {
                        const isCenter = idx === 1;
                        const cEnterSpr = spring({
                          frame: Math.max(0, frame - 170 - idx * 2),
                          fps,
                          config: { damping: 13, mass: 0.44, stiffness: 250 },
                        });
                        const cardScale =
                          interpolate(cEnterSpr, [0, 1], [0.78, 1]) *
                          (isCenter
                            ? interpolate(selectSpr, [0, 1], [1.04, 1.14])
                            : interpolate(selectSpr, [0, 1], [0.94, 0.86]));
                        const cardX = interpolate(
                          cEnterSpr,
                          [0, 1],
                          [card.xOffset * 0.5, card.xOffset]
                        );
                        const cardY = isCenter
                          ? interpolate(selectSpr, [0, 1], [-6, -14])
                          : 12;
                        const cardRot = isCenter
                          ? 0
                          : interpolate(
                              selectSpr,
                              [0, 1],
                              [card.rot, card.rot * 0.6]
                            );
                        const cardOpacity = isCenter
                          ? 1
                          : interpolate(selectSpr, [0, 1], [0.88, 0.38]);

                        return (
                          <div
                            key={idx}
                            style={{
                              position: "absolute",
                              width: 280,
                              height: 400,
                              borderRadius: 24,
                              overflow: "hidden",
                              backgroundColor: "#242424",
                              border:
                                isCenter && isTraitSelected
                                  ? "3px solid #38BDF8"
                                  : "1.5px solid rgba(255, 255, 255, 0.22)",
                              boxShadow:
                                isCenter && isTraitSelected
                                  ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 60px rgba(0, 120, 212, 0.65)"
                                  : "0 24px 54px rgba(0, 0, 0, 0.85)",
                              transform: `translate3d(${cardX}px, ${cardY}px, 0) scale(${cardScale}) rotate(${cardRot}deg)`,
                              opacity: cardOpacity,
                              zIndex: isCenter ? 30 : 10,
                            }}
                          >
                            <Img
                              src={card.src}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                objectPosition: "50% 25%",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background:
                                  "linear-gradient(180deg, transparent 52%, rgba(0,0,0,0.88) 100%)",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                bottom: 16,
                                left: 16,
                                right: 16,
                                display: "flex",
                                flexDirection: "column",
                                gap: 3,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: CLEAN_SANS,
                                  fontWeight: 700,
                                  fontSize: 17,
                                  color: "#FFFFFF",
                                }}
                              >
                                {card.label}
                              </span>
                              <span
                                style={{
                                  fontFamily: CLEAN_SANS,
                                  fontWeight: 500,
                                  fontSize: 13,
                                  color: "rgba(255, 255, 255, 0.72)",
                                }}
                              >
                                {card.sub}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Cursor clicking the center AI Character trait card */}
                      {frame >= 188 && frame < 236 && (
                        <CursorActor
                          x={interpolate(frame, [188, 210], [300, -10], CLAMP)}
                          y={interpolate(frame, [188, 210], [240, 35], CLAMP)}
                          clickFrame={212}
                          showRipple={false}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* STEP 2A: VIRAL HOOK + TEXT (Frames 336–548 / 11.20s–18.27s)         */}
      {/*   - Input Bar types "Create a marketing video for my SaaS"          */}
      {/*   - Pull-Up Viral Hooks Screen (D:hookswithlinks) -> Selects 3.4M */}
      {/*   - "recreating for you" -> Recreated Hook Video (0:04)             */}
      {/*   - "attaching the text" -> Caption locks onto video                */}
      {/* =================================================================== */}
      {frame >= 336 && frame < 548 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: getTypingCameraTransform(342, 376),
          }}
        >
          {(() => {
            const PROMPT_HOOK = "Create a marketing video for my SaaS";
            const typedCount = Math.floor(
              interpolate(frame, [342, 368], [0, PROMPT_HOOK.length], CLAMP)
            );
            const typedStr = PROMPT_HOOK.slice(0, typedCount);

            const barEnterSpr = spring({
              frame: Math.max(0, frame - 336),
              fps,
              config: { damping: 13, mass: 0.42, stiffness: 260 },
            });
            const barOpacity = interpolate(frame, [336, 344], [0, 1], CLAMP);

            const isClicked = frame >= 376;
            const clickAge = Math.max(0, frame - 376);
            const postSendSpr = isClicked
              ? spring({
                  frame: frame - 376,
                  fps,
                  config: { damping: 14, mass: 0.44, stiffness: 260 },
                })
              : 0;

            const sendBtnScale = isClicked
              ? interpolate(clickAge, [0, 3, 8, 14], [1, 0.82, 1.14, 1], CLAMP)
              : interpolate(frame, [366, 375], [1, 1.07], CLAMP);

            const barX = interpolate(postSendSpr, [0, 1], [0, 410]);
            const barY =
              interpolate(barEnterSpr, [0, 1], [32, 0]) +
              interpolate(postSendSpr, [0, 1], [0, -365]);
            const barWidth = interpolate(postSendSpr, [0, 1], [1020, 680]);
            const barHeight = interpolate(postSendSpr, [0, 1], [92, 74]);

            // Pull-Up Viral Hooks Screen (386–456)
            const pullUpActive = interpolate(
              frame,
              [386, 394, 446, 456],
              [0, 1, 1, 0],
              CLAMP
            );
            const chatScale = interpolate(pullUpActive, [0, 1], [1, 0.9]);
            const chatY = interpolate(pullUpActive, [0, 1], [0, -75]);
            const chatOpacity = interpolate(pullUpActive, [0, 1], [1, 0.24]);
            const chatBlur = interpolate(pullUpActive, [0, 1], [0, 6]);

            const pullEnterSpr = spring({
              frame: Math.max(0, frame - 387),
              fps,
              config: { damping: 13, mass: 0.46, stiffness: 240 },
            });
            const pullCloseProg = interpolate(
              frame,
              [446, 455],
              [0, 1],
              CLAMP
            );
            const pullY =
              interpolate(pullEnterSpr, [0, 1], [210, 20]) +
              interpolate(pullCloseProg, [0, 1], [0, 110]);
            const pullScale =
              interpolate(pullEnterSpr, [0, 1], [0.84, 1]) *
              interpolate(pullCloseProg, [0, 1], [1, 0.76]);
            const pullOpacity =
              interpolate(frame, [387, 394], [0, 1], CLAMP) *
              interpolate(frame, [446, 455], [1, 0], CLAMP);
            const pullBlur = interpolate(frame, [446, 455], [0, 14], CLAMP);

            const hookPullCards = [
              {
                src: staticFile(
                  "explore/covers/sources/vidmake/hookswithlinks-3.mp4"
                ),
                views: "2.4M",
                tag: "Startup Idea Hook",
                xOffset: -540,
                rot: -5,
              },
              {
                src: staticFile(
                  "explore/covers/sources/vidmake/hookswithlinks-5.mp4"
                ),
                views: "1.9M",
                tag: "Client Acquisition",
                xOffset: -275,
                rot: -2.5,
              },
              {
                src: staticFile(
                  "explore/covers/sources/vidmake/hookswithlinks-4.mp4"
                ),
                views: "3.4M",
                tag: "SaaS Viral Hook",
                xOffset: 0,
                rot: 0,
              },
              {
                src: staticFile(
                  "explore/covers/sources/vidmake/hookswithlinks-6.mp4"
                ),
                views: "4.8M",
                tag: "AI Tool Reveal",
                xOffset: 275,
                rot: 2.5,
              },
              {
                src: staticFile(
                  "explore/covers/sources/vidmake/hookswithlinks-7.mp4"
                ),
                views: "2.9M",
                tag: "Claude Max Reaction",
                xOffset: 540,
                rot: 5,
              },
            ];

            const isHookSelected = frame >= 424;
            const selectSpr = isHookSelected
              ? spring({
                  frame: frame - 424,
                  fps,
                  config: { damping: 12, mass: 0.42, stiffness: 290 },
                })
              : 0;

            const recreateRowSpr =
              frame >= 458
                ? spring({
                    frame: frame - 458,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;
            const videoCardSpr =
              frame >= 460
                ? spring({
                    frame: frame - 460,
                    fps,
                    config: { damping: 13, mass: 0.46, stiffness: 250 },
                  })
                : 0;

            const attachTextRowSpr =
              frame >= 500
                ? spring({
                    frame: frame - 500,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;
            const textFlySpr =
              frame >= 502
                ? spring({
                    frame: frame - 502,
                    fps,
                    config: { damping: 12, mass: 0.42, stiffness: 260 },
                  })
                : 0;
            const isTextLocked = frame >= 522;

            return (
              <div
                style={{
                  position: "relative",
                  width: 1680,
                  height: 920,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: `translate3d(0, ${chatY}px, 0) scale(${chatScale})`,
                    opacity: chatOpacity,
                    filter: chatBlur > 0.2 ? `blur(${chatBlur}px)` : "none",
                  }}
                >
                  {/* Prompt Input Bar */}
                  <div
                    style={{
                      position: "absolute",
                      width: barWidth,
                      height: barHeight,
                      left: "50%",
                      top: "50%",
                      marginLeft: -barWidth / 2,
                      marginTop: -barHeight / 2,
                      transform: `translate3d(${barX}px, ${barY}px, 0)`,
                      opacity: barOpacity,
                      borderRadius: 999,
                      backgroundColor: isClicked
                        ? "rgba(0, 120, 212, 0.22)"
                        : "rgba(36, 36, 36, 0.94)",
                      border: isClicked
                        ? "2px solid rgba(56, 189, 248, 0.88)"
                        : "1.5px solid rgba(255, 255, 255, 0.22)",
                      boxShadow: isClicked
                        ? "0 24px 60px rgba(0, 0, 0, 0.85), 0 0 42px rgba(0, 120, 212, 0.42)"
                        : "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(0, 120, 212, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: isClicked ? "0 28px" : "0 18px 0 36px",
                      zIndex: 60,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        fontFamily: CLEAN_SANS,
                        fontWeight: 600,
                        fontSize: isClicked ? 26 : 31,
                        letterSpacing: "-0.015em",
                        color: "#F5F3F0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{typedStr}</span>
                      {!isClicked && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 3,
                            height: 34,
                            marginLeft: 6,
                            borderRadius: 2,
                            backgroundColor: VIDMAKE_BLUE_BRIGHT,
                            opacity: Math.floor(frame / 4) % 2 === 0 ? 1 : 0.2,
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        width: isClicked ? 44 : 64,
                        height: isClicked ? 44 : 64,
                        borderRadius: 999,
                        background: isClicked
                          ? "linear-gradient(135deg, #0078D4 0%, #38BDF8 100%)"
                          : "linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 100%)",
                        boxShadow: isClicked
                          ? "0 0 28px rgba(0, 120, 212, 0.85)"
                          : "0 8px 24px rgba(255, 255, 255, 0.28)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: `scale(${sendBtnScale})`,
                        flexShrink: 0,
                      }}
                    >
                      {isClicked ? (
                        <span
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 900,
                            fontSize: 18,
                            color: "#FFFFFF",
                          }}
                        >
                          ✓
                        </span>
                      ) : (
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M5 12H19M19 12L13 6M19 12L13 18"
                            stroke="#121212"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Cursor clicking Send */}
                  {frame >= 362 && frame < 384 && (
                    <CursorActor
                      x={interpolate(frame, [362, 374], [620, 468], CLAMP)}
                      y={interpolate(frame, [362, 374], [260, 12], CLAMP)}
                      clickFrame={376}
                      showRipple={false}
                    />
                  )}

                  {/* Left Agent Status Stack */}
                  {frame >= 380 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 110,
                        top: frame >= 458 ? 310 : 390,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 20,
                      }}
                    >
                      <div
                        style={{
                          padding: "8px 22px",
                          borderRadius: 999,
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          border: "1.5px solid rgba(255, 255, 255, 0.24)",
                          fontFamily: CLEAN_SANS,
                          fontWeight: 700,
                          fontSize: 24,
                          color: "#F5F3F0",
                        }}
                      >
                        OK
                      </div>

                      {/* Line 1: finding viral content */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          opacity: frame >= 458 ? 0.65 : 1,
                        }}
                      >
                        {frame >= 456
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 28,
                            color: frame >= 458 ? "#CBD5E1" : "#F5F3F0",
                            letterSpacing: "0.01em",
                          }}
                        >
                          finding viral content
                        </div>
                      </div>

                      {/* Line 2 (458+): recreating for you */}
                      {frame >= 458 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            transform: `translate3d(0, ${interpolate(recreateRowSpr, [0, 1], [22, 0])}px, 0)`,
                            opacity:
                              interpolate(frame, [458, 464], [0, 1], CLAMP) *
                              (frame >= 500 ? 0.68 : 1),
                          }}
                        >
                          {frame >= 500
                            ? renderCompletedBadge()
                            : renderThreeSquareSpinner()}
                          <div
                            style={{
                              fontFamily: MONO_FONT,
                              fontWeight: 700,
                              fontSize: 28,
                              color: frame >= 500 ? "#CBD5E1" : "#F5F3F0",
                              letterSpacing: "0.01em",
                            }}
                          >
                            recreating for you
                          </div>
                        </div>
                      )}

                      {/* Line 3 (500+): attaching the text */}
                      {frame >= 500 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            transform: `translate3d(0, ${interpolate(attachTextRowSpr, [0, 1], [22, 0])}px, 0)`,
                            opacity: interpolate(
                              frame,
                              [500, 506],
                              [0, 1],
                              CLAMP
                            ),
                          }}
                        >
                          {frame >= 526
                            ? renderCompletedBadge()
                            : renderThreeSquareSpinner()}
                          <div
                            style={{
                              fontFamily: MONO_FONT,
                              fontWeight: 700,
                              fontSize: 28,
                              color: "#F5F3F0",
                              letterSpacing: "0.01em",
                            }}
                          >
                            attaching the text
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RECREATED HOOK VIDEO IN CHAT (Frames 460–548) */}
                  {frame >= 460 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 780,
                        top: 236,
                        display: "flex",
                        alignItems: "center",
                        gap: 32,
                        transform: `translate3d(0, ${interpolate(videoCardSpr, [0, 1], [48, 0])}px, 0) scale(${interpolate(videoCardSpr, [0, 1], [0.86, 1])})`,
                        opacity: interpolate(frame, [460, 468], [0, 1], CLAMP),
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: 344,
                          height: 612,
                          borderRadius: 28,
                          overflow: "hidden",
                          backgroundColor: "#1C1E24",
                          border: isTextLocked
                            ? "2.5px solid #38BDF8"
                            : "2px solid rgba(255, 255, 255, 0.26)",
                          boxShadow: isTextLocked
                            ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 54px rgba(0, 120, 212, 0.45)"
                            : "0 36px 90px rgba(0, 0, 0, 0.92), 0 0 36px rgba(0, 120, 212, 0.25)",
                        }}
                      >
                        <Sequence from={458} durationInFrames={90}>
                          <Video
                            src={hookRecreatedVideoSrc}
                            muted
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </Sequence>

                        {frame >= 502 && (
                          <div
                            style={{
                              position: "absolute",
                              top: 116,
                              left: 0,
                              right: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4,
                              transform: `translate3d(0, ${interpolate(textFlySpr, [0, 1], [24, 0])}px, 0) scale(${interpolate(textFlySpr, [0, 0.75, 1], [1.12, 0.98, 1])})`,
                              opacity: interpolate(
                                frame,
                                [502, 508],
                                [0, 1],
                                CLAMP
                              ),
                              pointerEvents: "none",
                              zIndex: 30,
                            }}
                          >
                            <div
                              style={{
                                fontFamily: CLEAN_SANS,
                                fontWeight: 700,
                                fontSize: 18,
                                lineHeight: 1.24,
                                color: "#FFFFFF",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                textShadow:
                                  "-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.65)",
                              }}
                            >
                              Coding for 6 months ❌
                            </div>
                            <div
                              style={{
                                fontFamily: CLEAN_SANS,
                                fontWeight: 700,
                                fontSize: 18,
                                lineHeight: 1.24,
                                color: "#FFFFFF",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                textShadow:
                                  "-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.65)",
                              }}
                            >
                              This can make content for me ✅
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            position: "absolute",
                            right: 14,
                            bottom: 14,
                            padding: "5px 12px",
                            borderRadius: 999,
                            backgroundColor: "rgba(18, 18, 18, 0.84)",
                            border: "1px solid rgba(255, 255, 255, 0.24)",
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#FFFFFF",
                            letterSpacing: "0.02em",
                            zIndex: 35,
                          }}
                        >
                          0:04
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* INTERACTIVE VIRAL HOOKS PULL-UP SCREEN (Frames 386–456) */}
                {frame >= 386 && frame < 456 && (
                  <div
                    style={{
                      position: "relative",
                      width: 1580,
                      height: 760,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `translate3d(0, ${pullY}px, 0) scale(${pullScale})`,
                      opacity: pullOpacity,
                      filter: pullBlur > 0.2 ? `blur(${pullBlur}px)` : "none",
                      zIndex: 50,
                    }}
                  >
                    <div
                      style={{
                        marginBottom: 28,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "10px 26px",
                        borderRadius: 999,
                        backgroundColor: "rgba(36, 36, 36, 0.92)",
                        border: "1.5px solid rgba(255, 255, 255, 0.2)",
                        boxShadow: "0 18px 44px rgba(0, 0, 0, 0.75)",
                      }}
                    >
                      {isHookSelected
                        ? renderCompletedBadge()
                        : renderThreeSquareSpinner()}
                      <span
                        style={{
                          fontFamily: CLEAN_SANS,
                          fontWeight: 700,
                          fontSize: 28,
                          letterSpacing: "-0.02em",
                          color: "#F5F3F0",
                        }}
                      >
                        {isHookSelected
                          ? "Selected winning viral hook"
                          : "Scanning viral hooks for your SaaS"}
                      </span>
                    </div>

                    <div
                      style={{
                        position: "relative",
                        width: 1520,
                        height: 520,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {hookPullCards.map((card, idx) => {
                        const isCenter = idx === 2;
                        const cEnterSpr = spring({
                          frame: Math.max(0, frame - 388 - idx * 2),
                          fps,
                          config: { damping: 13, mass: 0.44, stiffness: 250 },
                        });
                        const cardScale =
                          interpolate(cEnterSpr, [0, 1], [0.75, 1]) *
                          (isCenter
                            ? interpolate(selectSpr, [0, 1], [1.04, 1.15])
                            : interpolate(selectSpr, [0, 1], [0.94, 0.86]));
                        const cardX = interpolate(
                          cEnterSpr,
                          [0, 1],
                          [card.xOffset * 0.5, card.xOffset]
                        );
                        const cardY = isCenter
                          ? interpolate(selectSpr, [0, 1], [-8, -16])
                          : Math.abs(idx - 2) * 12;
                        const cardRot = isCenter
                          ? 0
                          : interpolate(
                              selectSpr,
                              [0, 1],
                              [card.rot, card.rot * 0.6]
                            );
                        const cardOpacity = isCenter
                          ? 1
                          : interpolate(selectSpr, [0, 1], [0.88, 0.35]);

                        return (
                          <div
                            key={idx}
                            style={{
                              position: "absolute",
                              width: 248,
                              height: 440,
                              borderRadius: 24,
                              overflow: "hidden",
                              backgroundColor: "#242424",
                              border:
                                isCenter && isHookSelected
                                  ? "3px solid #38BDF8"
                                  : "1.5px solid rgba(255, 255, 255, 0.22)",
                              boxShadow:
                                isCenter && isHookSelected
                                  ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 60px rgba(0, 120, 212, 0.65)"
                                  : "0 24px 54px rgba(0, 0, 0, 0.85)",
                              transform: `translate3d(${cardX}px, ${cardY}px, 0) scale(${cardScale}) rotate(${cardRot}deg)`,
                              opacity: cardOpacity,
                              zIndex: isCenter ? 30 : 10 - Math.abs(idx - 2),
                            }}
                          >
                            <Sequence from={386} durationInFrames={70}>
                              <Video
                                src={card.src}
                                muted
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            </Sequence>
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background:
                                  "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 32%, transparent 62%, rgba(0,0,0,0.88) 100%)",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: 12,
                                left: 12,
                                padding: "5px 12px",
                                borderRadius: 999,
                                backgroundColor: "rgba(18, 18, 18, 0.78)",
                                border: "1px solid rgba(255, 255, 255, 0.22)",
                                fontFamily: CLEAN_SANS,
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#FFFFFF",
                              }}
                            >
                              🔥 {card.views}
                            </div>
                            <div
                              style={{
                                position: "absolute",
                                bottom: 14,
                                left: 14,
                                right: 14,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: CLEAN_SANS,
                                  fontWeight: 700,
                                  fontSize: 15,
                                  color: "#FFFFFF",
                                }}
                              >
                                {card.tag}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {frame >= 402 && frame < 446 && (
                        <CursorActor
                          x={interpolate(frame, [402, 422], [320, -10], CLAMP)}
                          y={interpolate(frame, [402, 422], [260, 40], CLAMP)}
                          clickFrame={424}
                          showRipple={false}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* STEP 2B: ATTACH DEMO & AUDIO (Frames 548–738 / 18.27s–24.60s)       */}
      {/*   - Input Bar types "Attach demo and attach audio"                  */}
      {/*   - "attaching demo" -> Single video card updates 0:04 -> 0:15      */}
      {/*   - "attaching audio" -> Drags audio_video.mp4 onto complete video  */}
      {/*   - "giving final video" -> Complete 0:15 video                     */}
      {/* =================================================================== */}
      {frame >= 548 && frame < 738 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: getTypingCameraTransform(554, 590),
          }}
        >
          {(() => {
            const PROMPT_2 = "Attach demo and attach audio";
            const typedCount = Math.floor(
              interpolate(frame, [554, 582], [0, PROMPT_2.length], CLAMP)
            );
            const typedStr = PROMPT_2.slice(0, typedCount);

            const barEnterSpr = spring({
              frame: Math.max(0, frame - 548),
              fps,
              config: { damping: 13, mass: 0.45, stiffness: 250 },
            });
            const barOpacity = interpolate(frame, [548, 556], [0, 1], CLAMP);

            const isClicked = frame >= 590;
            const clickAge = Math.max(0, frame - 590);
            const postSendSpr = isClicked
              ? spring({
                  frame: frame - 590,
                  fps,
                  config: { damping: 14, mass: 0.46, stiffness: 250 },
                })
              : 0;

            const sendBtnScale = isClicked
              ? interpolate(clickAge, [0, 3, 8, 14], [1, 0.82, 1.14, 1], CLAMP)
              : interpolate(frame, [580, 589], [1, 1.07], CLAMP);

            const barX = interpolate(postSendSpr, [0, 1], [0, 410]);
            const barY =
              interpolate(barEnterSpr, [0, 1], [34, 0]) +
              interpolate(postSendSpr, [0, 1], [0, -365]);
            const barWidth = interpolate(postSendSpr, [0, 1], [1020, 680]);
            const barHeight = interpolate(postSendSpr, [0, 1], [92, 74]);

            const agentReplySpr =
              frame >= 598
                ? spring({
                    frame: frame - 598,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 280 },
                  })
                : 0;
            const attachAudioRowSpr =
              frame >= 648
                ? spring({
                    frame: frame - 648,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;
            const finalVideoRowSpr =
              frame >= 694
                ? spring({
                    frame: frame - 694,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;

            const cardEnterSpr =
              frame >= 598
                ? spring({
                    frame: frame - 598,
                    fps,
                    config: { damping: 13, mass: 0.45, stiffness: 250 },
                  })
                : 0;

            const isDemoAttached = frame >= 624;
            const timeBadgePopSpr = isDemoAttached
              ? spring({
                  frame: frame - 624,
                  fps,
                  config: { damping: 10, mass: 0.4, stiffness: 300 },
                })
              : 0;
            const timeBadgeScale = isDemoAttached
              ? interpolate(timeBadgePopSpr, [0, 0.5, 1], [1, 1.26, 1])
              : 1;

            const audioDragProg = interpolate(
              frame,
              [652, 678],
              [0, 1],
              CLAMP
            );
            const audioDragX = interpolate(audioDragProg, [0, 1], [310, 0]);
            const audioDragY = interpolate(audioDragProg, [0, 1], [60, 0]);
            const audioDropAbsorb = interpolate(
              frame,
              [678, 690],
              [1, 0],
              CLAMP
            );
            const audioTileOpacity =
              interpolate(frame, [649, 655], [0, 1], CLAMP) * audioDropAbsorb;
            const audioTileScale =
              interpolate(frame, [649, 656], [0.75, 1], CLAMP) *
              interpolate(frame, [678, 690], [1, 0.45], CLAMP);

            return (
              <div
                style={{
                  position: "relative",
                  width: 1680,
                  height: 920,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    width: barWidth,
                    height: barHeight,
                    left: "50%",
                    top: "50%",
                    marginLeft: -barWidth / 2,
                    marginTop: -barHeight / 2,
                    transform: `translate3d(${barX}px, ${barY}px, 0)`,
                    opacity: barOpacity,
                    borderRadius: 999,
                    backgroundColor: isClicked
                      ? "rgba(0, 120, 212, 0.22)"
                      : "rgba(36, 36, 36, 0.94)",
                    border: isClicked
                      ? "2px solid rgba(56, 189, 248, 0.88)"
                      : "1.5px solid rgba(255, 255, 255, 0.22)",
                    boxShadow: isClicked
                      ? "0 24px 60px rgba(0, 0, 0, 0.85), 0 0 42px rgba(0, 120, 212, 0.42)"
                      : "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(0, 120, 212, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isClicked ? "0 28px" : "0 18px 0 36px",
                    zIndex: 60,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: CLEAN_SANS,
                      fontWeight: 600,
                      fontSize: isClicked ? 26 : 31,
                      letterSpacing: "-0.015em",
                      color: "#F5F3F0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{typedStr}</span>
                    {!isClicked && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 3,
                          height: 34,
                          marginLeft: 6,
                          borderRadius: 2,
                          backgroundColor: VIDMAKE_BLUE_BRIGHT,
                          opacity: Math.floor(frame / 4) % 2 === 0 ? 1 : 0.2,
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      width: isClicked ? 44 : 64,
                      height: isClicked ? 44 : 64,
                      borderRadius: 999,
                      background: isClicked
                        ? "linear-gradient(135deg, #0078D4 0%, #38BDF8 100%)"
                        : "linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 100%)",
                      boxShadow: isClicked
                        ? "0 0 28px rgba(0, 120, 212, 0.85)"
                        : "0 8px 24px rgba(255, 255, 255, 0.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `scale(${sendBtnScale})`,
                      flexShrink: 0,
                    }}
                  >
                    {isClicked ? (
                      <span
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 900,
                          fontSize: 18,
                          color: "#FFFFFF",
                        }}
                      >
                        ✓
                      </span>
                    ) : (
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M5 12H19M19 12L13 6M19 12L13 18"
                          stroke="#121212"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>

                {frame >= 574 && frame < 596 && (
                  <CursorActor
                    x={interpolate(frame, [574, 588], [620, 468], CLAMP)}
                    y={interpolate(frame, [574, 588], [260, 12], CLAMP)}
                    clickFrame={590}
                    showRipple={false}
                  />
                )}

                {frame >= 598 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 110,
                      top: 310,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 20,
                      transform: `translate3d(0, ${interpolate(agentReplySpr, [0, 1], [30, 0])}px, 0)`,
                      opacity: interpolate(frame, [598, 604], [0, 1], CLAMP),
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 22px",
                        borderRadius: 999,
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        border: "1.5px solid rgba(255, 255, 255, 0.24)",
                        fontFamily: CLEAN_SANS,
                        fontWeight: 700,
                        fontSize: 24,
                        color: "#F5F3F0",
                      }}
                    >
                      OK
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        opacity: frame >= 648 ? 0.68 : 1,
                      }}
                    >
                      {frame >= 648
                        ? renderCompletedBadge()
                        : renderThreeSquareSpinner()}
                      <div
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 700,
                          fontSize: 28,
                          color: frame >= 648 ? "#CBD5E1" : "#F5F3F0",
                          letterSpacing: "0.01em",
                        }}
                      >
                        attaching demo
                      </div>
                    </div>

                    {frame >= 648 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          transform: `translate3d(0, ${interpolate(attachAudioRowSpr, [0, 1], [22, 0])}px, 0)`,
                          opacity:
                            interpolate(frame, [648, 654], [0, 1], CLAMP) *
                            (frame >= 694 ? 0.68 : 1),
                        }}
                      >
                        {frame >= 694
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 28,
                            color: frame >= 694 ? "#CBD5E1" : "#F5F3F0",
                            letterSpacing: "0.01em",
                          }}
                        >
                          attaching audio
                        </div>
                      </div>
                    )}

                    {frame >= 694 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          transform: `translate3d(0, ${interpolate(finalVideoRowSpr, [0, 1], [22, 0])}px, 0)`,
                          opacity: interpolate(
                            frame,
                            [694, 700],
                            [0, 1],
                            CLAMP
                          ),
                        }}
                      >
                        {frame >= 718
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 28,
                            color: "#F5F3F0",
                            letterSpacing: "0.01em",
                          }}
                        >
                          giving final video
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {frame >= 598 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 780,
                      top: 236,
                      width: 344,
                      height: 612,
                      transform: `translate3d(0, ${interpolate(cardEnterSpr, [0, 1], [32, 0])}px, 0) scale(${interpolate(cardEnterSpr, [0, 1], [0.9, 1])})`,
                      opacity: interpolate(frame, [598, 604], [0, 1], CLAMP),
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        borderRadius: 28,
                        overflow: "hidden",
                        backgroundColor: "#1C1E24",
                        border:
                          frame >= 678
                            ? "2.5px solid #34D399"
                            : isDemoAttached
                              ? "2.5px solid #38BDF8"
                              : "2px solid rgba(255, 255, 255, 0.28)",
                        boxShadow:
                          frame >= 678
                            ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 58px rgba(52, 211, 153, 0.45)"
                            : isDemoAttached
                              ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 54px rgba(0, 120, 212, 0.48)"
                              : "0 36px 90px rgba(0, 0, 0, 0.92), 0 0 36px rgba(0, 120, 212, 0.25)",
                      }}
                    >
                      <Sequence from={598} durationInFrames={140}>
                        <Video
                          src={hookRecreatedVideoSrc}
                          muted
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </Sequence>

                      <div
                        style={{
                          position: "absolute",
                          top: 116,
                          left: 0,
                          right: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                          pointerEvents: "none",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: CLEAN_SANS,
                            fontWeight: 700,
                            fontSize: 18,
                            lineHeight: 1.24,
                            color: "#FFFFFF",
                            whiteSpace: "nowrap",
                            textShadow:
                              "-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.65)",
                          }}
                        >
                          Coding for 6 months ❌
                        </div>
                        <div
                          style={{
                            fontFamily: CLEAN_SANS,
                            fontWeight: 700,
                            fontSize: 18,
                            lineHeight: 1.24,
                            color: "#FFFFFF",
                            whiteSpace: "nowrap",
                            textShadow:
                              "-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.65)",
                          }}
                        >
                          This can make content for me ✅
                        </div>
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          right: 14,
                          bottom: 14,
                          padding: "5px 12px",
                          borderRadius: 999,
                          backgroundColor: isDemoAttached
                            ? "rgba(0, 120, 212, 0.88)"
                            : "rgba(18, 18, 18, 0.84)",
                          border: isDemoAttached
                            ? "1.5px solid rgba(125, 211, 252, 0.9)"
                            : "1px solid rgba(255, 255, 255, 0.24)",
                          boxShadow: isDemoAttached
                            ? "0 0 20px rgba(0, 120, 212, 0.65)"
                            : "none",
                          fontFamily: MONO_FONT,
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#FFFFFF",
                          letterSpacing: "0.02em",
                          transform: `scale(${timeBadgeScale})`,
                          zIndex: 35,
                        }}
                      >
                        {isDemoAttached ? "0:15" : "0:04"}
                      </div>
                    </div>

                    {frame >= 648 && frame < 692 && (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: 112,
                            height: 112,
                            marginLeft: -56,
                            marginTop: -56,
                            borderRadius: 24,
                            overflow: "hidden",
                            backgroundColor: "#121212",
                            border: "2px solid rgba(56, 189, 248, 0.88)",
                            boxShadow:
                              "0 24px 55px rgba(0, 0, 0, 0.9), 0 0 36px rgba(0, 120, 212, 0.55)",
                            transform: `translate3d(${audioDragX}px, ${audioDragY}px, 0) scale(${audioTileScale})`,
                            opacity: audioTileOpacity,
                            zIndex: 50,
                          }}
                        >
                          <Sequence from={648} durationInFrames={44}>
                            <Video
                              src={audioDragVideoSrc}
                              muted
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </Sequence>
                        </div>

                        <CursorActor
                          x={interpolate(frame, [652, 678], [435, 125], CLAMP)}
                          y={interpolate(frame, [652, 678], [160, 100], CLAMP)}
                          clickFrame={678}
                          showRipple={false}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* STEP 3: TALKING HEAD + DEMO WORKFLOW (Frames 738–926 / 24.6s–30.87s)*/}
      {/*   - Input Bar types "Create a talking head with demo"               */}
      {/*   - "[3-square spinner] generating talking head" -> Single center   */}
      {/*     Talking Head video card (0:08)                                  */}
      {/*   - "[3-square spinner] attaching demo" -> Duration updates         */}
      {/*     0:08 -> 0:18 on the single center video card!                   */}
      {/*   - "giving final video"                                            */}
      {/* =================================================================== */}
      {frame >= 738 && frame < 926 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: getTypingCameraTransform(744, 780),
          }}
        >
          {(() => {
            const PROMPT_TH = "Create a talking head with demo";
            const typedCount = Math.floor(
              interpolate(frame, [744, 772], [0, PROMPT_TH.length], CLAMP)
            );
            const typedStr = PROMPT_TH.slice(0, typedCount);

            const barEnterSpr = spring({
              frame: Math.max(0, frame - 738),
              fps,
              config: { damping: 13, mass: 0.45, stiffness: 250 },
            });
            const barOpacity = interpolate(frame, [738, 746], [0, 1], CLAMP);

            const isClicked = frame >= 780;
            const clickAge = Math.max(0, frame - 780);
            const postSendSpr = isClicked
              ? spring({
                  frame: frame - 780,
                  fps,
                  config: { damping: 14, mass: 0.46, stiffness: 250 },
                })
              : 0;

            const sendBtnScale = isClicked
              ? interpolate(clickAge, [0, 3, 8, 14], [1, 0.82, 1.14, 1], CLAMP)
              : interpolate(frame, [770, 779], [1, 1.07], CLAMP);

            const barX = interpolate(postSendSpr, [0, 1], [0, 410]);
            const barY =
              interpolate(barEnterSpr, [0, 1], [34, 0]) +
              interpolate(postSendSpr, [0, 1], [0, -365]);
            const barWidth = interpolate(postSendSpr, [0, 1], [1020, 680]);
            const barHeight = interpolate(postSendSpr, [0, 1], [92, 74]);

            const agentReplySpr =
              frame >= 788
                ? spring({
                    frame: frame - 788,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 280 },
                  })
                : 0;
            const attachDemoRowSpr =
              frame >= 842
                ? spring({
                    frame: frame - 842,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;
            const finalThRowSpr =
              frame >= 888
                ? spring({
                    frame: frame - 888,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;

            const cardEnterSpr =
              frame >= 788
                ? spring({
                    frame: frame - 788,
                    fps,
                    config: { damping: 13, mass: 0.45, stiffness: 250 },
                  })
                : 0;

            const isThDemoAttached = frame >= 862;
            const timeBadgePopSpr = isThDemoAttached
              ? spring({
                  frame: frame - 862,
                  fps,
                  config: { damping: 10, mass: 0.4, stiffness: 300 },
                })
              : 0;
            const timeBadgeScale = isThDemoAttached
              ? interpolate(timeBadgePopSpr, [0, 0.5, 1], [1, 1.26, 1])
              : 1;

            return (
              <div
                style={{
                  position: "relative",
                  width: 1680,
                  height: 920,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    width: barWidth,
                    height: barHeight,
                    left: "50%",
                    top: "50%",
                    marginLeft: -barWidth / 2,
                    marginTop: -barHeight / 2,
                    transform: `translate3d(${barX}px, ${barY}px, 0)`,
                    opacity: barOpacity,
                    borderRadius: 999,
                    backgroundColor: isClicked
                      ? "rgba(0, 120, 212, 0.22)"
                      : "rgba(36, 36, 36, 0.94)",
                    border: isClicked
                      ? "2px solid rgba(56, 189, 248, 0.88)"
                      : "1.5px solid rgba(255, 255, 255, 0.22)",
                    boxShadow: isClicked
                      ? "0 24px 60px rgba(0, 0, 0, 0.85), 0 0 42px rgba(0, 120, 212, 0.42)"
                      : "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(0, 120, 212, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isClicked ? "0 28px" : "0 18px 0 36px",
                    zIndex: 60,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: CLEAN_SANS,
                      fontWeight: 600,
                      fontSize: isClicked ? 26 : 31,
                      letterSpacing: "-0.015em",
                      color: "#F5F3F0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{typedStr}</span>
                    {!isClicked && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 3,
                          height: 34,
                          marginLeft: 6,
                          borderRadius: 2,
                          backgroundColor: VIDMAKE_BLUE_BRIGHT,
                          opacity: Math.floor(frame / 4) % 2 === 0 ? 1 : 0.2,
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      width: isClicked ? 44 : 64,
                      height: isClicked ? 44 : 64,
                      borderRadius: 999,
                      background: isClicked
                        ? "linear-gradient(135deg, #0078D4 0%, #38BDF8 100%)"
                        : "linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 100%)",
                      boxShadow: isClicked
                        ? "0 0 28px rgba(0, 120, 212, 0.85)"
                        : "0 8px 24px rgba(255, 255, 255, 0.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `scale(${sendBtnScale})`,
                      flexShrink: 0,
                    }}
                  >
                    {isClicked ? (
                      <span
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 900,
                          fontSize: 18,
                          color: "#FFFFFF",
                        }}
                      >
                        ✓
                      </span>
                    ) : (
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M5 12H19M19 12L13 6M19 12L13 18"
                          stroke="#121212"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>

                {frame >= 764 && frame < 786 && (
                  <CursorActor
                    x={interpolate(frame, [764, 778], [620, 468], CLAMP)}
                    y={interpolate(frame, [764, 778], [260, 12], CLAMP)}
                    clickFrame={780}
                    showRipple={false}
                  />
                )}

                {frame >= 788 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 110,
                      top: 310,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 20,
                      transform: `translate3d(0, ${interpolate(agentReplySpr, [0, 1], [30, 0])}px, 0)`,
                      opacity: interpolate(frame, [788, 794], [0, 1], CLAMP),
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 22px",
                        borderRadius: 999,
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        border: "1.5px solid rgba(255, 255, 255, 0.24)",
                        fontFamily: CLEAN_SANS,
                        fontWeight: 700,
                        fontSize: 24,
                        color: "#F5F3F0",
                      }}
                    >
                      OK
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        opacity: frame >= 842 ? 0.68 : 1,
                      }}
                    >
                      {frame >= 842
                        ? renderCompletedBadge()
                        : renderThreeSquareSpinner()}
                      <div
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 700,
                          fontSize: 28,
                          color: frame >= 842 ? "#CBD5E1" : "#F5F3F0",
                          letterSpacing: "0.01em",
                        }}
                      >
                        generating talking head
                      </div>
                    </div>

                    {frame >= 842 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          transform: `translate3d(0, ${interpolate(attachDemoRowSpr, [0, 1], [22, 0])}px, 0)`,
                          opacity:
                            interpolate(frame, [842, 848], [0, 1], CLAMP) *
                            (frame >= 888 ? 0.68 : 1),
                        }}
                      >
                        {frame >= 888
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 28,
                            color: frame >= 888 ? "#CBD5E1" : "#F5F3F0",
                            letterSpacing: "0.01em",
                          }}
                        >
                          attaching demo
                        </div>
                      </div>
                    )}

                    {frame >= 888 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          transform: `translate3d(0, ${interpolate(finalThRowSpr, [0, 1], [22, 0])}px, 0)`,
                          opacity: interpolate(
                            frame,
                            [888, 894],
                            [0, 1],
                            CLAMP
                          ),
                        }}
                      >
                        {frame >= 908
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 28,
                            color: "#F5F3F0",
                            letterSpacing: "0.01em",
                          }}
                        >
                          giving final video
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SINGLE TALKING HEAD + DEMO VIDEO CARD IN CENTER (Frames 788–926) */}
                {frame >= 788 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 780,
                      top: 236,
                      width: 344,
                      height: 612,
                      transform: `translate3d(0, ${interpolate(cardEnterSpr, [0, 1], [32, 0])}px, 0) scale(${interpolate(cardEnterSpr, [0, 1], [0.9, 1])})`,
                      opacity: interpolate(frame, [788, 794], [0, 1], CLAMP),
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        borderRadius: 28,
                        overflow: "hidden",
                        backgroundColor: "#1C1E24",
                        border: isThDemoAttached
                          ? "2.5px solid #38BDF8"
                          : "2px solid rgba(255, 255, 255, 0.28)",
                        boxShadow: isThDemoAttached
                          ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 54px rgba(0, 120, 212, 0.48)"
                          : "0 36px 90px rgba(0, 0, 0, 0.92), 0 0 36px rgba(0, 120, 212, 0.25)",
                      }}
                    >
                      <Sequence from={788} durationInFrames={138}>
                        <Video
                          src={thRecreatedVideoSrc}
                          muted
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </Sequence>

                      {/* Bottom-Right Duration Pill: Updates 0:08 -> 0:18 when Demo attaches! */}
                      <div
                        style={{
                          position: "absolute",
                          right: 14,
                          bottom: 14,
                          padding: "5px 12px",
                          borderRadius: 999,
                          backgroundColor: isThDemoAttached
                            ? "rgba(0, 120, 212, 0.88)"
                            : "rgba(18, 18, 18, 0.84)",
                          border: isThDemoAttached
                            ? "1.5px solid rgba(125, 211, 252, 0.9)"
                            : "1px solid rgba(255, 255, 255, 0.24)",
                          boxShadow: isThDemoAttached
                            ? "0 0 20px rgba(0, 120, 212, 0.65)"
                            : "none",
                          fontFamily: MONO_FONT,
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#FFFFFF",
                          letterSpacing: "0.02em",
                          transform: `scale(${timeBadgeScale})`,
                          zIndex: 35,
                        }}
                      >
                        {isThDemoAttached ? "0:18" : "0:08"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* STEP 4: SCHEDULE & PUBLISH (Frames 926–1080 / 30.87s–36.00s)        */}
      {/*   - Input Bar types "Schedule and publish"                          */}
      {/*   - "connecting to accounts" (with IG & TikTok icons)               */}
      {/*   - "scheduling to accounts"                                        */}
      {/*   - "✓ Posted to Instagram & TikTok"                                */}
      {/* =================================================================== */}
      {frame >= 926 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: getTypingCameraTransform(932, 968),
          }}
        >
          {(() => {
            const PROMPT_4 = "Schedule and publish";
            const typedCount = Math.floor(
              interpolate(frame, [932, 960], [0, PROMPT_4.length], CLAMP)
            );
            const typedStr = PROMPT_4.slice(0, typedCount);

            const barEnterSpr = spring({
              frame: Math.max(0, frame - 926),
              fps,
              config: { damping: 13, mass: 0.45, stiffness: 250 },
            });
            const barOpacity = interpolate(frame, [926, 934], [0, 1], CLAMP);

            const isClicked = frame >= 968;
            const clickAge = Math.max(0, frame - 968);
            const postSendSpr = isClicked
              ? spring({
                  frame: frame - 968,
                  fps,
                  config: { damping: 14, mass: 0.46, stiffness: 250 },
                })
              : 0;

            const sendBtnScale = isClicked
              ? interpolate(clickAge, [0, 3, 8, 14], [1, 0.82, 1.14, 1], CLAMP)
              : interpolate(frame, [958, 967], [1, 1.07], CLAMP);

            const barX = interpolate(postSendSpr, [0, 1], [0, 410]);
            const barY =
              interpolate(barEnterSpr, [0, 1], [34, 0]) +
              interpolate(postSendSpr, [0, 1], [0, -365]);
            const barWidth = interpolate(postSendSpr, [0, 1], [920, 620]);
            const barHeight = interpolate(postSendSpr, [0, 1], [92, 74]);

            const renderInstagramIcon = (size = 34) => (
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: Math.round(size * 0.28),
                  background:
                    "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(214, 36, 159, 0.45)",
                  flexShrink: 0,
                }}
              >
                <svg
                  width={Math.round(size * 0.62)}
                  height={Math.round(size * 0.62)}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <rect
                    x="2.5"
                    y="2.5"
                    width="19"
                    height="19"
                    rx="5"
                    stroke="#FFFFFF"
                    strokeWidth="2.3"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="4.2"
                    stroke="#FFFFFF"
                    strokeWidth="2.3"
                  />
                  <circle cx="17.5" cy="6.5" r="1.3" fill="#FFFFFF" />
                </svg>
              </div>
            );

            const renderTikTokIcon = (size = 34) => (
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: Math.round(size * 0.28),
                  backgroundColor: "#18181B",
                  border: "1.5px solid rgba(255, 255, 255, 0.28)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow:
                    "-2px -2px 10px rgba(37, 244, 238, 0.35), 2px 2px 10px rgba(254, 44, 85, 0.35)",
                  flexShrink: 0,
                }}
              >
                <svg
                  width={Math.round(size * 0.6)}
                  height={Math.round(size * 0.6)}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M16 4V14.5C16 16.9853 13.9853 19 11.5 19C9.01472 19 7 16.9853 7 14.5C7 12.0147 9.01472 10 11.5 10C12.05 10 12.57 10.1 13.05 10.28V6.9C12.55 6.8 12.03 6.75 11.5 6.75C7.22 6.75 3.75 10.22 3.75 14.5C3.75 18.78 7.22 22.25 11.5 22.25C15.78 22.25 19.25 18.78 19.25 14.5V9.1C20.42 9.95 21.85 10.45 23.4 10.45V7.2C20.9 7.2 19.25 5.5 19.25 4H16Z"
                    fill="#FFFFFF"
                  />
                </svg>
              </div>
            );

            const agentReplySpr =
              frame >= 976
                ? spring({
                    frame: frame - 976,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 280 },
                  })
                : 0;
            const scheduleRowSpr =
              frame >= 1012
                ? spring({
                    frame: frame - 1012,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;
            const postedRowSpr =
              frame >= 1040
                ? spring({
                    frame: frame - 1040,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;

            const stageEnterSpr =
              frame >= 976
                ? spring({
                    frame: frame - 976,
                    fps,
                    config: { damping: 13, mass: 0.45, stiffness: 250 },
                  })
                : 0;

            const isConnected = frame >= 1012;
            const isPublished = frame >= 1040;

            return (
              <div
                style={{
                  position: "relative",
                  width: 1680,
                  height: 920,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    width: barWidth,
                    height: barHeight,
                    left: "50%",
                    top: "50%",
                    marginLeft: -barWidth / 2,
                    marginTop: -barHeight / 2,
                    transform: `translate3d(${barX}px, ${barY}px, 0)`,
                    opacity: barOpacity,
                    borderRadius: 999,
                    backgroundColor: isClicked
                      ? "rgba(0, 120, 212, 0.22)"
                      : "rgba(36, 36, 36, 0.94)",
                    border: isClicked
                      ? "2px solid rgba(56, 189, 248, 0.88)"
                      : "1.5px solid rgba(255, 255, 255, 0.22)",
                    boxShadow: isClicked
                      ? "0 24px 60px rgba(0, 0, 0, 0.85), 0 0 42px rgba(0, 120, 212, 0.42)"
                      : "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(0, 120, 212, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isClicked ? "0 28px" : "0 18px 0 36px",
                    zIndex: 60,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: CLEAN_SANS,
                      fontWeight: 600,
                      fontSize: isClicked ? 26 : 31,
                      letterSpacing: "-0.015em",
                      color: "#F5F3F0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{typedStr}</span>
                    {!isClicked && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 3,
                          height: 34,
                          marginLeft: 6,
                          borderRadius: 2,
                          backgroundColor: VIDMAKE_BLUE_BRIGHT,
                          opacity: Math.floor(frame / 4) % 2 === 0 ? 1 : 0.2,
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      width: isClicked ? 44 : 64,
                      height: isClicked ? 44 : 64,
                      borderRadius: 999,
                      background: isClicked
                        ? "linear-gradient(135deg, #0078D4 0%, #38BDF8 100%)"
                        : "linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 100%)",
                      boxShadow: isClicked
                        ? "0 0 28px rgba(0, 120, 212, 0.85)"
                        : "0 8px 24px rgba(255, 255, 255, 0.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `scale(${sendBtnScale})`,
                      flexShrink: 0,
                    }}
                  >
                    {isClicked ? (
                      <span
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 900,
                          fontSize: 18,
                          color: "#FFFFFF",
                        }}
                      >
                        ✓
                      </span>
                    ) : (
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M5 12H19M19 12L13 6M19 12L13 18"
                          stroke="#121212"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>

                {frame >= 952 && frame < 974 && (
                  <CursorActor
                    x={interpolate(frame, [952, 966], [580, 418], CLAMP)}
                    y={interpolate(frame, [952, 966], [260, 12], CLAMP)}
                    clickFrame={968}
                    showRipple={false}
                  />
                )}

                {frame >= 976 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 110,
                      top: 310,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 20,
                      transform: `translate3d(0, ${interpolate(agentReplySpr, [0, 1], [30, 0])}px, 0)`,
                      opacity: interpolate(frame, [976, 982], [0, 1], CLAMP),
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 22px",
                        borderRadius: 999,
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        border: "1.5px solid rgba(255, 255, 255, 0.24)",
                        fontFamily: CLEAN_SANS,
                        fontWeight: 700,
                        fontSize: 24,
                        color: "#F5F3F0",
                      }}
                    >
                      OK
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        opacity: isConnected ? 0.72 : 1,
                      }}
                    >
                      {isConnected
                        ? renderCompletedBadge()
                        : renderThreeSquareSpinner()}
                      <div
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 700,
                          fontSize: 26,
                          color: isConnected ? "#CBD5E1" : "#F5F3F0",
                          letterSpacing: "0.01em",
                        }}
                      >
                        connecting to accounts
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginLeft: 4,
                        }}
                      >
                        {renderInstagramIcon(32)}
                        {renderTikTokIcon(32)}
                      </div>
                    </div>

                    {frame >= 1012 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          transform: `translate3d(0, ${interpolate(scheduleRowSpr, [0, 1], [22, 0])}px, 0)`,
                          opacity:
                            interpolate(frame, [1012, 1018], [0, 1], CLAMP) *
                            (isPublished ? 0.72 : 1),
                        }}
                      >
                        {isPublished
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 26,
                            color: isPublished ? "#CBD5E1" : "#F5F3F0",
                            letterSpacing: "0.01em",
                          }}
                        >
                          scheduling to accounts
                        </div>
                      </div>
                    )}

                    {frame >= 1040 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          transform: `translate3d(0, ${interpolate(postedRowSpr, [0, 1], [22, 0])}px, 0)`,
                          opacity: interpolate(
                            frame,
                            [1040, 1046],
                            [0, 1],
                            CLAMP
                          ),
                        }}
                      >
                        {renderCompletedBadge()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 26,
                            color: VIDMAKE_EMERALD_TEXT,
                            letterSpacing: "0.01em",
                          }}
                        >
                          Posted to Instagram & TikTok
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {frame >= 976 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 780,
                      top: 236,
                      width: 344,
                      height: 612,
                      borderRadius: 28,
                      overflow: "hidden",
                      backgroundColor: "#1C1E24",
                      border: isPublished
                        ? "2.5px solid #34D399"
                        : "2px solid #38BDF8",
                      boxShadow: isPublished
                        ? "0 36px 90px rgba(0,0,0,0.95), 0 0 54px rgba(52, 211, 153, 0.42)"
                        : "0 36px 90px rgba(0,0,0,0.95), 0 0 48px rgba(0, 120, 212, 0.45)",
                      transform: `translate3d(0, ${interpolate(stageEnterSpr, [0, 1], [36, 0])}px, 0) scale(${interpolate(stageEnterSpr, [0, 1], [0.9, 1])})`,
                      opacity: interpolate(frame, [976, 982], [0, 1], CLAMP),
                    }}
                  >
                    <Sequence from={976} durationInFrames={104}>
                      <Video
                        src={hookRecreatedVideoSrc}
                        muted
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </Sequence>
                    <div
                      style={{
                        position: "absolute",
                        top: 116,
                        left: 0,
                        right: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: CLEAN_SANS,
                          fontWeight: 700,
                          fontSize: 18,
                          lineHeight: 1.24,
                          color: "#FFFFFF",
                          whiteSpace: "nowrap",
                          textShadow:
                            "-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.65)",
                        }}
                      >
                        Coding for 6 months ❌
                      </div>
                      <div
                        style={{
                          fontFamily: CLEAN_SANS,
                          fontWeight: 700,
                          fontSize: 18,
                          lineHeight: 1.24,
                          color: "#FFFFFF",
                          whiteSpace: "nowrap",
                          textShadow:
                            "-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.65)",
                        }}
                      >
                        This can make content for me ✅
                      </div>
                    </div>

                    <div
                      style={{
                        position: "absolute",
                        right: 14,
                        bottom: 14,
                        padding: "5px 12px",
                        borderRadius: 999,
                        backgroundColor: "rgba(18, 18, 18, 0.84)",
                        border: "1px solid rgba(255, 255, 255, 0.24)",
                        fontFamily: MONO_FONT,
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#FFFFFF",
                        letterSpacing: "0.02em",
                        zIndex: 35,
                      }}
                    >
                      0:15
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
