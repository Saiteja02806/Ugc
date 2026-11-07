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

/** Skewed Parallelogram CTA with Triple-Chevron Cascade & Hard Offset Shadow (adapted from user-supplied HTML/CSS concept). */
const PATH_ONE_D =
  "M40.1543933,3.89485454 L43.9763149,0.139296592 C44.1708311,-0.0518420739 44.4826329,-0.0518571125 44.6771675,0.139262789 L65.6916134,20.7848311 C66.0855801,21.1718824 66.0911863,21.8050225 65.704135,22.1989893 C65.7000188,22.2031791 65.6958657,22.2073326 65.6916762,22.2114492 L44.677098,42.8607841 C44.4825957,43.0519059 44.1708242,43.0519358 43.9762853,42.8608513 L40.1545186,39.1069479 C39.9575152,38.9134427 39.9546793,38.5968729 40.1481845,38.3998695 C40.1502893,38.3977268 40.1524132,38.395603 40.1545562,38.3934985 L56.9937789,21.8567812 C57.1908028,21.6632968 57.193672,21.3467273 57.0001876,21.1497035 C56.9980647,21.1475418 56.9959223,21.1453995 56.9937605,21.1432767 L40.1545208,4.60825197 C39.9574869,4.41477773 39.9546013,4.09820839 40.1480756,3.90117456 C40.1501626,3.89904911 40.1522686,3.89694235 40.1543933,3.89485454 Z";
const PATH_TWO_D =
  "M20.1543933,3.89485454 L23.9763149,0.139296592 C24.1708311,-0.0518420739 24.4826329,-0.0518571125 24.6771675,0.139262789 L45.6916134,20.7848311 C46.0855801,21.1718824 46.0911863,21.8050225 45.704135,22.1989893 C45.7000188,22.2031791 45.6958657,22.2073326 45.6916762,22.2114492 L24.677098,42.8607841 C24.4825957,43.0519059 24.1708242,43.0519358 23.9762853,42.8608513 L20.1545186,39.1069479 C19.9575152,38.9134427 19.9546793,38.5968729 20.1481845,38.3998695 C20.1502893,38.3977268 20.1524132,38.395603 20.1545562,38.3934985 L36.9937789,21.8567812 C37.1908028,21.6632968 37.193672,21.3467273 37.0001876,21.1497035 C36.9980647,21.1475418 36.9959223,21.1453995 36.9937605,21.1432767 L20.1545208,4.60825197 C19.9574869,4.41477773 19.9546013,4.09820839 20.1480756,3.90117456 C20.1501626,3.89904911 20.1522686,3.89694235 20.1543933,3.89485454 Z";
const PATH_THREE_D =
  "M0.154393339,3.89485454 L3.97631488,0.139296592 C4.17083111,-0.0518420739 4.48263286,-0.0518571125 4.67716753,0.139262789 L25.6916134,20.7848311 C26.0855801,21.1718824 26.0911863,21.8050225 25.704135,22.1989893 C25.7000188,22.2031791 25.6958657,22.2073326 25.6916762,22.2114492 L4.67709797,42.8607841 C4.48259567,43.0519059 4.17082418,43.0519358 3.97628526,42.8608513 L0.154518591,39.1069479 C-0.0424848215,38.9134427 -0.0453206733,38.5968729 0.148184538,38.3998695 C0.150289256,38.3977268 0.152413239,38.395603 0.154556228,38.3934985 L16.9937789,21.8567812 C17.1908028,21.6632968 17.193672,21.3467273 17.0001876,21.1497035 C16.9980647,21.1475418 16.9959223,21.1453995 16.9937605,21.1432767 L0.15452076,4.60825197 C-0.0425130651,4.41477773 -0.0453986756,4.09820839 0.148075568,3.90117456 C0.150162624,3.89904911 0.152268631,3.89694235 0.154393339,3.89485454 Z";

