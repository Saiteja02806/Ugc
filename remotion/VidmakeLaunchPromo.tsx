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
} from "remotion";
import { CursorActor } from "./effects/CursorActor";
import { LuminousMistEffect } from "./effects/LuminousMistEffect";
import { StackedKineticTypography } from "./effects/StackedKineticTypography";

export const VIDMAKE_LAUNCH_FRAMES = 900; // 30.00s @ 30fps — Hand-Drawn Storyboard + Exact Cover-Page Regenerated Pairs

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

  // Staged Media & Audio Assets
  const logoSrc = staticFile("explore/covers/sources/vidmake/vidmake-logo.png");
  const solarBgSrc = staticFile("explore/covers/sources/solar-light-bg.mp4");
  const plusSymbolSrc = staticFile("explore/covers/sources/plus-symbol.png");

  const bgMusicSrc = staticFile("explore/covers/sources/vidmake/bg-music.mp3");
  const sfxImpactSrc = staticFile("explore/covers/sources/vidmake/sfx-impact.mp3");
  const sfxWhooshSrc = staticFile("explore/covers/sources/vidmake/sfx-whoosh.mp3");
  const sfxClickSrc = staticFile("explore/covers/sources/vidmake/sfx-click.mp3");
  const sfxPopSrc = staticFile("explore/covers/sources/vidmake/sfx-pop.mp3");

  // 8 Library Thumbnails per Workflow (Synced with Cover-Page Source Assets!)
  const hookLibThumbs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
    staticFile(`explore/covers/sources/vidmake/hook-lib-${n}.jpg`)
  );
  const thLibThumbs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
    staticFile(`explore/covers/sources/vidmake/th-lib-${n}.jpg`)
  );
  const slideLibThumbs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
    staticFile(`explore/covers/sources/vidmake/slide-lib-${n}.jpg`)
  );

  // Exact Cover-Page Source -> Regenerated Pairs
  const hookViralVideoSrc = staticFile(
    "explore/covers/sources/hook-explore-video.mp4"
  );
  const hookRecreatedVideoSrc = staticFile(
    "explore/covers/sources/hook-recreated-video.mp4"
  );
  const hookDemoVideoSrc = staticFile(
    "explore/covers/sources/hook-demo-video.mp4"
  );

  const thStartPortraitSrc = staticFile(
    "explore/covers/sources/talking-head-start.png"
  );
  const audioWaveVideoSrc = staticFile(
    "explore/covers/sources/audio-wave.mp4"
  );
  const thRecreatedVideoSrc = staticFile(
    "explore/covers/sources/talking-head-source.mp4"
  );
  const productDemoVideoSrc = staticFile(
    "explore/covers/sources/product-demo-source.mp4"
  );

  const sourceSlides = [0, 1, 2, 3, 4, 5].map((n) =>
    staticFile(`explore/covers/sources/slideshow-source-${n}.jpg`)
  );
  const resultSlides = [0, 1, 2, 3, 4, 5].map((n) =>
    staticFile(`explore/covers/sources/slideshow-result-${n}.png`)
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#03040A",
        overflow: "hidden",
        fontFamily: SANS_FONT,
      }}
    >
      {/* =================================================================== */}
      {/* AUDIO DESIGN (Background Music + Impact/Whoosh/Click Sync)          */}
      {/* =================================================================== */}
      <Audio
        src={bgMusicSrc}
        volume={(f) =>
          interpolate(f, [0, 15, 860, 900], [0, 0.36, 0.36, 0], CLAMP)
        }
      />
      {[10, 105, 155, 225, 350, 435, 540, 615, 712, 780, 840].map((f) => (
        <Sequence key={`impact-${f}`} from={f} durationInFrames={35}>
          <Audio src={sfxImpactSrc} volume={0.55} />
        </Sequence>
      ))}
      {[55, 152, 283, 483, 658, 838].map((f) => (
        <Sequence key={`whoosh-${f}`} from={f} durationInFrames={25}>
          <Audio src={sfxWhooshSrc} volume={0.5} />
        </Sequence>
      ))}
      {[265, 322, 468, 516, 644, 692].map((f) => (
        <Sequence key={`click-${f}`} from={f} durationInFrames={20}>
          <Audio src={sfxClickSrc} volume={0.75} />
        </Sequence>
      ))}
      {[352, 542, 714, 790, 804, 818].map((f) => (
        <Sequence key={`pop-${f}`} from={f} durationInFrames={20}>
          <Audio src={sfxPopSrc} volume={0.6} />
        </Sequence>
      ))}

      {/* =================================================================== */}
      {/* AURORA HORIZON STAGE (Matches preview_540p_crf22_higher_quality 1)  */}
      {/* Pure pitch-black upper stage + luminous purple/indigo/coral bottom  */}
      {/* =================================================================== */}
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

      {(() => {
        const coralShiftX = interpolate(
          frame,
          [0, 60, 120, 180, 260, 345, 500, 900],
          [22, 62, 34, 58, 28, 60, 35, 52],
          CLAMP
        );
        const coralOpacity = interpolate(
          frame,
          [0, 35, 65, 95, 140, 200, 280, 345],
          [0.35, 0.85, 0.95, 0.65, 0.55, 0.82, 0.68, 0.75],
          CLAMP
        );
        return (
          <AbsoluteFill style={{ backgroundColor: "#000000", pointerEvents: "none" }}>
            {/* Deep Electric Indigo / Violet Horizon Base at Bottom */}
            <div
              style={{
                position: "absolute",
                left: "-15%",
                right: "-15%",
                bottom: "-28%",
                height: "78%",
                background:
                  "radial-gradient(ellipse 85% 65% at 50% 100%, rgba(92, 36, 255, 0.92) 0%, rgba(56, 18, 175, 0.68) 38%, rgba(20, 6, 72, 0.28) 68%, rgba(0, 0, 0, 0) 100%)",
                filter: "blur(36px)",
              }}
            />
            {/* Warm Coral-Orange Secondary Bloom (from preview_540p_crf22 (1).mp4) */}
            <div
              style={{
                position: "absolute",
                left: `${coralShiftX - 25}%`,
                bottom: "-18%",
                width: "55%",
                height: "62%",
                background:
                  "radial-gradient(ellipse at 50% 85%, rgba(235, 94, 56, 0.78) 0%, rgba(168, 52, 130, 0.42) 48%, rgba(0, 0, 0, 0) 78%)",
                filter: "blur(48px)",
                opacity: coralOpacity,
              }}
            />
          </AbsoluteFill>
        );
      })()}

      {/* =================================================================== */}
      {/* SCENE 1 (Frames 0–165):                                             */}
      {/*   Beat 1 (0–42):   "Introducing Vidmake" ALONE -> fades away        */}
      {/*   Beat 2 (42–92):  "Higgsfield for / SaaS & Sales Marketing" ALONE  */}
      {/*                    -> fades away                                    */}
      {/*   Beat 3 (92–165): Input Bar ALONE -> User types -> Clicks Send     */}
      {/*                    -> Docks top-right + Left "OK ... finding viral" */}
      {/* =================================================================== */}
      {frame < 165 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {(() => {
            const MONO_FONT = "'JetBrains Mono', monospace";
            const CLEAN_SANS =
              "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

            // ---------------------------------------------------------------
            // BEAT 1 (Frames 0–42): "Introducing Vidmake" + 3D 4-Point Star
            // Matches Row 1-2 of preview_540p_crf22_higher_quality (1).mp4
            // ---------------------------------------------------------------
            const beat1Chars = Array.from("Introducing Vidmake");
            const beat1ExitOpacity = interpolate(frame, [32, 41], [1, 0], CLAMP);
            const beat1ExitBlur = interpolate(frame, [32, 41], [0, 14], CLAMP);
            const beat1ExitScale = interpolate(frame, [32, 41], [1, 0.94], CLAMP);

            // 3D Faceted 4-Point Star underneath "Introducing Vidmake"
            const starEnterSpr = spring({
              frame: Math.max(0, frame - 2),
              fps,
              config: { damping: 12, mass: 0.45, stiffness: 220 },
            });
            const starScale =
              interpolate(starEnterSpr, [0, 1], [1.45, 1]) *
              interpolate(frame, [20, 33], [1, 0], CLAMP);
            const starY = interpolate(starEnterSpr, [0, 1], [65, 0]);
            const starRot = interpolate(frame, [0, 33], [-18, 28], CLAMP);
            const starOpacity =
              interpolate(frame, [0, 5], [0, 1], CLAMP) *
              interpolate(frame, [24, 33], [1, 0], CLAMP);

            // ---------------------------------------------------------------
            // BEAT 2 (Frames 42–92): "Higgsfield for / SaaS & Sales Marketing"
            // Comes in ONLY AFTER Beat 1 fades away! Matches Row 3-4 & 7-8
            // of preview_540p_crf22_higher_quality (1).mp4
            // ---------------------------------------------------------------
            const b2Rel = frame - 42;
            const beat2ExitOpacity = interpolate(frame, [81, 91], [1, 0], CLAMP);
            const beat2ExitBlur = interpolate(frame, [81, 91], [0, 14], CLAMP);
            const beat2ExitScale = interpolate(frame, [81, 91], [1, 0.94], CLAMP);

            const beat2Line1Words = [
              { text: "Higgsfield", color: "#FFFFFF", delay: 0 },
              { text: "for", color: "#8B5CF6", delay: 5 },
            ];
            const beat2Line2Words = [
              { text: "SaaS", color: "#FFFFFF", delay: 9 },
              { text: "&", color: "rgba(255,255,255,0.75)", delay: 13 },
              { text: "Sales", color: "#FFFFFF", delay: 16 },
              { text: "Marketing", color: "#8B5CF6", delay: 20 },
            ];

            // Glowing purple comet/droplet arc from "Advanced" in preview_540p (1).mp4
            const dropletProg = interpolate(b2Rel, [4, 24], [0, 1], CLAMP);
            const dropletX = interpolate(dropletProg, [0, 1], [-140, 165]);
            const dropletY =
              interpolate(dropletProg, [0, 0.5, 1], [-55, -110, -18]) +
              Math.sin(dropletProg * Math.PI) * -28;
            const dropletOpacity = interpolate(
              b2Rel,
              [4, 8, 20, 26],
              [0, 1, 0.9, 0],
              CLAMP
            );

            // ---------------------------------------------------------------
            // BEAT 3 (Frames 92–165): Input Bar appears ONLY AFTER Beat 2 disappears
            // ---------------------------------------------------------------
            const PROMPT_TEXT = "Create a marketing video for my SaaS";
            const typedCount = Math.floor(
              interpolate(frame, [100, 134], [0, PROMPT_TEXT.length], CLAMP)
            );
            const typedStr = PROMPT_TEXT.slice(0, typedCount);

            const barEnterSpr =
              frame >= 92
                ? spring({
                    frame: frame - 92,
                    fps,
                    config: { damping: 13, mass: 0.45, stiffness: 250 },
                  })
                : 0;
            const barOpacity = interpolate(frame, [92, 100], [0, 1], CLAMP);
            const barEnterBlur = interpolate(frame, [92, 101], [10, 0], CLAMP);

            const isClicked = frame >= 142;
            const clickAge = Math.max(0, frame - 142);
            const postSendSpr =
              frame >= 142
                ? spring({
                    frame: frame - 142,
                    fps,
                    config: { damping: 14, mass: 0.46, stiffness: 250 },
                  })
                : 0;

            const sendBtnScale = isClicked
              ? interpolate(clickAge, [0, 3, 8, 14], [1, 0.82, 1.14, 1], CLAMP)
              : interpolate(frame, [132, 140], [1, 1.07], CLAMP);

            const barX = interpolate(postSendSpr, [0, 1], [0, 290]);
            const barY =
              interpolate(barEnterSpr, [0, 1], [36, 0]) +
              interpolate(postSendSpr, [0, 1], [0, -255]);
            const barWidth = interpolate(postSendSpr, [0, 1], [1020, 680]);
            const barHeight = interpolate(postSendSpr, [0, 1], [92, 74]);

            // 3-square L-grid spinner state (steps around 2x2 grid every 4 frames)
            const spinnerStep = Math.floor(Math.max(0, frame - 146) / 4) % 4;
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

            const agentReplySpr =
              frame >= 147
                ? spring({
                    frame: frame - 147,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 280 },
                  })
                : 0;

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
                {/* ========================================================= */}
                {/* BEAT 1 (Frames 0–42): "Introducing Vidmake" ALONE         */}
                {/* ========================================================= */}
                {frame < 42 && (
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
                    {/* Per-Character Left-to-Right Focus Sweep */}
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
                          [0, 0.38, 1],
                          CLAMP
                        );
                        const cBlur = interpolate(
                          cRel,
                          [0, 4, 8],
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
                              color: "#FFFFFF",
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

                    {/* 3D Faceted 4-Point Glowing Star underneath (from preview_540p 1) */}
                    <div
                      style={{
                        marginTop: 22,
                        transform: `translate3d(0, ${starY}px, 0) scale(${starScale}) rotate(${starRot}deg)`,
                        opacity: starOpacity,
                        filter:
                          "drop-shadow(0 0 24px rgba(168, 85, 247, 0.9)) drop-shadow(0 0 48px rgba(124, 58, 237, 0.6))",
                      }}
                    >
                      <svg width="96" height="96" viewBox="0 0 100 100">
                        <defs>
                          <radialGradient
                            id="starCoreGrad"
                            cx="50%"
                            cy="50%"
                            r="50%"
                          >
                            <stop offset="0%" stopColor="#FFFFFF" />
                            <stop offset="38%" stopColor="#F0ABFC" />
                            <stop offset="72%" stopColor="#9333EA" />
                            <stop offset="100%" stopColor="#3B0764" />
                          </radialGradient>
                        </defs>
                        <path
                          d="M50 4 C54 34, 66 46, 96 50 C66 54, 54 66, 50 96 C46 66, 34 54, 4 50 C34 46, 46 34, 50 4 Z"
                          fill="url(#starCoreGrad)"
                        />
                        <path
                          d="M50 14 C52.5 36, 64 47.5, 86 50 C64 52.5, 52.5 64, 50 86 C47.5 64, 36 52.5, 14 50 C36 47.5, 47.5 36, 50 14 Z"
                          fill="#FFFFFF"
                          opacity="0.7"
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* BEAT 2 (Frames 42–92): "Higgsfield for / SaaS & Sales..." */}
                {/* ========================================================= */}
                {frame >= 42 && frame < 92 && (
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
                    {/* Glowing Violet Comet/Droplet Streak (from "Advanced" in preview_540p 1) */}
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: 28,
                        height: 54,
                        borderRadius: 999,
                        background:
                          "linear-gradient(180deg, rgba(168, 85, 247, 0.95) 0%, rgba(99, 102, 241, 0.2) 100%)",
                        boxShadow: "0 0 32px rgba(139, 92, 246, 0.9)",
                        transform: `translate3d(${dropletX}px, ${dropletY}px, 0) rotate(28deg)`,
                        opacity: dropletOpacity,
                        filter: "blur(3px)",
                        pointerEvents: "none",
                      }}
                    />

                    {/* Line 1: "Higgsfield for" */}
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
                          [0, 4, 9],
                          [0, 0.32, 1],
                          CLAMP
                        );
                        const wBlur = interpolate(
                          wRel,
                          [0, 5, 10],
                          [12, 4, 0],
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

                    {/* Line 2: "SaaS & Sales Marketing" */}
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
                          [0, 4, 9],
                          [0, 0.32, 1],
                          CLAMP
                        );
                        const wBlur = interpolate(
                          wRel,
                          [0, 5, 10],
                          [12, 4, 0],
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

                {/* ========================================================= */}
                {/* BEAT 3 (Frames 92–165): INPUT BAR ALONE -> SEND TO CHAT   */}
                {/* ========================================================= */}
                {frame >= 92 && (
                  <div
                    style={{
                      position: "absolute",
                      width: barWidth,
                      height: barHeight,
                      borderRadius: 999,
                      backgroundColor: isClicked
                        ? "rgba(88, 56, 235, 0.28)"
                        : "rgba(18, 18, 28, 0.92)",
                      border: isClicked
                        ? "2px solid rgba(139, 92, 246, 0.85)"
                        : "1.5px solid rgba(255, 255, 255, 0.22)",
                      boxShadow: isClicked
                        ? "0 24px 60px rgba(0, 0, 0, 0.85), 0 0 42px rgba(139, 92, 246, 0.4)"
                        : "0 32px 80px rgba(0, 0, 0, 0.92), 0 0 40px rgba(124, 58, 237, 0.22)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: isClicked ? "0 28px" : "0 14px 0 34px",
                      transform: `translate3d(${barX}px, ${barY}px, 0)`,
                      opacity: barOpacity,
                      filter:
                        barEnterBlur > 0.2 ? `blur(${barEnterBlur}px)` : "none",
                      zIndex: 30,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: CLEAN_SANS,
                          fontWeight: 600,
                          fontSize: isClicked ? 26 : 30,
                          letterSpacing: "-0.015em",
                          color: "#FFFFFF",
                        }}
                      >
                        {typedStr || "Ask Vidmake..."}
                      </span>
                      {!isClicked && frame % 12 < 7 && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 3,
                            height: 34,
                            backgroundColor: "#A855F7",
                            borderRadius: 2,
                          }}
                        />
                      )}
                    </div>

                    {/* Send Chevron Button on the right */}
                    <div
                      style={{
                        width: isClicked ? 44 : 64,
                        height: isClicked ? 44 : 64,
                        borderRadius: 999,
                        background: isClicked
                          ? "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)"
                          : "linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 100%)",
                        boxShadow: isClicked
                          ? "0 0 28px rgba(139, 92, 246, 0.8)"
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
                            stroke="#090A0F"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                )}

                {/* Sculpted Cursor clicking the Send Chevron Button */}
                {frame >= 116 && frame < 152 && (
                  <CursorActor
                    x={interpolate(frame, [116, 138], [640, 468], CLAMP)}
                    y={interpolate(frame, [116, 138], [300, 12], CLAMP)}
                    clickFrame={142}
                    showRipple={false}
                  />
                )}

                {/* LEFT AGENT RESPONSE AT FRAME 147+: "OK" above, and "[3-Square L-Grid Spinner] finding viral content" below */}
                {frame >= 147 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 110,
                      top: 390,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 18,
                      transform: `translate3d(0, ${interpolate(agentReplySpr, [0, 1], [36, 0])}px, 0) scale(${interpolate(agentReplySpr, [0, 1], [0.92, 1])})`,
                      opacity: interpolate(frame, [147, 152], [0, 1], CLAMP),
                    }}
                  >
                    {/* "OK" Badge */}
                    <div
                      style={{
                        padding: "8px 22px",
                        borderRadius: 999,
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        border: "1.5px solid rgba(255, 255, 255, 0.28)",
                        fontFamily: CLEAN_SANS,
                        fontWeight: 700,
                        fontSize: 24,
                        color: "#FFFFFF",
                      }}
                    >
                      OK
                    </div>

                    {/* 3-Square L-Grid Loader SVG inline before "finding viral content" (replacing "...") */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          backgroundColor: "rgba(139, 92, 246, 0.16)",
                          border: "1.5px solid rgba(139, 92, 246, 0.55)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
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
                              fill={idx === 0 ? "#A855F7" : "#FFFFFF"}
                            />
                          ))}
                        </svg>
                      </div>

                      <div
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 700,
                          fontSize: 28,
                          color: "#E2E8F0",
                          letterSpacing: "0.01em",
                        }}
                      >
                        finding viral content
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
      {/* STEP 1 (Frames 165–345 / 5.5s–11.5s):                               */}
      {/*   1A (165–240): Interactive Viral Hooks Pull-Up Screen (from        */}
      {/*                 D:\hookswithlinks) -> Select Winning Hook (3.4M)    */}
      {/*                 -> Closes smoothly back into the chat               */}
      {/*   1B (240–294): [3-square spinner] recreating for you -> Recreated  */}
      {/*                 Hook Video pops in WITHOUT text overlay first       */}
      {/*   1C (294–345): [3-square spinner] attaching the text -> Visual     */}
      {/*                 hook caption flies in and locks onto the video      */}
      {/* =================================================================== */}
      {frame >= 165 && frame < 345 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {(() => {
            const MONO_FONT = "'JetBrains Mono', monospace";
            const CLEAN_SANS =
              "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

            // 3-square L-grid spinner helper
            const spinnerStep = Math.floor(frame / 4) % 4;
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
                  backgroundColor: "rgba(139, 92, 246, 0.18)",
                  border: "1.5px solid rgba(139, 92, 246, 0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 18px rgba(139, 92, 246, 0.35)",
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
                      fill={idx === 0 ? "#A855F7" : "#FFFFFF"}
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
                  border: "1.5px solid rgba(52, 211, 153, 0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: CLEAN_SANS,
                  fontWeight: 800,
                  fontSize: 20,
                  color: "#34D399",
                }}
              >
                ✓
              </div>
            );

            // Background chat layer recedes slightly during the Pull-Up Screen (165–238)
            // and returns to full focus at 238+
            const pullUpActive = interpolate(
              frame,
              [165, 174, 226, 238],
              [0, 1, 1, 0],
              CLAMP
            );
            const chatScale = interpolate(pullUpActive, [0, 1], [1, 0.9]);
            const chatY = interpolate(pullUpActive, [0, 1], [0, -75]);
            const chatOpacity = interpolate(pullUpActive, [0, 1], [1, 0.24]);
            const chatBlur = interpolate(pullUpActive, [0, 1], [0, 6]);

            // Pull-Up Viral Hooks Screen physics (165–240)
            const pullEnterSpr = spring({
              frame: Math.max(0, frame - 166),
              fps,
              config: { damping: 13, mass: 0.48, stiffness: 230 },
            });
            const pullCloseProg = interpolate(
              frame,
              [226, 239],
              [0, 1],
              CLAMP
            );
            const pullY =
              interpolate(pullEnterSpr, [0, 1], [220, 24]) +
              interpolate(pullCloseProg, [0, 1], [0, 110]);
            const pullScale =
              interpolate(pullEnterSpr, [0, 1], [0.84, 1]) *
              interpolate(pullCloseProg, [0, 1], [1, 0.76]);
            const pullOpacity =
              interpolate(frame, [166, 174], [0, 1], CLAMP) *
              interpolate(frame, [226, 239], [1, 0], CLAMP);
            const pullBlur = interpolate(frame, [226, 239], [0, 14], CLAMP);

            const hookPullCards = [
              {
                src: staticFile("explore/covers/sources/vidmake/hook-viral-1.mp4"),
                views: "2.4M",
                tag: "Stop Scrolling",
                xOffset: -540,
                rot: -5,
              },
              {
                src: staticFile("explore/covers/sources/vidmake/hook-viral-2.mp4"),
                views: "1.9M",
                tag: "Founder POV",
                xOffset: -275,
                rot: -2.5,
              },
              {
                src: hookViralVideoSrc,
                views: "3.4M",
                tag: "SaaS Viral Hook",
                xOffset: 0,
                rot: 0,
              },
              {
                src: staticFile("explore/covers/sources/vidmake/hook-viral-3.mp4"),
                views: "4.8M",
                tag: "App Reveal",
                xOffset: 275,
                rot: 2.5,
              },
              {
                src: staticFile("explore/covers/sources/vidmake/hook-viral-4.mp4"),
                views: "2.9M",
                tag: "Reaction Split",
                xOffset: 540,
                rot: 5,
              },
            ];

            const isHookSelected = frame >= 202;
            const selectSpr = isHookSelected
              ? spring({
                  frame: frame - 202,
                  fps,
                  config: { damping: 12, mass: 0.42, stiffness: 290 },
                })
              : 0;

            // Step 1B (240+): "recreating for you" + Recreated Hook Video (without text first)
            const recreateRowSpr =
              frame >= 240
                ? spring({
                    frame: frame - 240,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;
            const videoCardSpr =
              frame >= 244
                ? spring({
                    frame: frame - 244,
                    fps,
                    config: { damping: 13, mass: 0.46, stiffness: 250 },
                  })
                : 0;

            // Step 1C (294+): "attaching the text" + Visual Text Overlay flying onto video
            const attachTextRowSpr =
              frame >= 294
                ? spring({
                    frame: frame - 294,
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 270 },
                  })
                : 0;
            const textFlySpr =
              frame >= 297
                ? spring({
                    frame: frame - 297,
                    fps,
                    config: { damping: 12, mass: 0.42, stiffness: 260 },
                  })
                : 0;
            const isTextLocked = frame >= 315;
            const editorChromeOpacity =
              interpolate(frame, [297, 302], [0, 1], CLAMP) *
              interpolate(frame, [322, 332], [1, 0], CLAMP);

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
                {/* ========================================================= */}
                {/* MAIN CHAT STAGE (Recedes during Pull-Up, sharp at 238+)   */}
                {/* ========================================================= */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: `translate3d(0, ${chatY}px, 0) scale(${chatScale})`,
                    opacity: chatOpacity,
                    filter: chatBlur > 0.2 ? `blur(${chatBlur}px)` : "none",
                  }}
                >
                  {/* Top-Right Sent User Bubble */}
                  <div
                    style={{
                      position: "absolute",
                      width: 680,
                      height: 74,
                      left: "50%",
                      top: "50%",
                      marginLeft: -340,
                      marginTop: -37,
                      transform: "translate3d(290px, -255px, 0)",
                      borderRadius: 999,
                      backgroundColor: "rgba(88, 56, 235, 0.28)",
                      border: "2px solid rgba(139, 92, 246, 0.85)",
                      boxShadow:
                        "0 24px 60px rgba(0, 0, 0, 0.85), 0 0 42px rgba(139, 92, 246, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 28px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: CLEAN_SANS,
                        fontWeight: 600,
                        fontSize: 26,
                        letterSpacing: "-0.015em",
                        color: "#FFFFFF",
                      }}
                    >
                      Create a marketing video for my SaaS
                    </span>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        background:
                          "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
                        boxShadow: "0 0 28px rgba(139, 92, 246, 0.8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: MONO_FONT,
                        fontWeight: 900,
                        fontSize: 18,
                        color: "#FFFFFF",
                      }}
                    >
                      ✓
                    </div>
                  </div>

                  {/* Left Agent Status Stack */}
                  <div
                    style={{
                      position: "absolute",
                      left: 110,
                      top: frame >= 240 ? 310 : 390,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 20,
                    }}
                  >
                    {/* "OK" Badge */}
                    <div
                      style={{
                        padding: "8px 22px",
                        borderRadius: 999,
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        border: "1.5px solid rgba(255, 255, 255, 0.28)",
                        fontFamily: CLEAN_SANS,
                        fontWeight: 700,
                        fontSize: 24,
                        color: "#FFFFFF",
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
                        opacity: frame >= 240 ? 0.65 : 1,
                      }}
                    >
                      {frame >= 238
                        ? renderCompletedBadge()
                        : renderThreeSquareSpinner()}
                      <div
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 700,
                          fontSize: 28,
                          color: frame >= 240 ? "#CBD5E1" : "#E2E8F0",
                          letterSpacing: "0.01em",
                        }}
                      >
                        finding viral content
                      </div>
                    </div>

                    {/* Line 2 (240+): recreating for you */}
                    {frame >= 240 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          transform: `translate3d(0, ${interpolate(recreateRowSpr, [0, 1], [22, 0])}px, 0)`,
                          opacity:
                            interpolate(frame, [240, 246], [0, 1], CLAMP) *
                            (frame >= 294 ? 0.68 : 1),
                        }}
                      >
                        {frame >= 294
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 28,
                            color: frame >= 294 ? "#CBD5E1" : "#FFFFFF",
                            letterSpacing: "0.01em",
                          }}
                        >
                          recreating for you
                        </div>
                      </div>
                    )}

                    {/* Line 3 (294+): attaching the text */}
                    {frame >= 294 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          transform: `translate3d(0, ${interpolate(attachTextRowSpr, [0, 1], [22, 0])}px, 0)`,
                          opacity: interpolate(
                            frame,
                            [294, 300],
                            [0, 1],
                            CLAMP
                          ),
                        }}
                      >
                        {frame >= 332
                          ? renderCompletedBadge()
                          : renderThreeSquareSpinner()}
                        <div
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 700,
                            fontSize: 28,
                            color: "#FFFFFF",
                            letterSpacing: "0.01em",
                          }}
                        >
                          attaching the text
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ======================================================= */}
                  {/* RECREATED HOOK VIDEO IN CHAT (Frames 244–345)           */}
                  {/* Appears WITHOUT text first (244–296), then text flies   */}
                  {/* in and locks onto the video (297–345)!                  */}
                  {/* ======================================================= */}
                  {frame >= 244 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 830,
                        top: 230,
                        display: "flex",
                        alignItems: "center",
                        gap: 32,
                        transform: `translate3d(0, ${interpolate(videoCardSpr, [0, 1], [48, 0])}px, 0) scale(${interpolate(videoCardSpr, [0, 1], [0.86, 1])})`,
                        opacity: interpolate(frame, [244, 252], [0, 1], CLAMP),
                      }}
                    >
                      {/* Vertical 9:16 Recreated Hook Video Card */}
                      <div
                        style={{
                          position: "relative",
                          width: 344,
                          height: 612,
                          borderRadius: 28,
                          overflow: "hidden",
                          backgroundColor: "#080912",
                          border: isTextLocked
                            ? "2.5px solid #A855F7"
                            : "2px solid rgba(255, 255, 255, 0.26)",
                          boxShadow: isTextLocked
                            ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 54px rgba(168, 85, 247, 0.45)"
                            : "0 36px 90px rgba(0, 0, 0, 0.92), 0 0 36px rgba(124, 58, 237, 0.25)",
                        }}
                      >
                        <Sequence from={240} durationInFrames={105}>
                          <OffthreadVideo
                            src={hookRecreatedVideoSrc}
                            muted
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </Sequence>

                        {/* Top status pill on video */}
                        <div
                          style={{
                            position: "absolute",
                            top: 14,
                            left: 14,
                            padding: "6px 14px",
                            borderRadius: 999,
                            backgroundColor: "rgba(10, 12, 22, 0.82)",
                            border: "1px solid rgba(255, 255, 255, 0.22)",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            zIndex: 25,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: isTextLocked
                                ? "#34D399"
                                : "#A855F7",
                              boxShadow: isTextLocked
                                ? "0 0 10px #34D399"
                                : "0 0 10px #A855F7",
                            }}
                          />
                          <span
                            style={{
                              fontFamily: CLEAN_SANS,
                              fontWeight: 700,
                              fontSize: 13,
                              color: "#FFFFFF",
                            }}
                          >
                            {isTextLocked
                              ? "Hook + Text Attached"
                              : "Recreated Hook"}
                          </span>
                        </div>

                        {/* VISUAL TEXT OVERLAY FLY-IN & LOCK (Frames 297–345) */}
                        {frame >= 297 && (
                          <div
                            style={{
                              position: "absolute",
                              top: 108,
                              left: 14,
                              right: 14,
                              transform: `translate3d(${interpolate(textFlySpr, [0, 1], [-220, 0])}px, ${interpolate(textFlySpr, [0, 1], [38, 0])}px, 0) scale(${interpolate(textFlySpr, [0, 0.75, 1], [1.18, 0.97, 1])})`,
                              opacity: interpolate(
                                frame,
                                [297, 303],
                                [0, 1],
                                CLAMP
                              ),
                              zIndex: 30,
                            }}
                          >
                            {/* Interactive Text Layer Bounding Chrome while attaching */}
                            <div
                              style={{
                                position: "relative",
                                padding: "12px 10px",
                                borderRadius: 14,
                                backgroundColor: `rgba(139, 92, 246, ${0.22 * editorChromeOpacity})`,
                                border: `2px dashed rgba(192, 132, 252, ${0.95 * editorChromeOpacity})`,
                                boxShadow:
                                  editorChromeOpacity > 0.05
                                    ? `0 0 28px rgba(168, 85, 247, ${0.55 * editorChromeOpacity})`
                                    : "none",
                              }}
                            >
                              {editorChromeOpacity > 0.05 && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: -26,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    padding: "3px 10px",
                                    borderRadius: 999,
                                    backgroundColor: "#9333EA",
                                    fontFamily: CLEAN_SANS,
                                    fontWeight: 700,
                                    fontSize: 11,
                                    color: "#FFFFFF",
                                    whiteSpace: "nowrap",
                                    opacity: editorChromeOpacity,
                                  }}
                                >
                                  T • Hook Text Overlay
                                </div>
                              )}
                              <div
                                style={{
                                  fontFamily: CLEAN_SANS,
                                  fontWeight: 700,
                                  fontSize: 19,
                                  lineHeight: 1.26,
                                  color: "#FFFFFF",
                                  textAlign: "center",
                                  textShadow:
                                    "-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.65)",
                                }}
                              >
                                Coding for 6 months ❌
                              </div>
                              <div
                                style={{
                                  marginTop: 4,
                                  fontFamily: CLEAN_SANS,
                                  fontWeight: 700,
                                  fontSize: 19,
                                  lineHeight: 1.26,
                                  color: "#FFFFFF",
                                  textAlign: "center",
                                  textShadow:
                                    "-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.65)",
                                }}
                              >
                                This can make content for me ✅
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ========================================================= */}
                {/* INTERACTIVE VIRAL HOOKS PULL-UP SCREEN (Frames 165–240)   */}
                {/* Pulls up 5 real viral hooks from D:\hookswithlinks,       */}
                {/* selects the center 3.4M viral hook, and closes smoothly   */}
                {/* ========================================================= */}
                {frame < 240 && (
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
                    {/* Pull-Up Screen Header */}
                    <div
                      style={{
                        marginBottom: 28,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "10px 26px",
                        borderRadius: 999,
                        backgroundColor: "rgba(18, 18, 30, 0.88)",
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
                          color: "#FFFFFF",
                        }}
                      >
                        {isHookSelected
                          ? "Selected winning viral hook"
                          : "Scanning viral hooks for your SaaS"}
                      </span>
                    </div>

                    {/* 5-Card Interactive Row of Real Viral Hook Videos */}
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
                          frame: Math.max(0, frame - 168 - idx * 2),
                          fps,
                          config: { damping: 13, mass: 0.44, stiffness: 250 },
                        });

                        const cardScale =
                          interpolate(cEnterSpr, [0, 1], [0.75, 1]) *
                          (isCenter
                            ? interpolate(selectSpr, [0, 1], [1.04, 1.15])
                            : interpolate(selectSpr, [0, 1], [0.94, 0.86]));

                        const cardX =
                          interpolate(cEnterSpr, [0, 1], [card.xOffset * 0.5, card.xOffset]) +
                          (isCenter
                            ? interpolate(selectSpr, [0, 1], [0, -90])
                            : 0);
                        const cardY = isCenter
                          ? interpolate(selectSpr, [0, 1], [-8, -16])
                          : Math.abs(idx - 2) * 12;
                        const cardRot = isCenter
                          ? 0
                          : interpolate(selectSpr, [0, 1], [card.rot, card.rot * 0.6]);
                        const cardOpacity = isCenter
                          ? 1
                          : interpolate(selectSpr, [0, 1], [0.88, 0.35]);
                        const cardBlur =
                          !isCenter && isHookSelected
                            ? interpolate(selectSpr, [0, 1], [0, 3.5])
                            : 0;

                        return (
                          <div
                            key={idx}
                            style={{
                              position: "absolute",
                              width: 248,
                              height: 440,
                              borderRadius: 24,
                              overflow: "hidden",
                              backgroundColor: "#0A0C16",
                              border:
                                isCenter && isHookSelected
                                  ? "3px solid #A855F7"
                                  : "1.5px solid rgba(255, 255, 255, 0.22)",
                              boxShadow:
                                isCenter && isHookSelected
                                  ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 60px rgba(168, 85, 247, 0.65)"
                                  : "0 24px 54px rgba(0, 0, 0, 0.85)",
                              transform: `translate3d(${cardX}px, ${cardY}px, 0) scale(${cardScale}) rotate(${cardRot}deg)`,
                              opacity: cardOpacity,
                              filter:
                                cardBlur > 0.2 ? `blur(${cardBlur}px)` : "none",
                              zIndex: isCenter ? 30 : 10 - Math.abs(idx - 2),
                            }}
                          >
                            <Sequence from={165} durationInFrames={75}>
                              <OffthreadVideo
                                src={card.src}
                                muted
                                playbackRate={0.85}
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

                            {/* Top Views Pill */}
                            <div
                              style={{
                                position: "absolute",
                                top: 12,
                                left: 12,
                                padding: "5px 12px",
                                borderRadius: 999,
                                backgroundColor: "rgba(0, 0, 0, 0.72)",
                                border: "1px solid rgba(255, 255, 255, 0.22)",
                                fontFamily: CLEAN_SANS,
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#FFFFFF",
                              }}
                            >
                              🔥 {card.views}
                            </div>

                            {/* Bottom Format Tag */}
                            <div
                              style={{
                                position: "absolute",
                                bottom: 14,
                                left: 14,
                                right: 14,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
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

                      {/* UseFastlane-style Callout Card on Selection (Frames 202–239) */}
                      {isHookSelected && (
                        <div
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: `translate3d(${interpolate(selectSpr, [0, 1], [40, 85])}px, -95px, 0) scale(${interpolate(selectSpr, [0, 1], [0.86, 1])})`,
                            opacity: interpolate(
                              frame,
                              [202, 208],
                              [0, 1],
                              CLAMP
                            ),
                            width: 310,
                            padding: "24px 26px",
                            borderRadius: 24,
                            backgroundColor: "rgba(18, 18, 30, 0.95)",
                            border: "2px solid rgba(168, 85, 247, 0.75)",
                            boxShadow:
                              "0 28px 70px rgba(0, 0, 0, 0.92), 0 0 42px rgba(168, 85, 247, 0.35)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            zIndex: 40,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: CLEAN_SANS,
                              fontWeight: 800,
                              fontSize: 48,
                              lineHeight: 1,
                              letterSpacing: "-0.03em",
                              color: "#FFFFFF",
                            }}
                          >
                            3.4M
                          </div>
                          <div
                            style={{
                              fontFamily: CLEAN_SANS,
                              fontWeight: 600,
                              fontSize: 16,
                              color: "rgba(255, 255, 255, 0.72)",
                            }}
                          >
                            views • 98% 3-second hold
                          </div>
                          <div
                            style={{
                              marginTop: 6,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 14px",
                              borderRadius: 999,
                              backgroundColor: "rgba(16, 185, 129, 0.16)",
                              border: "1.5px solid rgba(52, 211, 153, 0.65)",
                              fontFamily: CLEAN_SANS,
                              fontWeight: 700,
                              fontSize: 15,
                              color: "#34D399",
                              alignSelf: "flex-start",
                            }}
                          >
                            <span>✓</span>
                            <span>Selected for recreation</span>
                          </div>
                        </div>
                      )}

                      {/* Cursor selecting the center viral hook card */}
                      {frame >= 182 && frame < 222 && (
                        <CursorActor
                          x={interpolate(frame, [182, 200], [320, -10], CLAMP)}
                          y={interpolate(frame, [182, 200], [260, 40], CLAMP)}
                          clickFrame={202}
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
      {/* SCENE 4 (Frames 345–615): WORKFLOW 2 — TALKING HEAD                 */}
      {/* =================================================================== */}
      {frame >= 345 && frame < 615 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WorkflowTopBanner
            stepNum="02"
            workflowName="TALKING HEAD"
            activeStage={frame < 485 ? 0 : frame < 540 ? 1 : 2}
            accentColor="#00F0FF"
          />

          {/* STEP 4A (Frames 435–485): 4x2 Library Grid of 8 Viral Talking Heads */}
          {frame < 485 && (
            <>
              <ViralLibrary4x2Grid
                relFrame={frame - 435}
                thumbnails={thLibThumbs}
                meta={TH_LIBRARY_META}
                selectedIndex={2}
                highlightRelFrame={26}
                accentColor="#00F0FF"
                libraryTitle="VIRAL TALKING HEAD LIBRARY"
              />
              <CursorActor
                x={interpolate(frame, [442, 462], [-380, 175], CLAMP)}
                y={interpolate(frame, [442, 462], [310, -120], CLAMP)}
                clickFrame={468}
              />
            </>
          )}

          {/* STEP 4B (Frames 485–540): Sudden Isolate Talking Head + Script Audio -> Click Recreate */}
          {frame >= 485 && frame < 540 && (
            <>
              <IsolatedViralCardWithRecreate
                relFrame={frame - 485}
                headerTitle="TALKING HEAD"
                viewsLabel="4.1M Views"
                nicheLabel="AI Creator + Viral Voice Script"
                accentColor="#00F0FF"
                hoverRelFrame={18}
                clickRelFrame={31}
                mediaNode={
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <Img
                      src={thStartPortraitSrc}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    {/* Live Audio Waveform Pill from TalkingHeadDemoPromo */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 18,
                        left: 18,
                        right: 18,
                        height: 58,
                        borderRadius: 16,
                        overflow: "hidden",
                        border: "1.5px solid #00F0FF",
                        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.85)",
                      }}
                    >
                      <OffthreadVideo
                        src={audioWaveVideoSrc}
                        muted
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  </div>
                }
              />
              <CursorActor
                x={interpolate(frame, [488, 510], [160, 385], CLAMP)}
                y={interpolate(frame, [488, 510], [-80, 345], CLAMP)}
                clickFrame={516}
              />
            </>
          )}

          {/* STEP 4C (Frames 540–615): Recreated Talking Head (Same Creator Speaking!) + Product Demo */}
          {frame >= 540 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 48,
                marginTop: 48,
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                }}
              >
                <div
                  style={{
                    width: 350,
                    height: 620,
                    borderRadius: 28,
                    overflow: "hidden",
                    border: "3px solid #00F0FF",
                    boxShadow:
                      "0 34px 85px rgba(0,0,0,0.94), 0 0 48px rgba(0,240,255,0.4)",
                    position: "relative",
                  }}
                >
                  <OffthreadVideo
                    src={thRecreatedVideoSrc}
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      padding: "6px 14px",
                      borderRadius: 999,
                      backgroundColor: "#00F0FF",
                      color: "#03040A",
                      fontFamily: DISPLAY_FONT,
                      fontWeight: 900,
                      fontSize: 14,
                    }}
                  >
                    ✓ RECREATED TALKING HEAD
                  </div>
                </div>

                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    backgroundColor: "#070912",
                    border: "2px solid #FF176B",
                    boxShadow: "0 0 28px rgba(255, 23, 107, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 20,
                  }}
                >
                  <Img
                    src={plusSymbolSrc}
                    style={{ width: 34, height: 34, objectFit: "contain" }}
                  />
                </div>

                <div
                  style={{
                    width: 350,
                    height: 620,
                    borderRadius: 28,
                    overflow: "hidden",
                    border: "3px solid #FF176B",
                    boxShadow:
                      "0 34px 85px rgba(0,0,0,0.94), 0 0 48px rgba(255,23,107,0.4)",
                    position: "relative",
                  }}
                >
                  <OffthreadVideo
                    src={productDemoVideoSrc}
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      padding: "6px 14px",
                      borderRadius: 999,
                      backgroundColor: "#FF176B",
                      color: "#FFFFFF",
                      fontFamily: DISPLAY_FONT,
                      fontWeight: 900,
                      fontSize: 14,
                    }}
                  >
                    ✓ YOUR SAAS DEMO
                  </div>
                </div>
              </div>

              <StackedKineticTypography
                startFrame={544}
                blocks={[
                  {
                    text: "TALKING HEAD",
                    bgColor: "#00F0FF",
                    textColor: "#03040A",
                    rotation: -2.0,
                    fontSize: 78,
                    delayFrames: 0,
                  },
                  {
                    text: "+ PRODUCT DEMO",
                    bgColor: "#FF176B",
                    textColor: "#FFFFFF",
                    rotation: 1.5,
                    fontSize: 72,
                    delayFrames: 5,
                  },
                  {
                    text: "RECREATED & SYNCED IN SECONDS",
                    bgColor: "#FFFFFF",
                    textColor: "#03040A",
                    rotation: -1.0,
                    fontSize: 38,
                    delayFrames: 10,
                  },
                ]}
              />
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* SCENE 5 (Frames 615–780): WORKFLOW 3 — SLIDESHOW                    */}
      {/* Uses Exact Cover-Page Pair: slideshow-source-0..5 -> result-0..5    */}
      {/* =================================================================== */}
      {frame >= 615 && frame < 780 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WorkflowTopBanner
            stepNum="03"
            workflowName="SLIDESHOW"
            activeStage={frame < 660 ? 0 : frame < 712 ? 1 : 2}
            accentColor="#D4FF00"
          />

          {/* STEP 5A (Frames 615–660): 4x2 Library Grid of 8 Viral Slideshows */}
          {frame < 660 && (
            <>
              <ViralLibrary4x2Grid
                relFrame={frame - 615}
                thumbnails={slideLibThumbs}
                meta={SLIDE_LIBRARY_META}
                selectedIndex={1}
                highlightRelFrame={22}
                accentColor="#D4FF00"
                libraryTitle="VIRAL SLIDESHOW LIBRARY (16+ NICHES)"
              />
              <CursorActor
                x={interpolate(frame, [620, 640], [420, -170], CLAMP)}
                y={interpolate(frame, [620, 640], [280, -120], CLAMP)}
                clickFrame={644}
              />
            </>
          )}

          {/* STEP 5B (Frames 660–712): Sudden Isolate Source Slideshow ("5 tips...") + Click Recreate */}
          {frame >= 660 && frame < 712 && (
            <>
              <IsolatedViralCardWithRecreate
                relFrame={frame - 660}
                headerTitle="VIRAL SLIDESHOW"
                viewsLabel="4.6M Views"
                nicheLabel="6-Slide Viral Listicle Format"
                accentColor="#D4FF00"
                hoverRelFrame={18}
                clickRelFrame={32}
                mediaNode={
                  <Img
                    src={sourceSlides[0]}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                }
              />
              <CursorActor
                x={interpolate(frame, [664, 686], [-150, 385], CLAMP)}
                y={interpolate(frame, [664, 686], [-90, 345], CLAMP)}
                clickFrame={692}
              />
            </>
          )}

          {/* STEP 5C (Frames 712–780): Recreated 6-Slide Carousel (`slideshow-result-0..5.png`) */}
          {frame >= 712 && (
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: 1800,
                  height: 540,
                  marginTop: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {resultSlides.map((slideSrc, idx) => {
                  const fanSpr = spring({
                    frame: Math.max(0, frame - 712 - idx * 1.5),
                    fps,
                    config: { damping: 13, mass: 0.42, stiffness: 280 },
                  });
                  const targetX = [-730, -438, -146, 146, 438, 730][idx];
                  const targetY = [18, 4, -8, -8, 4, 18][idx];
                  const targetRot = [-3.2, -1.8, -0.6, 0.6, 1.8, 3.2][idx];

                  return (
                    <div
                      key={idx}
                      style={{
                        position: "absolute",
                        width: 268,
                        height: 468,
                        borderRadius: 22,
                        overflow: "hidden",
                        border: "2.5px solid #D4FF00",
                        boxShadow:
                          "0 28px 65px rgba(0,0,0,0.92), 0 0 32px rgba(212,255,0,0.28)",
                        transform: `translate3d(${targetX * fanSpr}px, ${targetY * fanSpr}px, 0) rotate(${targetRot * fanSpr}deg)`,
                      }}
                    >
                      <Img
                        src={slideSrc}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: 12,
                          left: 12,
                          padding: "4px 12px",
                          borderRadius: 999,
                          backgroundColor: "#D4FF00",
                          color: "#03040A",
                          fontFamily: DISPLAY_FONT,
                          fontWeight: 900,
                          fontSize: 13,
                        }}
                      >
                        SLIDE 0{idx + 1}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 22 }}>
                <StackedKineticTypography
                  startFrame={716}
                  blocks={[
                    {
                      text: "6 RECREATED SLIDES • READY TO POST",
                      bgColor: "#D4FF00",
                      textColor: "#03040A",
                      rotation: -1.2,
                      fontSize: 54,
                      paddingX: 36,
                      paddingY: 12,
                    },
                  ]}
                />
              </div>
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* SCENE 6 (Frames 780–900): VIEWS TRACTION EXPLOSION + VIDMAKE FINALE */}
      {/* =================================================================== */}
      {frame >= 780 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {frame < 840 &&
            (() => {
              const rel = frame - 780;
              const chartProg = interpolate(rel, [0, 42], [0, 1], CLAMP);
              const viewsCount = Math.round(
                interpolate(
                  Math.pow(chartProg, 1.7),
                  [0, 1],
                  [12400, 2840000]
                )
              );

              return (
                <div
                  style={{
                    width: 1460,
                    padding: "44px 56px",
                    borderRadius: 36,
                    backgroundColor: "rgba(8, 11, 20, 0.9)",
                    border: "2px solid rgba(0, 240, 255, 0.5)",
                    boxShadow:
                      "0 44px 110px rgba(0, 0, 0, 0.95), 0 0 70px rgba(0, 240, 255, 0.28)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 48,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 18,
                    }}
                  >
                    <div style={{ display: "flex", gap: 12 }}>
                      {["✓ HOOK VIDEO", "✓ TALKING HEAD", "✓ SLIDESHOW"].map(
                        (pill, i) => (
                          <span
                            key={pill}
                            style={{
                              padding: "6px 16px",
                              borderRadius: 999,
                              backgroundColor:
                                i === 0
                                  ? "#FF176B"
                                  : i === 1
                                    ? "#00F0FF"
                                    : "#D4FF00",
                              color: i === 0 ? "#FFFFFF" : "#03040A",
                              fontFamily: DISPLAY_FONT,
                              fontWeight: 900,
                              fontSize: 15,
                            }}
                          >
                            {pill}
                          </span>
                        )
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontWeight: 900,
                        fontSize: 104,
                        lineHeight: 0.9,
                        letterSpacing: "-0.04em",
                        color: "#FFFFFF",
                        fontVariantNumeric: "tabular-nums",
                        textShadow: "0 0 40px rgba(0, 240, 255, 0.65)",
                      }}
                    >
                      {viewsCount.toLocaleString()}+
                    </div>
                    <div
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontWeight: 900,
                        fontSize: 38,
                        color: "#00F0FF",
                        letterSpacing: "-0.02em",
                        textTransform: "uppercase",
                      }}
                    >
                      ORGANIC VIEWS GENERATED • +640% TRACTION
                    </div>
                  </div>

                  <div
                    style={{
                      width: 560,
                      height: 300,
                      position: "relative",
                    }}
                  >
                    <svg width="560" height="300" viewBox="0 0 560 300">
                      <defs>
                        <linearGradient
                          id="tractionGrad"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#FF176B" />
                          <stop offset="55%" stopColor="#00F0FF" />
                          <stop offset="100%" stopColor="#D4FF00" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 20 260 C 140 250, 220 210, 310 150 C 390 95, 460 45, 535 24"
                        fill="none"
                        stroke="url(#tractionGrad)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray="750"
                        strokeDashoffset={750 * (1 - chartProg)}
                        style={{
                          filter: "drop-shadow(0 0 18px rgba(0, 240, 255, 0.85))",
                        }}
                      />
                    </svg>
                  </div>
                </div>
              );
            })()}

          {frame >= 840 && (
            <>
              <FourPointShootingStar
                startFrame={840}
                durationFrames={18}
                fromX={-780}
                fromY={240}
                toX={0}
                toY={-110}
                color="#00F0FF"
                size={58}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                  }}
                >
                  <div
                    style={{
                      width: 112,
                      height: 112,
                      borderRadius: 28,
                      border: "2.5px solid #00F0FF",
                      boxShadow:
                        "0 0 50px rgba(0, 240, 255, 0.6), 0 20px 50px rgba(0,0,0,0.9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(10, 14, 26, 0.9)",
                    }}
                  >
                    <Img
                      src={logoSrc}
                      style={{
                        width: "76%",
                        height: "76%",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: DISPLAY_FONT,
                      fontWeight: 900,
                      fontSize: 112,
                      letterSpacing: "-0.04em",
                      color: "#FFFFFF",
                      textShadow: "0 0 42px rgba(0, 240, 255, 0.55)",
                    }}
                  >
                    vidmake.io
                  </span>
                </div>

                <StackedKineticTypography
                  startFrame={844}
                  blocks={[
                    {
                      text: "HOOK VIDEOS • TALKING HEAD • SLIDESHOWS",
                      bgColor: "#FF176B",
                      textColor: "#FFFFFF",
                      rotation: -1.4,
                      fontSize: 48,
                      paddingX: 34,
                      paddingY: 12,
                      delayFrames: 0,
                    },
                    {
                      text: "✦ RECREATE ANY VIRAL FORMAT NOW → VIDMAKE.IO",
                      bgColor: "#FFFFFF",
                      textColor: "#03040A",
                      rotation: 1.1,
                      fontSize: 42,
                      paddingX: 34,
                      paddingY: 12,
                      delayFrames: 4,
                      accentDotColor: "#00F0FF",
                    },
                  ]}
                />
              </div>
            </>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
