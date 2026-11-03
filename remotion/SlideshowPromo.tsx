import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CursorActor } from "./effects/CursorActor";

export const SLIDESHOW_PROMO_FRAMES = 210; // 7.00s @ 30 FPS — Zero Waiting Gaps

const CARD_W = 286;
const CARD_H = 484;

// Compact Fanned Arc (initial fan-out & brief gather during loading recharge before pushing up & widening)
const COMPACT_X = [-510, -306, -102, 102, 306, 510];
const COMPACT_Y = [56, 26, 8, 8, 26, 56];
const COMPACT_ROT = [-11, -6.6, -2.2, 2.2, 6.6, 11];

// Pushed-Up & Widened Showcase Spread (306px step across 1920px canvas -> zero card overlap!)
const WIDE_X = [-765, -459, -153, 153, 459, 765];
const WIDE_Y = [-24, -40, -50, -50, -40, -24];
const WIDE_ROT = [-2.4, -1.4, -0.5, 0.5, 1.4, 2.4];

// Twelve small droplets released once from the raised Regenerate action.
const SPLASH_DROPLETS = [
  { angleDeg: -172, travel: 68, size: 11, color: "#FFFFFF" },
  { angleDeg: -148, travel: 76, size: 13, color: "#FF2A7A" },
  { angleDeg: -122, travel: 64, size: 10, color: "#FF4D94" },
  { angleDeg: -90, travel: 58, size: 11, color: "#FFFFFF" },
  { angleDeg: -58, travel: 66, size: 12, color: "#FF1E6E" },
  { angleDeg: -32, travel: 78, size: 13, color: "#FFFFFF" },
  { angleDeg: -8, travel: 70, size: 11, color: "#FF4D94" },
  { angleDeg: 18, travel: 72, size: 12, color: "#FFFFFF" },
  { angleDeg: 45, travel: 64, size: 10, color: "#FF2A7A" },
  { angleDeg: 90, travel: 54, size: 9, color: "#FF4D94" },
  { angleDeg: 135, travel: 66, size: 11, color: "#FF1E6E" },
  { angleDeg: 162, travel: 74, size: 12, color: "#FFFFFF" },
];

/**
 * KineticHeader renders the clean, pill-free top-left kinetic step typography
 * that narrates each stage of the Slideshow regeneration workflow using a crisp
 * Pure White (#FFFFFF) + Hot Neon Crimson (#FF2A7A) palette with zero green/teal.
 */