function lerpChevronColor(t: number): string {
  // Smooth triangle wave 0 -> 1 -> 0 between #FFFFFF and #FBC638
  const r = Math.round(255 + (251 - 255) * t);
  const g = Math.round(255 + (198 - 255) * t);
  const b = Math.round(255 + (56 - 255) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function chevronWaveFactor(activeAge: number, delayFrames: number): number {
  const local = activeAge - delayFrames;
  if (local <= 0) return 0;
  // 1s cycle (30 frames @ 30fps), faster 18-frame pulse after click
  const period = 18;
  const phase = (local % period) / period;
  return phase < 0.5 ? phase * 2 : (1 - phase) * 2;
}

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
  const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 14, mass: 0.45, stiffness: 260 } });
  const exit = interpolate(frame, [exitFrame, exitFrame + 9], [0, 1], clamp);
  const hover = interpolate(frame, [hoverStartFrame, hoverStartFrame + 6], [0, 1], clamp);
  const pathOneHover = interpolate(frame, [hoverStartFrame, hoverStartFrame + 5], [0, 1], clamp);
  const pathTwoHover = interpolate(frame, [hoverStartFrame, hoverStartFrame + 7], [0, 1], clamp);
  const clicked = frame >= clickFrame;
  const completed = frame >= loadingDoneFrame;
  const age = frame - clickFrame;

  // Physical press into the hard offset block shadow on click
  const pressScale = clicked
    ? interpolate(age, [0, 2, 6, 11], [1.03, 0.92, 1.04, 1], clamp)
    : interpolate(hover, [0, 1], [1, 1.03]);
  const pressOffset = clicked
    ? interpolate(age, [0, 2, 6, 11], [0, 5, -1, 0], clamp)
    : 0;
  const shadowSize = clicked
    ? interpolate(age, [0, 2, 6, 11], [10, 4, 11, 10], clamp)
    : interpolate(hover, [0, 1], [6, 10]);

  const state = completed ? "complete" : clicked ? age <= 2 ? "pressed" : "working" : hover > 0 ? "hover" : "ready";
  const activeAge = Math.max(0, frame - hoverStartFrame);

  // Staggered color_anim wave across path.three (0.2s -> 2f), path.two (0.4s -> 5f), path.one (0.6s -> 8f)
  const fillThree = hover > 0 ? lerpChevronColor(chevronWaveFactor(activeAge, 1)) : "#FFFFFF";
  const fillTwo = hover > 0 ? lerpChevronColor(chevronWaveFactor(activeAge, 4)) : "#FFFFFF";
  const fillOne = hover > 0 ? lerpChevronColor(chevronWaveFactor(activeAge, 7)) : "#FFFFFF";

  // SVG path.one (-60% = -39.6px -> 0) and path.two (-30% = -19.8px -> 0)
  const oneTx = interpolate(pathOneHover, [0, 1], [-39.6, 0]);
  const twoTx = interpolate(pathTwoHover, [0, 1], [-19.8, 0]);
  const chevronMarginRight = interpolate(hover, [0, 1], [0, 45]);

  // Smooth transition from 6px 6px 0 #000000 to 10px 10px 0 #FBC638 on hover
  const shadowColor = hover > 0.25 ? "#FBC638" : "#000000";

  return <div data-regenerate-state={state} data-press-scale={Number(pressScale.toFixed(4))} style={{
    position: "absolute", left: "50%", top: "50%",
    transform: `translate3d(-50%, calc(-50% + ${342 + interpolate(enter, [0, 1], [38, 0]) + exit * 28}px), 0) scale(${interpolate(enter, [0, 1], [0.84, 1]) * pressScale * (1 - exit * 0.12)})`,
    opacity: interpolate(frame, [enterFrame, enterFrame + 5], [0, 1], clamp) * (1 - exit),
    zIndex: 48, pointerEvents: "none",
  }}>
    <div data-cta-button="skew-chevron" style={{
      display: "flex", alignItems: "center",
      padding: "12px 45px",
      backgroundColor: "#FF1E6E",
      color: "#FFFFFF",
      transform: `skewX(-15deg) translate3d(${pressOffset}px, ${pressOffset}px, 0)`,
      boxShadow: `${shadowSize}px ${shadowSize}px 0 ${shadowColor}`,
    }}>
      <span data-regenerate-label style={{
        transform: "skewX(15deg)",
        display: "inline-block",
        fontFamily: "'Poppins', 'Clash Display', 'Cabinet Grotesk', Inter, sans-serif",
        fontSize: 36,
        fontWeight: 900,
        fontStyle: "italic",
        letterSpacing: "0.01em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        lineHeight: 1.05,
        color: "#FFFFFF",
      }}>{completed ? "6 Slides Ready" : clicked && age >= 3 ? "Regenerating…" : "Regenerate"}</span>
      <span style={{
        transform: "skewX(15deg)",
        width: 20,
        marginLeft: 30,
        marginRight: chevronMarginRight,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}>
        <svg width="66px" height="43px" viewBox="0 0 66 43" style={{ overflow: "visible", flexShrink: 0 }}>
          <g id="arrow" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
            <path className="one" d={PATH_ONE_D} fill={fillOne} transform={`translate(${oneTx.toFixed(2)}, 0)`} />
            <path className="two" d={PATH_TWO_D} fill={fillTwo} transform={`translate(${twoTx.toFixed(2)}, 0)`} />
            <path className="three" d={PATH_THREE_D} fill={fillThree} />
          </g>
        </svg>
      </span>
    </div>
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

  // Screen-wide tactile camera reaction on click (cushion dip -> spring rebound) and on regeneration reveal (frames 68..108)
  const clickCameraPulse =
    frame >= clickFrame && frame < clickFrame + 18
      ? interpolate(frame - clickFrame, [0, 2, 7, 18], [1, 0.968, 1.026, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : frame >= loadingDoneFrame && frame < loadingDoneFrame + 16
        ? interpolate(frame - loadingDoneFrame, [0, 4, 16], [1, 1.028, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 1;

  // Soft studio ambient backlight response on click (strictly frames 68..108)
  const stageReactionGlow =
    frame >= clickFrame && frame <= 108
      ? interpolate(frame, [clickFrame, clickFrame + 5, 96, 108], [0, 1, 0.75, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

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
        {stageReactionGlow > 0.001 && (
          <div
            data-stage-click-reaction="ambient-pulse"
            style={{
              position: "absolute",
              width: 1680,
              height: 760,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at 50% 48%, rgba(255, 30, 110, 0.18) 0%, rgba(255, 30, 110, 0.06) 44%, rgba(255, 30, 110, 0) 72%)",
              opacity: stageReactionGlow,
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        )}

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
          // Staggered tactile reaction wave across the 6 cards when Regenerate is clicked (frames 68..89)
          const clickWaveStart = clickFrame + i * 1.6;
          const clickWaveProg =
            frame >= clickWaveStart && frame < loadingDoneFrame - 2
              ? interpolate(frame, [clickWaveStart, clickWaveStart + 4, clickWaveStart + 11], [0, 1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0;
          const clickWaveLiftY = clickWaveProg * -18;
          const clickWaveScale = 1 + clickWaveProg * 0.035;
          const isClickWaveActive = clickWaveProg > 0.15;

          const flipLiftY = Math.sin(easedFlip * Math.PI) * -42 + clickWaveLiftY;
          const flipScalePop = (1 + Math.sin(easedFlip * Math.PI) * 0.08) * clickWaveScale;
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
                  : isClickWaveActive
                    ? "3px solid #FF2A7A"
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
          showRipple={false}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
