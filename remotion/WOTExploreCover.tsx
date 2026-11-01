import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { WOT_ASSETS, TIMELINE } from "./assets.config";
import { WOTVideoPanel } from "./WOTVideoPanel";
import { CardSmashTransition } from "./CardSmashTransition";

export const WOTExploreCover: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Video assets
  const video1 = WOT_ASSETS[0].publicPath;
  const video2 = WOT_ASSETS[1].publicPath;
  const video3 = WOT_ASSETS[2].publicPath;

  // =========================================================================
  // BEAT 1: GIANT OPENING TYPOGRAPHY (Frames 000–015)
  // High-contrast, pure solid typography: #F7F7F7 on deep neutral #08090D.
  // Zero video-caption bleed; zero decorative background labels.
  // =========================================================================
  const isOpeningActive = frame >= 0 && frame <= 16;
  const s1Spring = spring({
    frame,
    fps,
    config: { damping: 11, mass: 0.55, stiffness: 220 },
  });

  // "WALL OF" enters with crisp overshoot
  const s1WallY = interpolate(s1Spring, [0, 1], [-70, 0]);
  const s1WallOpacity = interpolate(frame, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "TEXT." slams in with high velocity
  const s1TextRel = Math.max(0, frame - 2);
  const s1TextSpring = spring({
    frame: s1TextRel,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 260 },
  });
  const s1TextScale = interpolate(s1TextSpring, [0, 1], [1.7, 1.0]);
  const s1TextOpacity = interpolate(frame, [2, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sharp exit contraction at frames 13–15 transitioning into Hero 1
  const s1Exit = interpolate(frame, [13, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const s1ExitScale = interpolate(s1Exit, [0, 1], [1.0, 0.88]);
  const s1ExitOpacity = interpolate(s1Exit, [0, 1], [1.0, 0]);

  // =========================================================================
  // BEAT 2: HERO 1 — NUTRITION & FITNESS (Frames 016–037)
  // Lands with rapid scale overshoot, clean dark surrounding space, readable hold.
  // =========================================================================
  const isHero1Active = frame >= 15 && frame <= 44;
  const hero1Rel = Math.max(0, frame - 15);
  const hero1Spring = spring({
    frame: hero1Rel,
    fps,
    config: { damping: 12, mass: 0.65, stiffness: 210 },
  });
  const hero1EntranceScale = interpolate(hero1Spring, [0, 1], [0.82, 1.0]);
  const hero1Drift = interpolate(frame, [19, 37], [1.0, 1.025], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hero1Scale = frame < 20 ? hero1EntranceScale : hero1Drift;
  const hero1Opacity = interpolate(frame, [15, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // =========================================================================
  // BEAT 3: FAST DIRECTIONAL CARD SWAP (Frames 038–044)
  // 7-frame high tempo swap: Card 1 accelerates out left, Card 2 sweeps in right.
  // =========================================================================
  const swapRel = Math.max(0, frame - 37);
  const swapSpring = spring({
    frame: swapRel,
    fps,
    config: { damping: 12, mass: 0.55, stiffness: 260 },
  });

  // Card 1 Exit
  const card1ExitX = interpolate(swapSpring, [0, 1], [0, -860]);
  const card1ExitRotateY = interpolate(swapSpring, [0, 1], [0, 14]);
  const card1ExitScale = interpolate(swapSpring, [0, 1], [1.025, 0.82]);
  const card1ExitOpacity = interpolate(frame, [37, 43], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card 2 Enter (from right)
  const card2EnterRel = Math.max(0, frame - 38);
  const card2EnterSpring = spring({
    frame: card2EnterRel,
    fps,
    config: { damping: 12, mass: 0.6, stiffness: 240 },
  });
  const card2EnterX = interpolate(card2EnterSpring, [0, 1], [860, 0]);
  const card2EnterRotateY = interpolate(card2EnterSpring, [0, 1], [-14, 0]);
  const card2EnterScale = interpolate(card2EnterSpring, [0, 1], [0.84, 1.0]);
  const card2EnterOpacity = interpolate(frame, [38, 43], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // =========================================================================
  // BEAT 4: HERO 2 — TRAVEL & PERSPECTIVE (Frames 045–068)
  // Clean centered composition, readable hold, subtle drift.
  // =========================================================================
  const isHero2Active = frame >= 38 && frame <= 70;
  const hero2Drift = interpolate(frame, [44, 68], [1.0, 1.025], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const card2ExitScale = interpolate(frame, [66, 69], [1.025, 0.90], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const card2ExitOpacity = interpolate(frame, [67, 69], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // =========================================================================
  // BEAT 5: KINETIC TYPOGRAPHY SMASH — "REMIX." (Frames 069–077)
  // Full-frame kinetic impact (~240px, 900 weight, tight -0.06em tracking).
  // Handled cleanly by CardSmashTransition component.
  // =========================================================================

  // =========================================================================
  // BEAT 6: HERO 3 — MENTAL MODELS (Frames 078–101)
  // Sharp entrance from depth/bottom, subtle card drift, clean hold.
  // =========================================================================
  const isHero3Active = frame >= 76 && frame <= 104;
  const hero3Rel = Math.max(0, frame - 76);
  const hero3Spring = spring({
    frame: hero3Rel,
    fps,
    config: { damping: 12, mass: 0.65, stiffness: 220 },
  });
  const card3EnterY = interpolate(hero3Spring, [0, 1], [580, 0]);
  const card3EnterScale = interpolate(hero3Spring, [0, 1], [0.85, 1.0]);
  const hero3Drift = interpolate(frame, [82, 101], [1.0, 1.025], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const card3HeroOpacity = interpolate(frame, [76, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // =========================================================================
  // BEAT 7 & 8: THREE-CARD BURST & EDITORIAL COLLAGE (Frames 102–153)
  // Burst in (102–111), develop into balanced triptych (112–153).
  // =========================================================================
  const isCollageActive = frame >= 102 && frame <= 191;
  const burstRel = Math.max(0, frame - 101);
  const burstSpring = spring({
    frame: burstRel,
    fps,
    config: { damping: 13, mass: 0.7, stiffness: 200 },
  });

  // Card 1 (Left - Gym/Nutrition): sweeps in from left to -360
  const collageLeftX = interpolate(burstSpring, [0, 1], [-840, -360]);
  const collageLeftRotateY = interpolate(burstSpring, [0, 1], [12, 4]);
  const collageLeftRot = interpolate(burstSpring, [0, 1], [-6, -2.5]);
  const collageLeftScaleBase = interpolate(burstSpring, [0, 1], [0.75, 0.92]);
  const collageLeftOpacity = interpolate(frame, [101, 107], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card 2 (Center - Travel): drops/pushes in to center
  const collageCenterY = interpolate(burstSpring, [0, 1], [-180, 0]);
  const collageCenterScaleBase = interpolate(burstSpring, [0, 1], [0.80, 1.05]);
  const collageCenterOpacity = interpolate(frame, [102, 108], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card 3 (Right - Mental Models): transitions from center to right +360
  const collageRightX = interpolate(burstSpring, [0, 1], [0, 360]);
  const collageRightRotateY = interpolate(burstSpring, [0, 1], [0, -4]);
  const collageRightRot = interpolate(burstSpring, [0, 1], [0, 2.5]);
  const collageRightScaleBase = interpolate(burstSpring, [0, 1], [1.025, 0.92]);

  // Clean top editorial title in negative space (NEVER overlapping video captions!)
  const collageTitleOpacity = interpolate(frame, [112, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // =========================================================================
  // BEAT 9: FOREGROUND FOCUS SEQUENCE (Frames 154–179)
  // Shifts visual emphasis between cards:
  // - 154–165: Left pushes forward (scale 1.02, zIndex 25)
  // - 166–174: Right pushes forward (scale 1.02, zIndex 25)
  // - 175–179: Re-balances into uniform triptych
  // =========================================================================
  let leftScaleModifier = 0;
  let centerScaleModifier = 0;
  let rightScaleModifier = 0;
  let leftZIndex = 12;
  let centerZIndex = 20;
  let rightZIndex = 12;

  if (frame >= 154 && frame <= 165) {
    // Focus Left
    const focus1Progress = interpolate(frame, [154, 158, 162, 165], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    leftScaleModifier = focus1Progress * 0.10; // 0.92 -> 1.02
    centerScaleModifier = -focus1Progress * 0.07; // 1.05 -> 0.98
    if (focus1Progress > 0.3) {
      leftZIndex = 26;
      centerZIndex = 18;
    }
  } else if (frame >= 166 && frame <= 175) {
    // Focus Right
    const focus2Progress = interpolate(frame, [166, 170, 172, 175], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    rightScaleModifier = focus2Progress * 0.10; // 0.92 -> 1.02
    centerScaleModifier = -focus2Progress * 0.07;
    if (focus2Progress > 0.3) {
      rightZIndex = 26;
      centerZIndex = 18;
    }
  }

  const finalLeftScale = collageLeftScaleBase + leftScaleModifier;
  const finalCenterScale = collageCenterScaleBase + centerScaleModifier;
  const finalRightScale = collageRightScaleBase + rightScaleModifier;

  // =========================================================================
  // BEAT 10: LOOP RESET (Frames 180–191)
  // Controlled masked transition returning to opening typography for seamless loop.
  // =========================================================================
  const loopRel = Math.max(0, frame - 180);
  const loopProgress = interpolate(loopRel, [0, 11], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Left & right cards slide outward and fade
  const loopLeftX = interpolate(loopProgress, [0, 1], [-360, -680]);
  const loopRightX = interpolate(loopProgress, [0, 1], [360, 680]);
  const loopSideOpacity = interpolate(loopProgress, [0, 0.75], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Center card expands gently into background and fades
  const loopCenterScale = interpolate(loopProgress, [0, 1], [1.05, 1.25]);
  const loopCenterOpacity = interpolate(loopProgress, [0, 0.8], [1, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Re-emerging opening typography at loop reset matching Frame 000
  const loopTitleOpacity = interpolate(loopProgress, [0.35, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#08090D",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Editorial Atmospheric Backdrop — pure deep dark vignette, zero clutter */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.04) 0%, rgba(8, 9, 13, 0.98) 72%)",
        }}
      />

      {/* Subtle fine technical grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          backgroundPosition: "center center",
          opacity: 0.5,
        }}
      />

      {/* =================================================================== */}
      {/* BEAT 1: GIANT OPENING TYPOGRAPHY (Frames 000–015) */}
      {/* Solid high-contrast #F7F7F7 text on #08090D; zero video bleed */}
      {/* =================================================================== */}
      {isOpeningActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${s1ExitScale})`,
            opacity: s1ExitOpacity,
            zIndex: 40,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {/* Top Line: WALL OF (Font 115px, tight -0.04em tracking) */}
          <div
            style={{
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 900,
              fontSize: 115,
              lineHeight: 0.88,
              letterSpacing: "-0.04em",
              color: "#F7F7F7",
              textTransform: "uppercase",
              transform: `translate3d(0, ${s1WallY}px, 0)`,
              opacity: s1WallOpacity,
              marginBottom: -12,
              textShadow: "0 12px 36px rgba(0, 0, 0, 0.9)",
            }}
          >
            WALL OF
          </div>

          {/* Bottom Line: TEXT. (Font 260px, tight -0.055em tracking) */}
          <div
            style={{
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 900,
              fontSize: 260,
              lineHeight: 0.86,
              letterSpacing: "-0.055em",
              color: "#F7F7F7",
              textTransform: "uppercase",
              transform: `scale(${s1TextScale})`,
              opacity: s1TextOpacity,
              textShadow: "0 20px 60px rgba(0, 0, 0, 0.95)",
            }}
          >
            TEXT.
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BEAT 2: HERO 1 (Nutrition & Fitness) (Frames 016–037 + swap 038–044) */}
      {/* Clean 9:16 portrait card, zero badges, authentic embedded headline */}
      {/* =================================================================== */}
      {isHero1Active && !isCollageActive && (
        <WOTVideoPanel
          src={video1}
          width={350}
          height={622}
          x={frame < 38 ? 0 : card1ExitX}
          y={0}
          scale={frame < 38 ? hero1Scale : card1ExitScale}
          rotateY={frame < 38 ? 0 : card1ExitRotateY}
          opacity={frame < 38 ? hero1Opacity : card1ExitOpacity}
          zIndex={frame < 38 ? 20 : 15}
        />
      )}

      {/* =================================================================== */}
      {/* BEAT 4: HERO 2 (Travel & Perspective) (Frames 038–070) */}
      {/* Sweeps in from right on swap, readable hold through frame 68 */}
      {/* =================================================================== */}
      {isHero2Active && !isCollageActive && (
        <WOTVideoPanel
          src={video2}
          width={350}
          height={622}
          x={frame < 44 ? card2EnterX : 0}
          y={0}
          scale={frame < 44 ? card2EnterScale : frame >= 67 ? card2ExitScale : hero2Drift}
          rotateY={frame < 44 ? card2EnterRotateY : 0}
          opacity={frame < 44 ? card2EnterOpacity : frame >= 67 ? card2ExitOpacity : 1}
          zIndex={25}
        />
      )}

      {/* =================================================================== */}
      {/* BEAT 5: KINETIC TYPOGRAPHY SMASH (Frames 069–077) */}
      {/* Full-frame "REMIX." impact beat */}
      {/* =================================================================== */}
      <CardSmashTransition
        startFrame={69}
        durationFrames={9}
        word="REMIX."
        subtextTop="VIRAL BY DESIGN"
        subtextBottom="ONE VIDEO • ENDLESS VISIONS"
      />

      {/* =================================================================== */}
      {/* BEAT 6: HERO 3 (Mental Models) (Frames 076–104) */}
      {/* Crisp entrance from depth, clean hold through frame 101 */}
      {/* =================================================================== */}
      {isHero3Active && !isCollageActive && (
        <WOTVideoPanel
          src={video3}
          width={350}
          height={622}
          x={0}
          y={frame < 82 ? card3EnterY : 0}
          scale={frame < 82 ? card3EnterScale : hero3Drift}
          opacity={card3HeroOpacity}
          zIndex={25}
        />
      )}

      {/* =================================================================== */}
      {/* BEATS 7, 8, 9, 10: EDITORIAL COLLAGE & LOOP RESET (Frames 102–191) */}
      {/* Three-card burst (102-111), development (112-153), focus sequence */}
      {/* (154-179), and clean loop reset (180-191). Zero caption overlap. */}
      {/* =================================================================== */}
      {isCollageActive && (
        <>
          {/* Top Editorial Title in negative space (strictly above video cards) */}
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 0,
              right: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: frame >= 180 ? loopSideOpacity * collageTitleOpacity : collageTitleOpacity,
              zIndex: 35,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <span
              style={{
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 900,
                fontSize: 34,
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
                color: "#F7F7F7",
                textTransform: "uppercase",
                textShadow: "0 4px 18px rgba(0, 0, 0, 0.9)",
              }}
            >
              EXPLORE WALL OF TEXT
            </span>
            <span
              style={{
                marginTop: 6,
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.20em",
                color: "rgba(255, 255, 255, 0.65)",
                textTransform: "uppercase",
                textShadow: "0 2px 10px rgba(0, 0, 0, 0.8)",
              }}
            >
              SELECT A HOOK • ADD YOUR MESSAGE • PUBLISH
            </span>
          </div>

          {/* Left Card: Video 1 (Nutrition & Fitness) */}
          <WOTVideoPanel
            src={video1}
            width={330}
            height={586}
            x={frame >= 180 ? loopLeftX : collageLeftX}
            y={24}
            scale={finalLeftScale}
            rotation={collageLeftRot}
            rotateY={collageLeftRotateY}
            opacity={frame >= 180 ? loopSideOpacity * collageLeftOpacity : collageLeftOpacity}
            zIndex={leftZIndex}
          />

          {/* Center Card: Video 2 (Travel & Perspective) */}
          <WOTVideoPanel
            src={video2}
            width={350}
            height={622}
            x={0}
            y={frame >= 180 ? 12 : collageCenterY + 12}
            scale={frame >= 180 ? loopCenterScale : finalCenterScale}
            rotation={0}
            opacity={frame >= 180 ? loopCenterOpacity : collageCenterOpacity}
            zIndex={centerZIndex}
          />

          {/* Right Card: Video 3 (Mental Models) */}
          <WOTVideoPanel
            src={video3}
            width={330}
            height={586}
            x={frame >= 180 ? loopRightX : collageRightX}
            y={24}
            scale={finalRightScale}
            rotation={collageRightRot}
            rotateY={collageRightRotateY}
            opacity={frame >= 180 ? loopSideOpacity : 1}
            zIndex={rightZIndex}
          />
        </>
      )}

      {/* =================================================================== */}
      {/* BEAT 10: LOOP TAIL TYPOGRAPHY (Frames 180–191) */}
      {/* Exact match to Frame 000 typography for seamless looping */}
      {/* =================================================================== */}
      {frame >= 180 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: loopTitleOpacity,
            zIndex: 45,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div
            style={{
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 900,
              fontSize: 115,
              lineHeight: 0.88,
              letterSpacing: "-0.04em",
              color: "#F7F7F7",
              textTransform: "uppercase",
              marginBottom: -12,
              textShadow: "0 12px 36px rgba(0, 0, 0, 0.9)",
            }}
          >
            WALL OF
          </div>
          <div
            style={{
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 900,
              fontSize: 260,
              lineHeight: 0.86,
              letterSpacing: "-0.055em",
              color: "#F7F7F7",
              textTransform: "uppercase",
              textShadow: "0 20px 60px rgba(0, 0, 0, 0.95)",
            }}
          >
            TEXT.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