const KineticHeader: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  if (frame >= 152) return null;

  let activeStep = 0;
  let stepStartFrame = 0;
  let primaryText = "SLIDESHOWS";
  let accentText = "SOURCE SLIDES (6)";

  if (frame >= 46 && frame < 92) {
    activeStep = 1;
    stepStartFrame = 46;
    primaryText = "CLICK REGENERATE";
    accentText = frame >= 68 ? "LOADING NEW SLIDES..." : "1-CLICK RECREATE";
  } else if (frame >= 92) {
    activeStep = 2;
    stepStartFrame = 92;
    primaryText = "UPDATED SLIDESHOW";
    accentText = "6 NEW SLIDES READY";
  }

  const relFrame = frame - stepStartFrame;
  const enterSpr = spring({
    frame: relFrame,
    fps,
    config: { damping: 14, mass: 0.45, stiffness: 280 },
  });

  const translateY = interpolate(enterSpr, [0, 1], [18, 0]);
  const opacity = interpolate(relFrame, [0, 3], [0.25, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      key={activeStep}
      style={{
        position: "absolute",
        top: 38,
        left: 52,
        zIndex: 55,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        opacity,
        transform: `translate3d(0, ${translateY}px, 0)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily:
            "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
          fontWeight: 900,
          fontSize: 48,
          lineHeight: 0.94,
          letterSpacing: "-0.035em",
          color: "#FFFFFF",
          textTransform: "uppercase",
          textShadow: "0 10px 28px rgba(0, 0, 0, 0.94)",
        }}
      >
        {primaryText}
      </div>
      <div
        style={{
          fontFamily:
            "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
          fontWeight: 900,
          fontSize: 48,
          lineHeight: 0.94,
          letterSpacing: "-0.035em",
          color: "#FF2A7A",
          textTransform: "uppercase",
          textShadow:
            "0 10px 28px rgba(0, 0, 0, 0.94), 0 0 28px rgba(255, 23, 107, 0.45)",
        }}
      >
        {accentText}
      </div>
    </div>
  );
};

/** Three-layer pushable action, adapted from the supplied Button82 style. */
const RegenerateActionButton: React.FC<{
  frame: number;
  fps: number;
  enterFrame: number;
  hoverStartFrame: number;
  clickFrame: number;
  loadingDoneFrame: number;
  exitFrame: number;
}> = ({ frame, fps, enterFrame, hoverStartFrame, clickFrame, loadingDoneFrame, exitFrame }) => {
  if (frame < enterFrame || frame > exitFrame + 10) return null;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 13, mass: 0.45, stiffness: 260 } });
  const exit = interpolate(frame, [exitFrame, exitFrame + 9], [0, 1], clamp);
  const hover = interpolate(frame, [hoverStartFrame, hoverStartFrame + 5], [0, 1], clamp);
  const clicked = frame >= clickFrame;
  const completed = frame >= loadingDoneFrame;
  const age = frame - clickFrame;
  const frontY = clicked
    ? interpolate(age, [0, 2, 6, 12], [-16, -4, -18, -10], clamp)
    : interpolate(hover, [0, 1], [-10, -16]);
  const shadowY = clicked
    ? interpolate(age, [0, 2, 6, 12], [8, 2, 9, 4], clamp)
    : interpolate(hover, [0, 1], [4, 8]);
  const splashAge = age - 2;
  const splash = interpolate(splashAge, [0, 12], [0, 1], clamp);
  const splashOpacity = splashAge > 0 && splashAge < 12
    ? interpolate(splashAge, [0, 2, 12], [0, 1, 0], clamp) : 0;
  const state = completed ? "complete" : clicked ? age <= 2 ? "pressed" : splashOpacity > 0 ? "splash" : "working" : hover > 0 ? "hover" : "ready";
  const iconSpin = clicked ? interpolate(age, [0, 12], [0, -360], clamp) : hover * -18;

  return <div data-regenerate-state={state} style={{
    position: "absolute", left: "50%", top: "50%", width: 472, height: 100,
    transform: `translate3d(-50%, calc(-50% + ${346 + interpolate(enter, [0, 1], [48, 0]) + exit * 36}px), 0) scale(${interpolate(enter, [0, 1], [0.72, 1]) * (1 - exit * 0.18)})`,
    opacity: interpolate(frame, [enterFrame, enterFrame + 5], [0, 1], clamp) * (1 - exit),
    zIndex: 48, pointerEvents: "none",
  }}>
    <div data-pushable-layer="shadow" data-shadow-y={shadowY} style={{
      position: "absolute", inset: 0, borderRadius: 22, background: "rgba(0,0,0,0.32)",
      transform: `translateY(${shadowY}px)`, filter: "blur(6px)",
    }} />
    <div data-pushable-layer="edge" style={{
      position: "absolute", inset: 0, borderRadius: 22,
      background: "linear-gradient(to left, hsl(340deg 100% 16%) 0%, hsl(340deg 100% 32%) 8%, hsl(340deg 100% 32%) 92%, hsl(340deg 100% 16%) 100%)",
    }} />
    <div data-pushable-layer="front" data-front-y={frontY} style={{
      position: "relative", width: "100%", height: "100%", borderRadius: 22,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 18,
      background: "hsl(345deg 100% 47%)", color: "#FFFFFF",
      transform: `translateY(${frontY}px)`, filter: `brightness(${!clicked ? 1 + hover * 0.1 : 1})`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24)",
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: `rotate(${completed ? 0 : iconSpin}deg)` }}>
        {completed ? <path d="M5 12L10 17L20 7" /> : <>
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </>}
      </svg>
      <span data-regenerate-label style={{
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", fontSize: 34,
        fontWeight: 900, letterSpacing: "-0.025em", whiteSpace: "nowrap", lineHeight: 1,
      }}>{completed ? "6 Slides Ready" : clicked && age >= 3 ? "Regenerating…" : "Regenerate"}</span>
    </div>
    {splashOpacity > 0.01 && <div data-regenerate-splash style={{
      position: "absolute", left: "50%", top: "50%", width: 0, height: 0, zIndex: 10,
    }}>
      {SPLASH_DROPLETS.map((drop, i) => {
        const angle = drop.angleDeg * Math.PI / 180;
        const ease = 1 - Math.pow(1 - splash, 2.2);
        const x = Math.cos(angle) * (236 + drop.travel * 0.65 * ease);
        const y = Math.sin(angle) * (50 + drop.travel * 0.5 * ease);
        const scale = interpolate(splash, [0, 0.25, 1], [0.5, 1.15, 0.2]);
        return <span key={i} data-splash-droplet={i} style={{
          position: "absolute", width: drop.size * 1.7, height: drop.size, borderRadius: 999,
          background: drop.color, opacity: splashOpacity, boxShadow: `0 0 5px ${drop.color}`,
          transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${drop.angleDeg}deg) scale(${scale})`,
        }} />;
      })}
    </div>}
  </div>;
};

