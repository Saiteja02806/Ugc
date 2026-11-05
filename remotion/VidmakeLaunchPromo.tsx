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
      {/* LIVING SOLAR HORIZON & DARK STUDIO STAGE (`Arcjet` + `solor light`) */}
      {/* =================================================================== */}
      <AbsoluteFill style={{ opacity: 0.48 }}>
        <OffthreadVideo
          src={solarBgSrc}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "hue-rotate(15deg) saturate(1.35) contrast(1.15)",
          }}
        />
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: "-15%",
          right: "-15%",
          bottom: -240,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(0, 240, 255, 0.42) 0%, rgba(99, 102, 241, 0.34) 38%, rgba(255, 23, 107, 0.22) 64%, transparent 80%)",
          filter: "blur(38px)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          opacity: 0.45,
          pointerEvents: "none",
        }}
      />

      {/* =================================================================== */}
      {/* SCENE 1 (Frames 0–105): LOGO + VIDMAKE HIGH-ATTENTION INTRO         */}
      {/* =================================================================== */}
      {frame < 105 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FourPointShootingStar
            startFrame={0}
            durationFrames={18}
            fromX={-820}
            fromY={320}
            toX={0}
            toY={-40}
            color="#00F0FF"
            size={56}
          />

          {(() => {
            const logoSpr = spring({
              frame: Math.max(0, frame - 8),
              fps,
              config: { damping: 10, mass: 0.42, stiffness: 310 },
            });
            const logoScale = interpolate(logoSpr, [0, 0.65, 1], [0.2, 1.14, 1]);
            const logoRotY = interpolate(logoSpr, [0, 1], [-45, 0]);
            const ringScale = interpolate(frame, [10, 48], [0.4, 2.4], CLAMP);
            const ringOpacity = interpolate(
              frame,
              [10, 22, 48],
              [0, 0.85, 0],
              CLAMP
            );
            const liftY =
              frame >= 54
                ? interpolate(
                    spring({
                      frame: frame - 54,
                      fps,
                      config: { damping: 13, mass: 0.4, stiffness: 280 },
                    }),
                    [0, 1],
                    [0, -110]
                  )
                : 0;

            return (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  transform: `translate3d(0, ${liftY}px, 0)`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    width: 240,
                    height: 240,
                    borderRadius: "50%",
                    border: "4px solid #00F0FF",
                    boxShadow:
                      "0 0 48px #00F0FF, inset 0 0 36px rgba(255, 23, 107, 0.8)",
                    transform: `scale(${ringScale})`,
                    opacity: ringOpacity,
                  }}
                />

                <div style={{ marginBottom: 22 }}>
                  <OpticalBloomText
                    startFrame={12}
                    staggerFrames={3}
                    fontSize={92}
                    words={[{ text: "VIDMAKE", accent: "white" }]}
                  />
                </div>

                <div
                  style={{
                    position: "relative",
                    width: 176,
                    height: 176,
                    borderRadius: 44,
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(15,23,42,0.88) 100%)",
                    border: "2.5px solid rgba(0, 240, 255, 0.78)",
                    boxShadow:
                      "0 30px 80px rgba(0, 0, 0, 0.95), 0 0 65px rgba(0, 240, 255, 0.55), 0 0 95px rgba(255, 23, 107, 0.38)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `perspective(1000px) rotateY(${logoRotY}deg) scale(${logoScale})`,
                    overflow: "hidden",
                  }}
                >
                  <Img
                    src={logoSrc}
                    style={{
                      width: "76%",
                      height: "76%",
                      objectFit: "contain",
                      filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.6))",
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {frame >= 54 && (
            <div style={{ position: "absolute", bottom: 130 }}>
              <StackedKineticTypography
                startFrame={54}
                blocks={[
                  {
                    text: "THE AI VIRAL CONTENT ENGINE",
                    bgColor: "#FF176B",
                    textColor: "#FFFFFF",
                    rotation: -1.8,
                    fontSize: 64,
                    paddingX: 34,
                    paddingY: 12,
                    delayFrames: 0,
                  },
                  {
                    text: "FOR SAAS ORGANIC MARKETING & UGC",
                    bgColor: "#FFFFFF",
                    textColor: "#03040A",
                    rotation: 1.4,
                    fontSize: 52,
                    paddingX: 32,
                    paddingY: 12,
                    delayFrames: 5,
                    accentDotColor: "#FF176B",
                  },
                ]}
              />
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* SCENE 2 (Frames 105–225): STORY TYPOGRAPHY WITH BIG EFFECT          */}
      {/* "Marketing is harder, But Not with Vidmake ✓" (Zero Edge Clipping!) */}
      {/* =================================================================== */}
      {frame >= 105 && frame < 225 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FourPointShootingStar
            startFrame={152}
            durationFrames={20}
            fromX={-760}
            fromY={40}
            toX={680}
            toY={-60}
            color="#FF176B"
            size={60}
          />

          {(() => {
            const rel = frame - 105;
            const revealRight = rel >= 48; // Frame 153
            // Starts centered on the left box (+390px), then slides smoothly to 0px so BOTH fit 100% inside 1920px!
            const panX = revealRight
              ? interpolate(
                  spring({
                    frame: rel - 48,
                    fps,
                    config: { damping: 12, mass: 0.42, stiffness: 320 },
                  }),
                  [0, 1],
                  [390, 0]
                )
              : 390;

            return (
              <div
                style={{
                  position: "relative",
                  width: 1720,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 44,
                  transform: `translate3d(${panX}px, 0, 0)`,
                }}
              >
                {/* Left Story Box: "Marketing was harder, But Not" */}
                <div
                  style={{
                    width: 820,
                    padding: "46px 48px",
                    borderRadius: 34,
                    backgroundColor: "rgba(10, 13, 24, 0.9)",
                    border: "2px solid rgba(255, 255, 255, 0.22)",
                    boxShadow: "0 38px 90px rgba(0, 0, 0, 0.92)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    flexShrink: 0,
                  }}
                >
                  <OpticalBloomText
                    startFrame={106}
                    staggerFrames={4}
                    fontSize={74}
                    words={[
                      { text: "MARKETING", accent: "white" },
                      { text: "WAS", accent: "white" },
                      { text: "HARDER,", accent: "magenta" },
                    ]}
                  />
                  {rel >= 26 && (
                    <OpticalBloomText
                      startFrame={131}
                      staggerFrames={4}
                      fontSize={74}
                      words={[
                        { text: "BUT", accent: "white" },
                        { text: "NOT", accent: "cyan" },
                      ]}
                    />
                  )}
                </div>

                {/* Right Breakout: "WITH VIDMAKE ✓" */}
                <div
                  style={{
                    width: 840,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 18,
                    opacity: revealRight ? 1 : 0,
                    flexShrink: 0,
                  }}
                >
                  {revealRight && (
                    <>
                      <OpticalBloomText
                        startFrame={154}
                        staggerFrames={4}
                        fontSize={98}
                        justify="flex-start"
                        words={[
                          { text: "WITH", accent: "white" },
                          {
                            text: "VIDMAKE",
                            accent: "cyan",
                            underline: true,
                          },
                        ]}
                      />
                      <div
                        style={{
                          marginTop: 18,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 26px",
                          borderRadius: 999,
                          backgroundColor: "rgba(0, 240, 255, 0.14)",
                          border: "2px solid #00F0FF",
                          boxShadow: "0 0 32px rgba(0, 240, 255, 0.45)",
                          fontFamily: DISPLAY_FONT,
                          fontWeight: 900,
                          fontSize: 22,
                          color: "#FFFFFF",
                          textTransform: "uppercase",
                        }}
                      >
                        <span style={{ color: "#00F0FF", fontSize: 26 }}>✓</span>
                        <span>CLONE ANY VIRAL FORMAT IN 1 CLICK</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* SCENE 3 (Frames 225–435): WORKFLOW 1 — HOOK VIDEO                   */}
      {/* Uses Exact Cover-Page Pair: hook-explore-video -> hook-recreated    */}
      {/* =================================================================== */}
      {frame >= 225 && frame < 435 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WorkflowTopBanner
            stepNum="01"
            workflowName="HOOK VIDEO"
            activeStage={frame < 285 ? 0 : frame < 350 ? 1 : 2}
            accentColor="#FF176B"
          />

          {/* STEP 3A (Frames 225–285): 4x2 Library Grid of 8 Viral Hooks */}
          {frame < 285 && (
            <>
              <ViralLibrary4x2Grid
                relFrame={frame - 225}
                thumbnails={hookLibThumbs}
                meta={HOOK_LIBRARY_META}
                selectedIndex={1}
                highlightRelFrame={32}
                accentColor="#FF176B"
                libraryTitle="VIRAL HOOK LIBRARY"
              />
              <CursorActor
                x={interpolate(frame, [235, 258], [480, -170], CLAMP)}
                y={interpolate(frame, [235, 258], [340, -120], CLAMP)}
                clickFrame={265}
              />
            </>
          )}

          {/* STEP 3B (Frames 285–350): Sudden Isolate 1 Viral Hook + Click Recreate */}
          {frame >= 285 && frame < 350 && (
            <>
              <IsolatedViralCardWithRecreate
                relFrame={frame - 285}
                headerTitle="VIRAL HOOK"
                viewsLabel="3.4M Views"
                nicheLabel="98% Hook Retention • Proven Format"
                accentColor="#FF176B"
                hoverRelFrame={24}
                clickRelFrame={37}
                mediaNode={
                  <OffthreadVideo
                    src={hookViralVideoSrc}
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                }
              />
              <LuminousMistEffect
                triggerFrame={324}
                durationFrames={26}
                centerX={0}
                centerY={0}
              />
              <CursorActor
                x={interpolate(frame, [290, 314], [-140, 385], CLAMP)}
                y={interpolate(frame, [290, 314], [-60, 345], CLAMP)}
                clickFrame={322}
              />
            </>
          )}

          {/* STEP 3C (Frames 350–435): Recreated Hook Video + Synced Product Demo */}
          {frame >= 350 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 48,
                marginTop: 48,
              }}
            >
              {/* Dual Card Lockup matching HookVideoPromo: Recreated Hook + Product Demo */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 350,
                    height: 620,
                    borderRadius: 28,
                    overflow: "hidden",
                    backgroundColor: "#070A14",
                    border: "3px solid #00F0FF",
                    boxShadow:
                      "0 36px 95px rgba(0, 0, 0, 0.95), 0 0 60px rgba(0, 240, 255, 0.45)",
                  }}
                >
                  <OffthreadVideo
                    src={hookRecreatedVideoSrc}
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <RecreatedHookTextOverlay />
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
                      textTransform: "uppercase",
                      boxShadow: "0 0 24px #00F0FF",
                      zIndex: 20,
                    }}
                  >
                    ✓ RECREATED HOOK
                  </div>
                </div>

                {/* Plus Symbol Connector */}
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
                  }}
                >
                  <Img
                    src={plusSymbolSrc}
                    style={{ width: 34, height: 34, objectFit: "contain" }}
                  />
                </div>

                {/* Synced SaaS Demo Video */}
                <div
                  style={{
                    position: "relative",
                    width: 350,
                    height: 620,
                    borderRadius: 28,
                    overflow: "hidden",
                    backgroundColor: "#070A14",
                    border: "3px solid #FF176B",
                    boxShadow:
                      "0 36px 95px rgba(0, 0, 0, 0.95), 0 0 55px rgba(255, 23, 107, 0.4)",
                  }}
                >
                  <OffthreadVideo
                    src={hookDemoVideoSrc}
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
                      textTransform: "uppercase",
                    }}
                  >
                    ✓ YOUR SAAS DEMO
                  </div>
                </div>
              </div>

              <StackedKineticTypography
                startFrame={354}
                blocks={[
                  {
                    text: "RECREATED",
                    bgColor: "#FF176B",
                    textColor: "#FFFFFF",
                    rotation: -2.2,
                    fontSize: 84,
                    delayFrames: 0,
                  },
                  {
                    text: "FOR YOUR BRAND",
                    bgColor: "#07080C",
                    textColor: "#00F0FF",
                    borderColor: "#00F0FF",
                    rotation: 1.4,
                    fontSize: 72,
                    delayFrames: 5,
                  },
                  {
                    text: "SAME VIRAL HOOK • YOUR CREATOR",
                    bgColor: "#FFFFFF",
                    textColor: "#03040A",
                    rotation: -1.1,
                    fontSize: 38,
                    delayFrames: 10,
                    accentDotColor: "#FF176B",
                  },
                ]}
              />
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* =================================================================== */}
      {/* SCENE 4 (Frames 435–615): WORKFLOW 2 — TALKING HEAD                 */}
      {/* Uses Exact Cover-Page Pair: talking-head-start -> talking-head-src  */}
      {/* =================================================================== */}
      {frame >= 435 && frame < 615 && (
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
