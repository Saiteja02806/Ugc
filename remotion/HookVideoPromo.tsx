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
import {
  KlickpinHeaderBand,
  PerspectiveFoldTypography,
} from "./effects/PerspectiveFoldTypography";

/**
 * InfluencerPortraitBadge renders the clean, borderless creator identity photo card
 * that the cursor drags onto the viral Hook video's face to swap the creator
 * (no blue outer border line and no badges).
 */
const InfluencerPortraitBadge: React.FC<{
  src: string;
}> = ({ src }) => {
  return (
    <div
      style={{
        width: 118,
        height: 154,
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

/**
 * RemixHookTextOverlay renders the clean, native TikTok-style hook text
 * ("Coding for 6 months ❌ / This can make content for me ✅") with zero container,
 * zero blue border, and zero badges — matching the size and natural look of the
 * source video's hook text before and after the cursor drags it into place.
 */
const RemixHookTextOverlay: React.FC = () => {
  const thinStrokeShadow =
    "-0.85px -0.85px 0 rgba(0, 0, 0, 0.82), 0.85px -0.85px 0 rgba(0, 0, 0, 0.82), -0.85px 0.85px 0 rgba(0, 0, 0, 0.82), 0.85px 0.85px 0 rgba(0, 0, 0, 0.82), 0px 1.5px 4px rgba(0, 0, 0, 0.35)";
  const emojiShadow = "0px 1.5px 4px rgba(0, 0, 0, 0.35)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 600,
          fontSize: 21.5,
          lineHeight: 1.24,
          letterSpacing: "-0.015em",
          color: "#FFFFFF",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ textShadow: thinStrokeShadow }}>Coding for 6 months </span>
        <span style={{ textShadow: emojiShadow }}>❌</span>
      </div>
      <div
        style={{
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 600,
          fontSize: 21.5,
          lineHeight: 1.24,
          letterSpacing: "-0.015em",
          color: "#FFFFFF",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ textShadow: thinStrokeShadow }}>
          This can make content for me{" "}
        </span>
        <span style={{ textShadow: emojiShadow }}>✅</span>
      </div>
    </div>
  );
};

export const HookVideoPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Authentic Hook Video Assets (Viral Glasses Hook -> Face Reference -> Changed-Face Glasses Hook -> Product Demo)
  const exploreHookVideoSrc = staticFile(
    "explore/covers/sources/hook-explore-video.mp4"
  );
  const recreatedHookVideoSrc = staticFile(
    "explore/covers/sources/hook-recreated-video.mp4"
  );
  const productDemoVideoSrc = staticFile(
    "explore/covers/sources/hook-demo-video.mp4"
  );
  const influencerFaceSrc = staticFile(
    "explore/covers/sources/hook-influencer-face.jpg"
  );
  const plusSymbolSrc = staticFile("explore/covers/sources/plus-symbol.png");

  // =========================================================================
  // KEY CHOREOGRAPHY TIMESTAMPS (30 FPS, 270 Frames = 9.00s — NOT 10.0s)
  // =========================================================================
  // - Frame 000-039 (0.00s-1.30s): Source Hook Video plays unobstructed first ("Part time job ❌ / Coloring Books ✅")
  // - Frame 040-066 (1.33s-2.20s): Cursor enters with clean Reference Face photo (no blue border) & drops it on her face
  // - Frame 068-079 (2.27s-2.63s): Swaps seamlessly to Changed-Face Hook Video (zero face glow, no docked corner image)
  // - Frame 080-124 (2.67s-4.13s): Subtle container-free Remix Hook Text appears outside on right -> cursor drags onto upper wall
  // - Frame 140-191 (4.67s-6.37s): Early Product Demo pull-up & dual-card lockup with + symbol (eliminates any 6s replay lag)
  // - Frame 192-269 (6.40s-9.00s): Higgsfield AI 4-tier slanted ribbon hero finale ("VIDMAKE • HOOK STUDIO")
  const cursorEnterFrame = 40;
  const faceDropFrame = 66;
  const videoSwapFrame = 68;

  const remixCardEnterFrame = 80;
  const remixGrabFrame = 92;
  const remixDropFrame = 124;

  const demoPullStartFrame = 140;
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
  // HOOK VIDEO CARD (Source Hook 0-67 -> Changed-Face Hook 68-269, NO Face Glow)
  // =========================================================================
  const cardWidth = 436;
  const cardHeight = 775;

  const hookTransformPop =
    frame >= videoSwapFrame && frame < demoPullStartFrame
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

  let hookX = 0;
  let hookY = 0;
  let hookScale = 0.93 * hookTransformPop;
  let hookRotateY = interpolate(frame, [0, cursorEnterFrame], [-4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let hookRotation = interpolate(frame, [0, cursorEnterFrame], [-1.0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame >= demoPullStartFrame && frame < heroStartFrame) {
    const pairSpr = spring({
      frame: frame - demoPullStartFrame,
      fps,
      config: { damping: 12, mass: 0.42, stiffness: 340 },
    });
    hookX = interpolate(pairSpr, [0, 1], [0, -295]);
    hookScale = interpolate(pairSpr, [0, 1], [0.93, 0.88]);
    hookRotateY = interpolate(pairSpr, [0, 1], [0, 9]);
    hookRotation = interpolate(pairSpr, [0, 1], [0, -2]);
  } else if (frame >= heroStartFrame) {
    const heroSpr = spring({
      frame: frame - heroStartFrame,
      fps,
      config: { damping: 14, mass: 0.42, stiffness: 340 },
    });
    hookX = interpolate(heroSpr, [0, 1], [-295, -535]);
    hookY = interpolate(heroSpr, [0, 1], [0, -6]);
    hookScale = interpolate(heroSpr, [0, 1], [0.88, 1.02]);
    hookRotateY = interpolate(heroSpr, [0, 1], [9, 6]);
    hookRotation = interpolate(heroSpr, [0, 1], [-2, -2.4]);
  }

  // =========================================================================
  // SUBTLE REMIX HOOK TEXT APPEARANCE & DRAG TRAJECTORY (Frames 80-124)
  // =========================================================================
  const showFloatingRemixText =
    frame >= remixCardEnterFrame && frame < remixDropFrame;
  const remixTextOpacity = interpolate(
    frame,
    [remixCardEnterFrame, remixCardEnterFrame + 8],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const remixDragProgress =
    frame >= remixGrabFrame
      ? interpolate(frame, [remixGrabFrame, remixDropFrame], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  // Smooth ease-in-out curve from outside on the right (410, 65) to centered upper wall (0, -231)
  const remixDragEased =
    remixDragProgress < 0.5
      ? 2 * remixDragProgress * remixDragProgress
      : 1 - Math.pow(-2 * remixDragProgress + 2, 2) / 2;

  const floatingRemixX = interpolate(remixDragEased, [0, 1], [410, 0]);
  const floatingRemixLinearY = interpolate(remixDragEased, [0, 1], [65, -231]);
  const floatingRemixArcLift = Math.sin(remixDragEased * Math.PI) * -28;
  const floatingRemixY = floatingRemixLinearY + floatingRemixArcLift;

  // On-Video Remixed Hook Text Overlay locked inside Hook Card from Frame 168 onwards
  const showLockedRemixedText = frame >= remixDropFrame;

  // =========================================================================
  // ULTRA-FAST PRODUCT DEMO PULL-UP AT 7.53 SECONDS (Frame 226)
  // =========================================================================
  const showDemoCard = frame >= demoPullStartFrame - 2;
  const fastPullSpr = spring({
    frame: Math.max(0, frame - (demoPullStartFrame - 2)),
    fps,
    config: { damping: 16, mass: 0.44, stiffness: 360 },
  });

  let demoX = interpolate(fastPullSpr, [0, 1], [540, 295]);
  let demoY = Math.max(-8, interpolate(fastPullSpr, [0, 1], [360, 0]));
  let demoScale = Math.min(0.9, interpolate(fastPullSpr, [0, 1], [0.46, 0.88]));
  let demoRotateY = interpolate(fastPullSpr, [0, 1], [-18, -9]);
  let demoRotation = interpolate(fastPullSpr, [0, 1], [8, 2]);
  const demoOpacity = interpolate(
    frame,
    [demoPullStartFrame - 2, demoPullStartFrame + 2],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  if (frame >= heroStartFrame) {
    const heroSpr = spring({
      frame: frame - heroStartFrame,
      fps,
      config: { damping: 14, mass: 0.42, stiffness: 340 },
    });
    demoX = interpolate(heroSpr, [0, 1], [295, 535]);
    demoY = interpolate(heroSpr, [0, 1], [0, 8]);
    demoScale = interpolate(heroSpr, [0, 1], [0.88, 1.02]);
    demoRotateY = interpolate(heroSpr, [0, 1], [-9, -6]);
    demoRotation = interpolate(heroSpr, [0, 1], [2, 2.4]);
  }

  // =========================================================================
  // 3D PLUS SYMBOL CONNECTOR (`plus-symbol.png`) WHEN CARDS MEET
  // =========================================================================
  const showConnector = frame >= demoPullStartFrame + 4;
  const plusSpring = spring({
    frame: Math.max(0, frame - (demoPullStartFrame + 4)),
    fps,
    config: { damping: 9, mass: 0.45, stiffness: 320 },
  });
  const plusScale =
    frame < heroStartFrame
      ? interpolate(plusSpring, [0, 1], [0.1, 1.05])
      : interpolate(
          spring({
            frame: frame - heroStartFrame,
            fps,
            config: { damping: 12, mass: 0.6, stiffness: 200 },
          }),
          [0, 1],
          [1.05, 0.65]
        );
  const plusRotate =
    frame < heroStartFrame ? interpolate(plusSpring, [0, 1], [-24, -4]) : -8;
  const plusOpacity =
    frame < heroStartFrame
      ? interpolate(
          frame,
          [demoPullStartFrame + 4, demoPullStartFrame + 8],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }
        )
      : interpolate(frame, [heroStartFrame, heroStartFrame + 8], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // =========================================================================
  // CURSOR TRAJECTORY (1: Face Swap -> 2: Remix Hook Text Drag -> 3: Demo Pull)
  // =========================================================================
  let cursorX = -720;
  let cursorY = 240;
  let cursorOpacity = 0;
  let cursorGrabbing = false;
  let cursorPayload: React.ReactNode = undefined;
  let cursorPayloadOffset = { x: -58, y: -74 };
  let activeClickFrame: number | undefined = undefined;

  if (frame >= cursorEnterFrame && frame <= faceDropFrame) {
    // 1. Enter at Frame 40 & drag clean Reference Face directly onto the woman's face (x: 16, y: -42)
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
    cursorX = interpolate(eased, [0, 1], [-640, 16]);
    cursorY = interpolate(eased, [0, 1], [120, -42]);
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
    cursorPayload = <InfluencerPortraitBadge src={influencerFaceSrc} />;
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
    cursorX = interpolate(easedExit, [0, 1], [16, 260]);
    cursorY = interpolate(easedExit, [0, 1], [-42, -180]);
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
  } else if (frame >= remixCardEnterFrame && frame <= remixDropFrame + 12) {
    // 2. Cursor moves to bottom-right edge of the floating Remix Hook Text outside on the right (410 + 95, 65 + 22),
    //    grabs it at Frame 92, and glides it smoothly into place on the upper wall (0, -231) at Frame 124!
    const cursorGripOffsetX = 95;
    const cursorGripOffsetY = 22;
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
        [540, 410 + cursorGripOffsetX]
      );
      cursorY = interpolate(
        easedEnter,
        [0, 1],
        [185, 65 + cursorGripOffsetY]
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
      cursorX = floatingRemixX + cursorGripOffsetX;
      cursorY = floatingRemixY + cursorGripOffsetY;
      cursorOpacity = 1;
      cursorGrabbing = true;
    } else {
      // Glide away cleanly after placing Remixed Hook Text at Frame 124
      const releaseProgress = interpolate(
        frame,
        [remixDropFrame + 1, remixDropFrame + 12],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      cursorX = interpolate(
        releaseProgress,
        [0, 1],
        [0 + cursorGripOffsetX, 215]
      );
      cursorY = interpolate(
        releaseProgress,
        [0, 1],
        [-231 + cursorGripOffsetY, -295]
      );
      cursorOpacity = interpolate(
        frame,
        [remixDropFrame + 6, remixDropFrame + 12],
        [1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      cursorGrabbing = false;
    }
  } else if (frame >= demoPullStartFrame - 6 && frame <= demoPullStartFrame + 22) {
    // 3. Fast whip pull-up of the Product Demo card (frames 218-248)
    const pullStart = demoPullStartFrame - 2;
    const enterForPull = interpolate(
      frame,
      [demoPullStartFrame - 8, pullStart],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
    if (frame <= pullStart) {
      cursorX = interpolate(enterForPull, [0, 1], [620, 540]);
      cursorY = interpolate(enterForPull, [0, 1], [420, 360]);
      cursorOpacity = enterForPull;
      cursorGrabbing = frame >= pullStart - 1;
    } else if (frame <= demoPullStartFrame + 10) {
      cursorX = demoX + 18;
      cursorY = demoY + 24;
      cursorOpacity = 1;
      cursorGrabbing = true;
      activeClickFrame = demoPullStartFrame + 8;
    } else {
      cursorX = interpolate(
        frame,
        [demoPullStartFrame + 10, demoPullStartFrame + 22],
        [313, 390],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      cursorY = interpolate(
        frame,
        [demoPullStartFrame + 10, demoPullStartFrame + 22],
        [24, 130],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      cursorOpacity = interpolate(
        frame,
        [demoPullStartFrame + 14, demoPullStartFrame + 22],
        [1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );
      cursorGrabbing = false;
      activeClickFrame = demoPullStartFrame + 8;
    }
  }

  // =========================================================================
  // KLICKPIN TOP & BOTTOM DISPLAY BANDS (Frames 0-285)
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
      ? "VIRAL HOOK"
      : frame < videoSwapFrame
        ? "DRAG NEW FACE"
        : frame < remixCardEnterFrame
          ? "SAME MOTION"
          : frame < demoPullStartFrame
            ? "REMIX HOOK TEXT"
            : "VIRAL HOOK";

  const bottomHeadline =
    frame < cursorEnterFrame
      ? "SOURCE VIDEO"
      : frame < videoSwapFrame
        ? "TO HOOK VIDEO"
        : frame < remixCardEnterFrame
          ? "HOOK RECREATED"
          : frame < demoPullStartFrame
            ? "FOR YOUR BUSINESS"
            : "+ PRODUCT DEMO";

  const beatStartFrame =
    frame < cursorEnterFrame
      ? 0
      : frame < videoSwapFrame
        ? cursorEnterFrame
        : frame < remixCardEnterFrame
          ? videoSwapFrame
          : frame < demoPullStartFrame
            ? remixCardEnterFrame
            : demoPullStartFrame;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#07080C",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Genjutsu-Inspired Dual Studio Backdrop (Hot Viral Magenta + Electric Cyan Aura) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 28% 36%, rgba(255, 23, 107, 0.16) 0%, rgba(255, 23, 107, 0) 48%), radial-gradient(circle at 72% 64%, rgba(0, 240, 255, 0.13) 0%, rgba(0, 240, 255, 0) 50%), radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.04) 0%, rgba(11, 9, 18, 0.96) 62%, #06060B 100%)",
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
        {/* 0. KLICKPIN TOP & BOTTOM DISPLAY TYPOGRAPHY (Frames 0-285) */}
        {bandOpacity > 0.01 && (
          <KlickpinHeaderBand
            topText={topHeadline}
            bottomText={bottomHeadline}
            beatStartFrame={beatStartFrame}
            highlightBottom={frame >= videoSwapFrame}
            opacity={bandOpacity}
          />
        )}

        {/* 1. HOOK VIDEO CARD (Source Hook 0-81 -> Changed-Face Hook 82-359) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: cardWidth,
            height: cardHeight,
            marginLeft: -cardWidth / 2,
            marginTop: -cardHeight / 2,
            transform: `perspective(1200px) translate3d(${hookX}px, ${hookY}px, 0) scale(${hookScale}) rotate(${hookRotation}deg) rotateY(${hookRotateY}deg)`,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: "#0E1118",
            border:
              frame >= videoSwapFrame && frame < videoSwapFrame + 26
                ? "4px solid #FF176B"
                : "4px solid #FFFFFF",
            boxShadow:
              frame >= videoSwapFrame && frame < videoSwapFrame + 26
                ? "0 36px 90px rgba(0, 0, 0, 0.88), 0 0 42px rgba(255, 23, 107, 0.45)"
                : "0 36px 90px rgba(0, 0, 0, 0.88), 0 12px 32px rgba(0, 0, 0, 0.65)",
            zIndex: 20,
          }}
        >
          {frame < videoSwapFrame ? (
            <OffthreadVideo
              src={exploreHookVideoSrc}
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
                src={recreatedHookVideoSrc}
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

          {/* 1A. LOCKED REMIXED HOOK TEXT ON UPPER WALL OF VIDEO (Frames 124-269, subtle & container-free) */}
          {showLockedRemixedText && (
            <div
              style={{
                position: "absolute",
                top: 108,
                left: 0,
                right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <RemixHookTextOverlay />
            </div>
          )}
        </div>

        {/* 1B. HIGGSFIELD-STYLE TILTED STICKER CALLOUT ON HOOK CARD (Frames 142-191) */}
        {frame >= demoPullStartFrame + 2 && frame < heroStartFrame && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate3d(calc(-50% + ${hookX - 115}px), calc(-50% + ${hookY + 265}px), 0) rotate(-6deg)`,
              zIndex: 38,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                backgroundColor: "#FF176B",
                color: "#FFFFFF",
                padding: "8px 20px",
                borderRadius: 12,
                border: "2.5px solid #FFFFFF",
                boxShadow:
                  "0 14px 32px rgba(0,0,0,0.85), 0 0 24px rgba(255,23,107,0.5)",
                fontFamily:
                  "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
                fontWeight: 900,
                fontSize: 22,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              RECREATED HOOK
            </div>
          </div>
        )}

        {/* 2C. FLOATING REMIX HOOK TEXT BEFORE & DURING CURSOR DRAG (Frames 80-123, zero container) */}
        {showFloatingRemixText && remixTextOpacity > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate3d(calc(-50% + ${floatingRemixX}px), calc(-50% + ${floatingRemixY}px), 0) scale(0.93)`,
              opacity: remixTextOpacity,
              zIndex: 46,
              pointerEvents: "none",
            }}
          >
            <RemixHookTextOverlay />
          </div>
        )}

        {/* 3. PRODUCT DEMO CARD (Enters at 7.53s / Frame 226 with ULTRA-FAST Pull-Up) */}
        {showDemoCard && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: cardWidth,
              height: cardHeight,
              marginLeft: -cardWidth / 2,
              marginTop: -cardHeight / 2,
              transform: `perspective(1200px) translate3d(${demoX}px, ${demoY}px, 0) scale(${demoScale}) rotate(${demoRotation}deg) rotateY(${demoRotateY}deg)`,
              opacity: demoOpacity,
              borderRadius: 28,
              overflow: "hidden",
              backgroundColor: "#0E1118",
              border:
                frame >= demoPullStartFrame - 2 &&
                frame <= demoPullStartFrame + 36
                  ? "4px solid #00F0FF"
                  : "4px solid #FFFFFF",
              boxShadow:
                frame >= demoPullStartFrame - 2 &&
                frame <= demoPullStartFrame + 36
                  ? "0 36px 90px rgba(0, 0, 0, 0.88), 0 0 40px rgba(0, 240, 255, 0.42)"
                  : "0 36px 90px rgba(0, 0, 0, 0.88), 0 12px 32px rgba(0, 0, 0, 0.65)",
              zIndex: 22,
            }}
          >
            <Sequence from={demoPullStartFrame - 2} layout="none">
              <OffthreadVideo
                src={productDemoVideoSrc}
                volume={0}
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </Sequence>
          </div>
        )}

        {/* 3B. HIGGSFIELD-STYLE TILTED STICKER CALLOUT ON DEMO CARD (Frames 230-285) */}
        {frame >= demoPullStartFrame + 4 && frame < heroStartFrame && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate3d(calc(-50% + ${demoX + 108}px), calc(-50% + ${demoY + 265}px), 0) rotate(5deg)`,
              zIndex: 38,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                backgroundColor: "#00F0FF",
                color: "#07080C",
                padding: "8px 20px",
                borderRadius: 12,
                border: "2.5px solid #07080C",
                boxShadow:
                  "0 14px 32px rgba(0,0,0,0.85), 0 0 24px rgba(0,240,255,0.45)",
                fontFamily:
                  "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
                fontWeight: 900,
                fontSize: 22,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              PRODUCT DEMO
            </div>
          </div>
        )}

        {/* 4. CUSTOM 3D POP-ART PLUS SYMBOL CONNECTOR (`plus-symbol.png`) WHEN CARDS MEET */}
        {showConnector && plusOpacity > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) scale(${plusScale}) rotate(${plusRotate}deg)`,
              opacity: plusOpacity,
              zIndex: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Img
              src={plusSymbolSrc}
              style={{
                width: 132,
                height: 132,
                objectFit: "contain",
                filter:
                  "drop-shadow(0 0 2.5px #FFFFFF) drop-shadow(0 16px 32px rgba(0, 0, 0, 0.85))",
              }}
            />
          </div>
        )}

        {/* 5. HIGGSFIELD SLANTED-RIBBON HERO FINALE (Frames 286-359) */}
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
            <PerspectiveFoldTypography startFrame={heroStartFrame} />
          </div>
        )}

        {/* 6. STUDIO CURSOR ACTOR (Carries Face Badge in Beat 2 & Remix Text Card in Beat 4) */}
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