/**
 * SlideshowHeroFinale renders the Higgsfield Content Factory "WHAT IF" Cylindrical
 * Concave Neon-Rim Display Banner (`media_1793643069361_9ef549d4.png`) in Act 4 (Frames 200-269).
 */
const HERO_LETTERS = "SLIDESHOWS".split("");

const SlideshowHeroFinale: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rel = Math.max(0, frame - startFrame);

  const bannerSpr = spring({
    frame: rel,
    fps,
    config: { damping: 13, mass: 0.42, stiffness: 340 },
  });

  const bannerScale = interpolate(bannerSpr, [0, 0.65, 1], [0.78, 1.04, 1.0]);
  const bannerOpacity = interpolate(rel, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const metaRel = Math.max(0, rel - 7);
  const metaSpr = spring({
    frame: metaRel,
    fps,
    config: { damping: 15, mass: 0.4, stiffness: 320 },
  });
  const metaOpacity = interpolate(metaRel, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const metaLift = interpolate(metaSpr, [0, 1], [14, 0]);

  return (
    <div
      style={{
        position: "relative",
        width: 1760,
        height: 520,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 65,
        opacity: bannerOpacity,
        transform: `scale(${bannerScale})`,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Ambient Hot-Crimson Neon Backlight Halo behind the curved letters */}
      <div
        style={{
          position: "absolute",
          width: 1460,
          height: 310,
          borderRadius: 999,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255, 23, 107, 0.42) 0%, rgba(225, 29, 72, 0.22) 45%, rgba(7, 8, 12, 0) 75%)",
          filter: "blur(18px)",
          pointerEvents: "none",
        }}
      />

      {/* CYLINDRICAL CONCAVE NEON-RIM DISPLAY WORD ("WHAT IF" / HIGGSFIELD CONTENT FACTORY STYLE) */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1100,
          transformStyle: "preserve-3d",
          gap: 2,
          zIndex: 25,
        }}
      >
        {HERO_LETTERS.map((ch, idx) => {
          const u =
            (idx - (HERO_LETTERS.length - 1) / 2) /
            ((HERO_LETTERS.length - 1) / 2);
          const u2 = u * u;

          const distFromCenter = Math.abs(u);
          const charDelay = distFromCenter * 4.5;
          const charSpr = spring({
            frame: Math.max(0, rel - charDelay),
            fps,
            config: { damping: 12, mass: 0.36, stiffness: 380 },
          });

          // Concave cylindrical warp ("WHAT IF" silhouette):
          const targetScaleY = 0.86 + 0.52 * u2;
          const targetScaleX = 0.98 + 0.08 * u2;
          const charScaleY = interpolate(charSpr, [0, 1], [0.45, targetScaleY]);
          const charScaleX = interpolate(charSpr, [0, 1], [0.75, targetScaleX]);

          const rotateY = -u * 26 * interpolate(charSpr, [0, 1], [1.6, 1]);
          const skewY = u * 4.2;
          const translateZ = u2 * 44;
          const enterY = interpolate(charSpr, [0, 1], [36, 0]);

          return (
            <span
              key={idx}
              style={{
                position: "relative",
                display: "inline-block",
                fontFamily:
                  "'Impact', 'Haettenschweiler', 'Arial Black', 'Clash Display', Inter, sans-serif",
                fontWeight: 900,
                fontSize: 184,
                lineHeight: 0.88,
                letterSpacing: "-0.015em",
                textTransform: "uppercase",
                backgroundImage:
                  "linear-gradient(180deg, #FF4D94 0%, #880E4F 19%, #1A040E 48%, #1A040E 54%, #9B0F53 82%, #FF4D94 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextStroke: "5px #FF1E6E",
                paintOrder: "stroke fill",
                filter:
                  "drop-shadow(0 0 10px rgba(255, 30, 110, 0.95)) drop-shadow(0 0 28px rgba(255, 20, 100, 0.72)) drop-shadow(0 18px 32px rgba(0, 0, 0, 0.96))",
                transform: `translate3d(0, ${enterY}px, ${translateZ}px) rotateY(${rotateY}deg) skewY(${skewY}deg) scale(${charScaleX}, ${charScaleY})`,
                transformOrigin: "center center",
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>

      {/* COMPACT EDITORIAL SPEC LINE BELOW THE CURVED BANNER (Unboxed, zero pill/box container) */}
      <div
        style={{
          marginTop: 28,
          opacity: metaOpacity,
          transform: `translate3d(0, ${metaLift}px, 0)`,
          display: "flex",
          alignItems: "center",
          gap: 18,
          zIndex: 28,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: "0.22em",
            color: "#FFFFFF",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            WebkitTextStroke: "5px #07080C",
            paintOrder: "stroke fill",
            textShadow:
              "0 4px 14px rgba(0, 0, 0, 0.98), 0 0 22px rgba(255, 30, 110, 0.55)",
          }}
        >
          1-CLICK REGENERATE
        </span>
        <span
          style={{
            color: "#FF1E6E",
            fontWeight: 900,
            fontSize: 28,
            textShadow: "0 0 18px #FF1E6E, 0 4px 12px rgba(0, 0, 0, 0.98)",
          }}
        >
          •
        </span>
        <span
          style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: "0.22em",
            color: "#FF4D94",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            WebkitTextStroke: "5px #07080C",
            paintOrder: "stroke fill",
            textShadow:
              "0 4px 14px rgba(0, 0, 0, 0.98), 0 0 24px rgba(255, 30, 110, 0.65)",
          }}
        >
          NEW SLIDES & COPY
        </span>
      </div>
    </div>
  );
};

export const SlideshowPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Authentic V6 Slideshow Assets from design/explore-hook-motion/Media/v6/ss/{sourcegeneration,ouput generation}
  const sourceSlides = [0, 1, 2, 3, 4, 5].map((i) =>
    staticFile(`explore/covers/sources/slideshow-source-${i}.jpg`)
  );
  const resultSlides = [0, 1, 2, 3, 4, 5].map((i) =>
    staticFile(`explore/covers/sources/slideshow-result-${i}.png`)
  );

  // =========================================================================
  // KEY CHOREOGRAPHY TIMESTAMPS (30 FPS, 210 Frames = 7.00s — Zero Waiting Gaps)
  // =========================================================================
  const buttonEnterFrame = 46;
  const cursorEnterFrame = 50;
  const hoverStartFrame = 60;
  const clickFrame = 68;
  const loadingDoneFrame = 92;
  const buttonExitFrame = 100;
  const heroStartFrame = 152;

  // =========================================================================
  // SIMULTANEOUS "PUSH UP & WIDEN" SPREAD CHOREOGRAPHY (NO ONE-BY-ONE HOPPING)
  // =========================================================================
  // 1. Source Slideshow Push-Up & Widen (Frames 10-70):
  //    All 6 source cards push up (WIDE_Y) and widen out (WIDE_X = -765..+765)
  //    so all 6 source slides get full room to show up with zero overlap.
  // 2. Loading Gather (Frames 70-90):
  //    After the Regenerate press and brief splash, the deck
  //    briefly gathers toward the compact arc (widenProgress -> 0.14) to coil up.
  // 3. Regenerated Slideshow Push-Up & Widen (Frames 92-152):
  //    As the 6 cards flip to the regenerated slides, they push up and widen out
  //    together (widenProgress -> 1.0) across the full 1920px stage!
  const act1WidenSpr = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 14, mass: 0.46, stiffness: 210 },
  });

  const loadingGatherProgress =
    frame >= clickFrame + 2
      ? interpolate(
          frame,
          [clickFrame + 2, loadingDoneFrame - 2],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }
        )
      : 0;

  const act3WidenSpr =
    frame >= loadingDoneFrame
      ? spring({
          frame: frame - loadingDoneFrame,
          fps,
          config: { damping: 13, mass: 0.46, stiffness: 195 },
        })
      : 0;

  let widenProgress = act1WidenSpr;
  if (frame >= clickFrame + 2 && frame < loadingDoneFrame) {
    const easedGather =
      loadingGatherProgress < 0.5
        ? 2 * loadingGatherProgress * loadingGatherProgress
        : 1 - Math.pow(-2 * loadingGatherProgress + 2, 2) / 2;
    widenProgress = interpolate(easedGather, [0, 1], [1, 0.14]);
  } else if (frame >= loadingDoneFrame) {
    widenProgress = interpolate(act3WidenSpr, [0, 1], [0.14, 1]);
  }

  // =========================================================================
  // CURSOR TRAJECTORY (Glides in at Frame 76 -> Clicks Regenerate at Frame 96 -> Exits)
  // =========================================================================
  let cursorX = 520;
  let cursorY = 480;
  let cursorOpacity = 0;
  let activeClickFrame: number | undefined = undefined;

  if (frame >= cursorEnterFrame && frame <= buttonExitFrame) {
    activeClickFrame = clickFrame;
    if (frame <= clickFrame + 6) {
      const moveProgress = interpolate(
        frame,
        [cursorEnterFrame, hoverStartFrame + 4],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      const eased = 1 - Math.pow(1 - moveProgress, 3);
      cursorX = interpolate(eased, [0, 1], [460, 28]);
      cursorY = interpolate(eased, [0, 1], [470, 356]);
      cursorOpacity = interpolate(
        frame,
        [cursorEnterFrame, cursorEnterFrame + 5],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
    } else {
      const exitProg = interpolate(
        frame,
        [clickFrame + 7, clickFrame + 24],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      const easedExit = 1 - Math.pow(1 - exitProg, 2.2);
      cursorX = interpolate(easedExit, [0, 1], [28, 390]);
      cursorY = interpolate(easedExit, [0, 1], [356, 468]);
      cursorOpacity = interpolate(
        frame,
        [clickFrame + 11, clickFrame + 22],
        [1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
    }
  }

  // Global camera punch on click and on regeneration completion
  const clickCameraPulse =
    frame >= clickFrame && frame < clickFrame + 12
      ? interpolate(frame - clickFrame, [0, 3, 12], [1, 1.016, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : frame >= loadingDoneFrame && frame < loadingDoneFrame + 14
        ? interpolate(frame - loadingDoneFrame, [0, 4, 14], [1, 1.018, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#07080C",
        overflow: "hidden",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 0. PURE NEUTRAL OBSIDIAN STUDIO BACKDROP (Zero Green/Teal Tint) */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(255, 255, 255, 0.048) 0%, rgba(11, 14, 22, 0.96) 62%, #06070B 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          opacity: 0.5,
        }}
      />

      {/* 1. TOP-LEFT KINETIC STEP HEADER */}
      <KineticHeader frame={frame} fps={fps} />

      {/* 2. MAIN 1920x1080 STAGE */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${clickCameraPulse})`,
        }}
      >
        {/* 2A. 6-CARD SIMULTANEOUS PUSH-UP & WIDEN DECK */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          // Entrance fan-out from stacked center deck (Frames 0-14)
          const fanSpr = spring({
            frame: Math.max(0, frame - i * 1.3),
            fps,
            config: { damping: 14, mass: 0.46, stiffness: 225 },
          });

          const stackedX = (i - 2.5) * 12;
          const stackedY = -i * 7;
          const stackedRot = (i - 2.5) * 1.4;

          // Interpolate between Compact Fan (widenProgress = 0) and Wide Pushed-Up Spread (widenProgress = 1)
          const targetX = interpolate(
            widenProgress,
            [0, 1],
            [COMPACT_X[i], WIDE_X[i]]
          );
          const targetY = interpolate(
            widenProgress,
            [0, 1],
            [COMPACT_Y[i], WIDE_Y[i]]
          );
          const targetRot = interpolate(
            widenProgress,
            [0, 1],
            [COMPACT_ROT[i], WIDE_ROT[i]]
          );

          // Hero Finale gentle vertical settle (Frames 200-269)
          const heroSpr =
            frame >= heroStartFrame
              ? spring({
                  frame: frame - heroStartFrame,
                  fps,
                  config: { damping: 14, mass: 0.45, stiffness: 280 },
                })
              : 0;

          const heroDropY = interpolate(heroSpr, [0, 1], [0, 22]);

          // Subtle floating breathe while cards are widened out
          const floatOffsetY =
            Math.sin((frame + i * 9) * 0.08) * 3.5 * widenProgress;

          const baseX = interpolate(fanSpr, [0, 1], [stackedX, targetX]);
          const baseY =
            interpolate(fanSpr, [0, 1], [stackedY, targetY]) +
            floatOffsetY +
            heroDropY;
          const baseRot = interpolate(fanSpr, [0, 1], [stackedRot, targetRot]);

          // Synchronized 3D Card Flip Wave on Loading Completion (Frames 90 + i*1.8, completes by Frame 111)
          const flipStart = loadingDoneFrame - 2 + i * 1.8;
          const flipDuration = 12;
          const flipProg = interpolate(
            frame,
            [flipStart, flipStart + flipDuration],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );
          const easedFlip =
            flipProg < 0.5
              ? 2 * flipProg * flipProg
              : 1 - Math.pow(-2 * flipProg + 2, 2) / 2;

          // 3D Y-axis rotation: 0 -> 90 (swap image) -> 0
          const flipRotateY =
            easedFlip <= 0.5
              ? interpolate(easedFlip, [0, 0.5], [0, 90])
              : interpolate(easedFlip, [0.5, 1], [-90, 0]);

          const isShowingUpdated = easedFlip > 0.5;
          const flipLiftY = Math.sin(easedFlip * Math.PI) * -42;
          const flipScalePop = 1 + Math.sin(easedFlip * Math.PI) * 0.08;
          const isMidFlip = flipProg > 0.06 && flipProg < 0.94;

          // Simultaneous scale-up when pushed up & widened (all 6 cards get equal prominence!)
          const cardScale =
            interpolate(widenProgress, [0, 1], [0.94, 1.03]) *
            flipScalePop *
            interpolate(heroSpr, [0, 1], [1, 0.96]);

          const cardZIndex = 10 + i + (isMidFlip ? 35 : 0);

          const activeImgSrc = isShowingUpdated
            ? resultSlides[i]
            : sourceSlides[i];

          const isWideActive = widenProgress > 0.68 || isMidFlip;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: CARD_W,
                height: CARD_H,
                borderRadius: 22,
                overflow: "hidden",
                backgroundColor: "#0D1017",
                transform: `translate3d(${baseX}px, ${baseY + flipLiftY}px, 0) perspective(1400px) rotateZ(${baseRot}deg) rotateY(${flipRotateY}deg) scale(${cardScale})`,
                transformOrigin: "center center",
                border: isMidFlip
                  ? "3.5px solid #FFFFFF"
                  : isWideActive
                    ? "2.5px solid rgba(255, 255, 255, 0.92)"
                    : "2px solid rgba(255, 255, 255, 0.38)",
                boxShadow: isMidFlip
                  ? "0 36px 84px rgba(0, 0, 0, 0.96), 0 0 38px rgba(255, 255, 255, 0.35)"
                  : isWideActive
                    ? "0 30px 68px rgba(0, 0, 0, 0.92), 0 0 22px rgba(255, 255, 255, 0.1)"
                    : "-12px 20px 44px rgba(0, 0, 0, 0.85), 0 12px 28px rgba(0, 0, 0, 0.65)",
                zIndex: cardZIndex,
              }}
            >
              <Img
                src={activeImgSrc}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: isWideActive
                    ? "brightness(1.02) contrast(1.02)"
                    : "brightness(0.92)",
                }}
              />

              {/* Top Specular Rim Highlight (Neutral White, Zero Color Cast) */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 20,
                  boxShadow: "inset 0 2px 0 rgba(255, 255, 255, 0.35)",
                  pointerEvents: "none",
                }}
              />

              {/* Clean Neutral White Specular Flash During 3D Flip */}
              {isMidFlip && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.44) 0%, rgba(255, 255, 255, 0.14) 50%, transparent 100%)",
                    opacity: Math.sin(easedFlip * Math.PI) * 0.88,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          );
        })}

        {/* 3. RAISED REGENERATE ACTION: PRESS, BRIEF SPLASH, THEN GENERATED SLIDES */}
        <RegenerateActionButton
          frame={frame}
          fps={fps}
          enterFrame={buttonEnterFrame}
          hoverStartFrame={hoverStartFrame}
          clickFrame={clickFrame}
          loadingDoneFrame={loadingDoneFrame}
          exitFrame={buttonExitFrame}
        />

        {/* 4. UNBOXED 3D FOREGROUND HERO FINALE (Act 4: Frames 200-269) */}
        {frame >= heroStartFrame && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 60,
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 1460,
                height: 640,
                background:
                  "radial-gradient(ellipse closest-side, rgba(7,8,14,0.8) 0%, rgba(7,8,14,0.4) 58%, rgba(7,8,14,0) 100%)",
                pointerEvents: "none",
              }}
            />
            <SlideshowHeroFinale startFrame={heroStartFrame} />
          </div>
        )}

        {/* 5. STUDIO CURSOR ACTOR (Clicks Regenerate at Frame 96) */}
        <CursorActor
          x={cursorX}
          y={cursorY}
          opacity={cursorOpacity}
          isGrabbing={frame >= clickFrame && frame <= clickFrame + 6}
          clickFrame={activeClickFrame}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
