import React from "react";
import {
  AbsoluteFill,
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

export const WOT_PROMO_FRAMES = 270;

const STICKER = { w: 118, h: 154 };

/**
 * InfluencerPortraitBadge renders the clean, borderless creator identity photo card
 * that the cursor drags onto the viral Wall-of-Text video's face to swap the creator
 * (zero outer border line and zero pills/badges, matching HookVideoPromo).
 */
const InfluencerPortraitBadge: React.FC<{
  src: string;
}> = ({ src }) => {
  return (
    <div
      style={{
        width: STICKER.w,
        height: STICKER.h,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "#0D1017",
        boxShadow: "0 22px 48px rgba(0, 0, 0, 0.88)",
        position: "relative",
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};

const WALL_OF_TEXT_LINES = [
  "POV: Everyone thought I hired a",
  "full creative agency to film our",
  "daily videos, but I never even",
  "turned on my camera once —",
  "I just swapped my face & script",
  "onto viral text-on-screen videos.",
];

/**
 * RemixWallOfTextOverlay renders the clean, native TikTok-style Wall-of-Text paragraph
 * with zero container, zero border, and zero pills — matching the authentic look and
 * upper-wall placement of the source Wall-of-Text video before and after the cursor
 * drags it into place.
 */
const RemixWallOfTextOverlay: React.FC = () => {
  const thinStrokeShadow =
    "-0.9px -0.9px 0 rgba(0, 0, 0, 0.88), 0.9px -0.9px 0 rgba(0, 0, 0, 0.88), -0.9px 0.9px 0 rgba(0, 0, 0, 0.88), 0.9px 0.9px 0 rgba(0, 0, 0, 0.88), 0px 2px 5px rgba(0, 0, 0, 0.45)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        pointerEvents: "none",
      }}
    >
      {WALL_OF_TEXT_LINES.map((line, idx) => (
        <div
          key={idx}
          style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: 18.5,
            lineHeight: 1.24,
            letterSpacing: "-0.015em",
            color: "#FFFFFF",
            textAlign: "center",
            whiteSpace: "nowrap",
            textShadow: thinStrokeShadow,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

/**
 * WotHeaderBand renders unobstructed top-band and bottom-band display typography
 * using Higgsfield AI's tight-tracked (-0.04em), 900-weight uppercase display formula
 * with fast 6-frame elastic snap physics and Electric Violet (#7C3AED) + Sky Blue (#38BDF8)
 * geometric tape-slab highlights.
 */
const WotHeaderBand: React.FC<{
  topText: string;
  bottomText: string;
  beatStartFrame: number;
  highlightBottom?: boolean;
  opacity?: number;
}> = ({
  topText,
  bottomText,
  beatStartFrame,
  highlightBottom = false,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rel = Math.max(0, frame - beatStartFrame);

  const renderAnimatedWord = (
    word: string,
    isTop: boolean,
    color: string,
    fontSize: number,
    stickerBg?: string
  ) => {
    const snapSpr = spring({
      frame: rel,
      fps,
      config: { damping: 14, mass: 0.35, stiffness: 420 },
    });

    const translateY = interpolate(snapSpr, [0, 1], [isTop ? -28 : 28, 0]);
    const scaleX = interpolate(snapSpr, [0, 0.7, 1], [1.18, 0.95, 0.97]);
    const scaleY = interpolate(snapSpr, [0, 0.7, 1], [0.72, 1.04, 1.0]);
    const slabTilt = isTop ? 0 : highlightBottom ? -1.4 : 0;
    const slabSkew = stickerBg ? -5 : 0;

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translate3d(0, ${translateY}px, 0) rotate(${slabTilt}deg) skewX(${slabSkew}deg) scale(${scaleX}, ${scaleY})`,
            fontFamily:
              "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
            fontWeight: 900,
            fontSize,
            lineHeight: 0.9,
            letterSpacing: "-0.04em",
            color,
            backgroundColor: stickerBg ?? "transparent",
            padding: stickerBg ? "14px 34px 16px 34px" : "0px",
            borderRadius: stickerBg ? 4 : 0,
            boxShadow: stickerBg
              ? "0 20px 48px rgba(0, 0, 0, 0.9), 0 0 36px rgba(124, 58, 237, 0.5)"
              : "none",
            textTransform: "uppercase",
            textShadow: stickerBg
              ? "none"
              : color === "#38BDF8"
                ? "0 0 30px rgba(56, 189, 248, 0.42), 0 10px 28px rgba(0, 0, 0, 0.92)"
                : "0 10px 28px rgba(0, 0, 0, 0.92)",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transform: stickerBg ? `skewX(${-slabSkew}deg)` : "none",
            }}
          >
            {word}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 40,
        paddingBottom: 38,
        opacity,
        zIndex: 35,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {renderAnimatedWord(topText, true, "#FFFFFF", 92)}
      {renderAnimatedWord(
        bottomText,
        false,
        highlightBottom ? "#FFFFFF" : "#38BDF8",
        highlightBottom ? 80 : 84,
        highlightBottom ? "#7C3AED" : undefined
      )}
    </div>
  );
};

/**
 * WotHeroRibbons implements the Higgsfield AI Unboxed 3D Extruded Foreground Title:
 * - ZERO rectangular ribbon background slabs (distinct from Hook Video & Talking Head)
 * - ZERO orbital dashed line, circular node dots, or floating background stars
 * - Giant unboxed Pure White (`#FFFFFF`) 3D-extruded `TEXT ON SCREEN` primary headline
 *   with deep ink contour and violet block extrusion so every letter is 100% readable in front
 * - Clean unboxed Sky Blue (`#38BDF8`) `YOUR CREATOR` + Pure White `✦ NEW STORY SCRIPT ✦` sub-lockup
 */
const WotHeroRibbons: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) {
    return null;
  }

  const rel = frame - startFrame;

  // 1. Primary unboxed 3D headline ("TEXT ON SCREEN") entrance
  const titleRel = Math.max(0, rel - 1);
  const titleSpr = spring({
    frame: titleRel,
    fps,
    config: { damping: 13, mass: 0.36, stiffness: 430 },
  });
  const titleScaleX = interpolate(titleSpr, [0, 0.65, 1], [1.28, 0.94, 0.98]);
  const titleScaleY = interpolate(titleSpr, [0, 0.65, 1], [0.68, 1.05, 1.0]);
  const titleY = interpolate(titleSpr, [0, 1], [28, 0]);
  const titleOpacity = interpolate(titleRel, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 2. Secondary unboxed sub-headline ("YOUR CREATOR") entrance
  const sub1Rel = Math.max(0, rel - 5);
  const sub1Spr = spring({
    frame: sub1Rel,
    fps,
    config: { damping: 13, mass: 0.36, stiffness: 420 },
  });
  const sub1Y = interpolate(sub1Spr, [0, 1], [24, 0]);
  const sub1Scale = interpolate(sub1Spr, [0, 0.7, 1], [0.82, 1.04, 1.0]);
  const sub1Opacity = interpolate(sub1Rel, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3. Tertiary unboxed script callout ("✦ NEW STORY SCRIPT ✦") entrance
  const sub2Rel = Math.max(0, rel - 9);
  const sub2Spr = spring({
    frame: sub2Rel,
    fps,
    config: { damping: 14, mass: 0.38, stiffness: 400 },
  });
  const sub2Y = interpolate(sub2Spr, [0, 1], [20, 0]);
  const sub2Scale = interpolate(sub2Spr, [0, 1], [0.86, 1.0]);
  const sub2Opacity = interpolate(sub2Rel, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: 1460,
        height: 460,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 65,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* TIER 1: GIANT UNBOXED 3D EXTRUDED "TEXT ON SCREEN" HEADLINE */}
      <div
        style={{
          position: "relative",
          opacity: titleOpacity,
          transform: `translate3d(0, ${titleY}px, 0) rotate(-2.2deg) skewX(-6deg) scale(${titleScaleX}, ${titleScaleY})`,
          transformOrigin: "center center",
          zIndex: 25,
        }}
      >
        <span
          style={{
            fontFamily:
              "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
            fontWeight: 900,
            fontSize: 134,
            lineHeight: 0.92,
            letterSpacing: "-0.045em",
            color: "#FFFFFF",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            display: "inline-block",
            WebkitTextStroke: "10px #07080C",
            paintOrder: "stroke fill",
            textShadow:
              "0 4px 0 #07080C, 0 8px 0 #4C1D95, 0 13px 0 #7C3AED, 0 22px 45px rgba(0, 0, 0, 0.98), 0 0 54px rgba(124, 58, 237, 0.72)",
          }}
        >
          TEXT ON SCREEN
        </span>
      </div>

      {/* TIER 2: UNBOXED SKY BLUE 3D "YOUR CREATOR" SUB-HEADLINE */}
      <div
        style={{
          position: "relative",
          marginTop: 18,
          opacity: sub1Opacity,
          transform: `translate3d(0, ${sub1Y}px, 0) rotate(-1.4deg) skewX(-6deg) scale(${sub1Scale})`,
          transformOrigin: "center center",
          zIndex: 26,
        }}
      >
        <span
          style={{
            fontFamily:
              "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
            fontWeight: 900,
            fontSize: 92,
            lineHeight: 0.94,
            letterSpacing: "-0.035em",
            color: "#38BDF8",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            display: "inline-block",
            WebkitTextStroke: "9px #07080C",
            paintOrder: "stroke fill",
            textShadow:
              "0 4px 0 #07080C, 0 8px 0 #0C4A6E, 0 18px 38px rgba(0, 0, 0, 0.98), 0 0 42px rgba(56, 189, 248, 0.65)",
          }}
        >
          YOUR CREATOR
        </span>
      </div>

      {/* TIER 3: UNBOXED PURE WHITE + VIOLET SPARKLE "NEW STORY SCRIPT" CALLOUT */}
      <div
        style={{
          position: "relative",
          marginTop: 14,
          opacity: sub2Opacity,
          transform: `translate3d(0, ${sub2Y}px, 0) rotate(-1.4deg) scale(${sub2Scale})`,
          transformOrigin: "center center",
          display: "flex",
          alignItems: "center",
          gap: 18,
          zIndex: 27,
        }}
      >
        <span
          style={{
            fontFamily:
              "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
            fontWeight: 900,
            fontSize: 56,
            lineHeight: 1,
            letterSpacing: "0.08em",
            color: "#FFFFFF",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            display: "inline-block",
            WebkitTextStroke: "7px #07080C",
            paintOrder: "stroke fill",
            textShadow:
              "0 4px 0 #07080C, 0 6px 0 #7C3AED, 0 14px 28px rgba(0, 0, 0, 0.96), 0 0 32px rgba(124, 58, 237, 0.65)",
          }}
        >
          ✦ NEW STORY SCRIPT ✦
        </span>
      </div>
    </div>
  );
};

export const WallOfTextPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Authentic Wall of Text Assets (Source Wall-of-Text Video -> Reference Face -> Generated Video)
  const sourceWotVideoSrc = staticFile(
    "explore/covers/sources/wot-source-video.mp4"
  );
  const recreatedWotVideoSrc = staticFile(
    "explore/covers/sources/wot-result-video.mp4"
  );
  const referenceFaceSrc = staticFile(
    "explore/covers/sources/wot-reference-face.png"
  );

  // =========================================================================
  // KEY CHOREOGRAPHY TIMESTAMPS (30 FPS, 270 Frames = 9.00s)
  // =========================================================================
  // 1. Frame 000-039 (0.00s-1.30s): Source Wall-of-Text Video plays unobstructed in center
  // 2. Frame 040-066 (1.33s-2.20s): Cursor enters with clean Reference Face photo & drops it on her face
  // 3. Frame 068-085 (2.27s-2.83s): Swaps seamlessly to Generated Video (old paragraph stripped, new face live)
  // 4. Frame 086-134 (2.87s-4.47s): Container-free Wall of Text appears on right -> cursor drags onto upper wall
  // 5. Frame 135-191 (4.50s-6.37s): Completed Wall-of-Text Video plays unobstructed in center
  // 6. Frame 192-269 (6.40s-9.00s): Higgsfield AI slanted-ribbon hero finale framing Source & Recreated cards
  const cursorEnterFrame = 40;
  const faceDropFrame = 66;
  const videoSwapFrame = 68;

  const remixCardEnterFrame = 86;
  const remixGrabFrame = 98;
  const remixDropFrame = 134;

  const heroStartFrame = 192;

  // =========================================================================
  // GLOBAL CAMERA & DIRECTIONAL BLUR (1920x1080 16:9 Canvas)
  // =========================================================================
  let cameraScale = interpolate(frame, [0, videoSwapFrame], [0.98, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame >= videoSwapFrame && frame < heroStartFrame - 12) {
    const popPunch = spring({
      frame: frame - videoSwapFrame,
      fps,
      config: { damping: 16, mass: 0.5, stiffness: 220 },
    });
    cameraScale = interpolate(popPunch, [0, 1], [0.99, 1.01]);
  } else if (frame >= heroStartFrame - 12 && frame < heroStartFrame) {
    const pushProgress = interpolate(
      frame,
      [heroStartFrame - 12, heroStartFrame - 1],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
    cameraScale = interpolate(pushProgress, [0, 1], [1.01, 1.1]);
  } else if (frame >= heroStartFrame) {
    const endSpring = spring({
      frame: frame - heroStartFrame,
      fps,
      config: { damping: 14, mass: 0.4, stiffness: 360 },
    });
    cameraScale = interpolate(endSpring, [0, 1], [1.1, 1.0]);
  }

  const transitionBlur =
    frame >= heroStartFrame - 8 && frame <= heroStartFrame + 3
      ? interpolate(
          frame,
          [heroStartFrame - 8, heroStartFrame - 2, heroStartFrame + 3],
          [0, 4.0, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }
        )
      : 0;

  // =========================================================================
  // MAIN WALL-OF-TEXT CARD (Source 0-67 -> Generated 68-269, ZERO Pills)
  // =========================================================================
  const cardWidth = 436;
  const cardHeight = 775;

  const swapTransformPop =
    frame >= videoSwapFrame && frame < heroStartFrame
      ? interpolate(
          spring({
            frame: frame - videoSwapFrame,
            fps,
            config: { damping: 16, mass: 0.5, stiffness: 240 },
          }),
          [0, 1],
          [0.985, 1]
        )
      : 1;

  let mainX = 0;
  let mainY = 0;
  let mainScale = 0.93 * swapTransformPop;
  let mainRotateY = interpolate(frame, [0, cursorEnterFrame], [-4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let mainRotation = interpolate(frame, [0, cursorEnterFrame], [-1.0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame >= heroStartFrame) {
    const heroSpr = spring({
      frame: frame - heroStartFrame,
      fps,
      config: { damping: 14, mass: 0.42, stiffness: 340 },
    });
    mainX = interpolate(heroSpr, [0, 1], [0, 535]);
    mainY = interpolate(heroSpr, [0, 1], [0, 8]);
    mainScale = interpolate(heroSpr, [0, 1], [0.93, 1.02]);
    mainRotateY = interpolate(heroSpr, [0, 1], [0, -6]);
    mainRotation = interpolate(heroSpr, [0, 1], [0, 2.4]);
  }

  // =========================================================================
  // LEFT SOURCE COMPARISON CARD IN HERO FINALE (Frames 192-269)
  // =========================================================================
  const showSourceComparisonCard = frame >= heroStartFrame;
  const leftHeroSpr = spring({
    frame: Math.max(0, frame - heroStartFrame),
    fps,
    config: { damping: 14, mass: 0.42, stiffness: 340 },
  });
  const leftCardX = interpolate(leftHeroSpr, [0, 1], [-180, -535]);
  const leftCardY = interpolate(leftHeroSpr, [0, 1], [24, -6]);
  const leftCardScale = interpolate(leftHeroSpr, [0, 1], [0.76, 1.02]);
  const leftCardRotateY = interpolate(leftHeroSpr, [0, 1], [14, 6]);
  const leftCardRotation = interpolate(leftHeroSpr, [0, 1], [-5, -2.4]);
  const leftCardOpacity = interpolate(
    frame,
    [heroStartFrame, heroStartFrame + 5],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // =========================================================================
  // FLOATING WALL OF TEXT APPEARANCE & DRAG TRAJECTORY (Frames 86-134)
  // =========================================================================
  const showFloatingWotText =
    frame >= remixCardEnterFrame && frame < remixDropFrame;
  const wotTextOpacity = interpolate(
    frame,
    [remixCardEnterFrame, remixCardEnterFrame + 8],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const wotDragProgress =
    frame >= remixGrabFrame
      ? interpolate(frame, [remixGrabFrame, remixDropFrame], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  // Smooth ease-in-out curve from outside on the right (430, 55) to centered upper wall (0, -172)
  const wotDragEased =
    wotDragProgress < 0.5
      ? 2 * wotDragProgress * wotDragProgress
      : 1 - Math.pow(-2 * wotDragProgress + 2, 2) / 2;

  const floatingWotX = interpolate(wotDragEased, [0, 1], [430, 0]);
  const floatingWotLinearY = interpolate(wotDragEased, [0, 1], [55, -172]);
  const floatingWotArcLift = Math.sin(wotDragEased * Math.PI) * -32;
  const floatingWotY = floatingWotLinearY + floatingWotArcLift;

  // On-Video Wall of Text Overlay locked inside Generated Card from Frame 134 onwards
  const showLockedWotText = frame >= remixDropFrame;

  // =========================================================================
  // CURSOR TRAJECTORY (1: Face Swap onto Source -> 2: Drag Wall of Text Up)
  // =========================================================================
  let cursorX = -720;
  let cursorY = 240;
  let cursorOpacity = 0;
  let cursorGrabbing = false;
  let cursorPayload: React.ReactNode = undefined;
  let cursorPayloadOffset = { x: -58, y: -74 };
  let activeClickFrame: number | undefined = undefined;

  if (frame >= cursorEnterFrame && frame <= faceDropFrame) {
    // 1. Enter at Frame 40 & drag clean Reference Face directly onto the blonde woman's face (x: 10, y: 58)
    const moveProgress = interpolate(
      frame,
      [cursorEnterFrame, faceDropFrame - 2],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
    const eased = 1 - Math.pow(1 - moveProgress, 3);
    cursorX = interpolate(eased, [0, 1], [-640, 10]);
    cursorY = interpolate(eased, [0, 1], [150, 58]);
    cursorOpacity = interpolate(
      frame,
      [cursorEnterFrame, cursorEnterFrame + 6],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
    cursorGrabbing = true;
    cursorPayload = <InfluencerPortraitBadge src={referenceFaceSrc} />;
    cursorPayloadOffset = { x: -58, y: -74 };
    activeClickFrame = faceDropFrame;
  } else if (frame > faceDropFrame && frame < remixCardEnterFrame) {
    // 1B. After dropping the face at Frame 66, cursor glides away so the new face is 100% clear
    const exitProgress = interpolate(
      frame,
      [faceDropFrame + 1, remixCardEnterFrame - 1],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
    const easedExit = 1 - Math.pow(1 - exitProgress, 2.2);
    cursorX = interpolate(easedExit, [0, 1], [10, 265]);
    cursorY = interpolate(easedExit, [0, 1], [58, -120]);
    cursorOpacity = interpolate(
      frame,
      [faceDropFrame + 6, remixCardEnterFrame - 1],
      [1, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
    cursorGrabbing = false;
    activeClickFrame = faceDropFrame;
  } else if (frame >= remixCardEnterFrame && frame <= remixDropFrame + 14) {
    // 2. Cursor moves to bottom-right edge of the floating Wall of Text outside on the right (430 + 112, 55 + 52),
    //    grabs it at Frame 98, and glides it smoothly into place on the upper wall (0, -172) at Frame 134!
    const cursorGripOffsetX = 112;
    const cursorGripOffsetY = 52;
    if (frame < remixGrabFrame) {
      const enterProgress = interpolate(
        frame,
        [remixCardEnterFrame, remixGrabFrame - 1],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      const easedEnter = 1 - Math.pow(1 - enterProgress, 2.4);
      cursorX = interpolate(
        easedEnter,
        [0, 1],
        [560, 430 + cursorGripOffsetX]
      );
      cursorY = interpolate(
        easedEnter,
        [0, 1],
        [195, 55 + cursorGripOffsetY]
      );
      cursorOpacity = interpolate(
        frame,
        [remixCardEnterFrame, remixCardEnterFrame + 6],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      cursorGrabbing = frame >= remixGrabFrame - 1;
      activeClickFrame = remixGrabFrame;
    } else if (frame <= remixDropFrame) {
      cursorX = floatingWotX + cursorGripOffsetX;
      cursorY = floatingWotY + cursorGripOffsetY;
      cursorOpacity = 1;
      cursorGrabbing = true;
    } else {
      // Glide away cleanly after placing Wall of Text at Frame 134
      const releaseProgress = interpolate(
        frame,
        [remixDropFrame + 1, remixDropFrame + 14],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      cursorX = interpolate(
        releaseProgress,
        [0, 1],
        [0 + cursorGripOffsetX, 240]
      );
      cursorY = interpolate(
        releaseProgress,
        [0, 1],
        [-172 + cursorGripOffsetY, -245]
      );
      cursorOpacity = interpolate(
        frame,
        [remixDropFrame + 6, remixDropFrame + 14],
        [1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      cursorGrabbing = false;
    }
  }

  // =========================================================================
  // TOP & BOTTOM DISPLAY BANDS (Frames 0-191)
  // =========================================================================
  const bandOpacity =
    frame < heroStartFrame
      ? interpolate(
          frame,
          [0, 8, heroStartFrame - 10, heroStartFrame - 1],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }
        )
      : 0;

  const topHeadline =
    frame < cursorEnterFrame
      ? "TEXT ON SCREEN"
      : frame < videoSwapFrame
        ? "DRAG NEW FACE"
        : frame < remixCardEnterFrame
          ? "SAME MOTION"
          : frame < remixDropFrame + 12
            ? "DRAG TEXT ON SCREEN"
            : "TEXT ON SCREEN";

  const bottomHeadline =
    frame < cursorEnterFrame
      ? "SOURCE VIDEO"
      : frame < videoSwapFrame
        ? "TO VIRAL VIDEO"
        : frame < remixCardEnterFrame
          ? "VIDEO RECREATED"
          : frame < remixDropFrame + 12
            ? "OVER YOUR VIDEO"
            : "READY TO POST";

  const beatStartFrame =
    frame < cursorEnterFrame
      ? 0
      : frame < videoSwapFrame
        ? cursorEnterFrame
        : frame < remixCardEnterFrame
          ? videoSwapFrame
          : frame < remixDropFrame + 12
            ? remixCardEnterFrame
            : remixDropFrame + 12;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#07080C",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Higgsfield-Inspired Dual Studio Backdrop (Electric Violet #7C3AED + Sky Blue #38BDF8 Aura) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 28% 36%, rgba(124, 58, 237, 0.18) 0%, rgba(124, 58, 237, 0) 48%), radial-gradient(circle at 72% 64%, rgba(56, 189, 248, 0.14) 0%, rgba(56, 189, 248, 0) 50%), radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.04) 0%, rgba(11, 9, 18, 0.96) 62%, #06060B 100%)",
        }}
      />

      {/* Subtle Perspective Architectural Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          backgroundPosition: "center center",
          opacity: 0.55,
        }}
      />

      {/* =================================================================== */}
      {/* CAMERA STAGE */}
      {/* =================================================================== */}
      <AbsoluteFill
        style={{
          transform: `scale(${cameraScale})`,
          filter: transitionBlur > 0.2 ? `blur(${transitionBlur}px)` : "none",
          transformOrigin: "center center",
        }}
      >
        {/* 0. TOP & BOTTOM DISPLAY TYPOGRAPHY (Frames 0-191) */}
        {bandOpacity > 0.01 && (
          <WotHeaderBand
            topText={topHeadline}
            bottomText={bottomHeadline}
            beatStartFrame={beatStartFrame}
            highlightBottom={frame >= videoSwapFrame}
            opacity={bandOpacity}
          />
        )}

        {/* 1. LEFT SOURCE COMPARISON CARD IN HERO FINALE (Frames 192-269, ZERO Pills) */}
        {showSourceComparisonCard && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: cardWidth,
              height: cardHeight,
              marginLeft: -cardWidth / 2,
              marginTop: -cardHeight / 2,
              transform: `perspective(1200px) translate3d(${leftCardX}px, ${leftCardY}px, 0) scale(${leftCardScale}) rotate(${leftCardRotation}deg) rotateY(${leftCardRotateY}deg)`,
              opacity: leftCardOpacity,
              borderRadius: 28,
              overflow: "hidden",
              backgroundColor: "#0E1118",
              border: "4px solid #FFFFFF",
              boxShadow:
                "0 36px 90px rgba(0, 0, 0, 0.88), 0 12px 32px rgba(0, 0, 0, 0.65)",
              zIndex: 18,
            }}
          >
            <OffthreadVideo
              src={sourceWotVideoSrc}
              volume={0}
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        )}

        {/* 2. MAIN WALL-OF-TEXT VIDEO CARD (Source 0-67 -> Generated 68-269, ZERO Pills) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: cardWidth,
            height: cardHeight,
            marginLeft: -cardWidth / 2,
            marginTop: -cardHeight / 2,
            transform: `perspective(1200px) translate3d(${mainX}px, ${mainY}px, 0) scale(${mainScale}) rotate(${mainRotation}deg) rotateY(${mainRotateY}deg)`,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: "#0E1118",
            border:
              frame >= videoSwapFrame && frame < videoSwapFrame + 26
                ? "4px solid #7C3AED"
                : "4px solid #FFFFFF",
            boxShadow:
              frame >= videoSwapFrame && frame < videoSwapFrame + 26
                ? "0 36px 90px rgba(0, 0, 0, 0.88), 0 0 42px rgba(124, 58, 237, 0.55)"
                : "0 36px 90px rgba(0, 0, 0, 0.88), 0 12px 32px rgba(0, 0, 0, 0.65)",
            zIndex: 22,
          }}
        >
          {frame < videoSwapFrame ? (
            <OffthreadVideo
              src={sourceWotVideoSrc}
              volume={0}
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Sequence from={videoSwapFrame} layout="none">
              <OffthreadVideo
                src={recreatedWotVideoSrc}
                volume={0}
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </Sequence>
          )}

          {/* 2A. LOCKED WALL OF TEXT ON UPPER WALL OF GENERATED VIDEO (Frames 134-269, container-free) */}
          {showLockedWotText && (
            <div
              style={{
                position: "absolute",
                top: 132,
                left: 0,
                right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <RemixWallOfTextOverlay />
            </div>
          )}
        </div>

        {/* 3. FLOATING WALL OF TEXT BEFORE & DURING CURSOR DRAG (Frames 86-133, zero container) */}
        {showFloatingWotText && wotTextOpacity > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate3d(calc(-50% + ${floatingWotX}px), calc(-50% + ${floatingWotY}px), 0) scale(0.93)`,
              opacity: wotTextOpacity,
              zIndex: 46,
              pointerEvents: "none",
            }}
          >
            <RemixWallOfTextOverlay />
          </div>
        )}

        {/* 4. HIGGSFIELD SLANTED-RIBBON HERO FINALE (Frames 192-269, ZERO Pills) */}
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
                width: 1320,
                height: 640,
                background:
                  "radial-gradient(ellipse closest-side, rgba(7,8,14,0.74) 0%, rgba(7,8,14,0.34) 58%, rgba(7,8,14,0) 100%)",
                pointerEvents: "none",
              }}
            />
            <WotHeroRibbons startFrame={heroStartFrame} />
          </div>
        )}

        {/* 5. STUDIO CURSOR ACTOR (Carries Face Badge in Beat 2 & Drags Wall of Text in Beat 4) */}
        <CursorActor
          x={cursorX}
          y={cursorY}
          opacity={cursorOpacity}
          isGrabbing={cursorGrabbing}
          clickFrame={activeClickFrame}
          payload={cursorPayload}
          payloadOffset={cursorPayloadOffset}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
