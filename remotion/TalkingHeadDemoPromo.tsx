import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CursorActor } from "./effects/CursorActor";
import {
  AudioActivationPulse,
  AudioWaveformBadge,
} from "./effects/AudioActivationPulse";
import { StackedKineticTypography } from "./effects/StackedKineticTypography";

export const TalkingHeadDemoPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Authentic V6 Creator & Product Demo Assets + Custom Motion Assets
  const startPortraitSrc = staticFile(
    "explore/covers/sources/talking-head-start.png"
  );
  const talkingHeadVideoSrc = staticFile(
    "explore/covers/sources/talking-head-source.mp4"
  );
  const productDemoVideoSrc = staticFile(
    "explore/covers/sources/product-demo-source.mp4"
  );
  const plusSymbolSrc = staticFile(
    "explore/covers/sources/plus-symbol.png"
  );

  // =========================================================================
  // KEY CHOREOGRAPHY TIMESTAMPS (30 FPS, 300 Frames = 10.0s)
  // =========================================================================
  // - Frame 008-036 (0.27s-1.20s): Cursor drags pure `audio_video.mp4` onto portrait
  // - Frame 036-064 (1.20s-2.13s): V2B-style `GENERATE` button pops up; cursor clicks it at Frame 56
  // - Frame 056-149 (1.87s-5.00s): Talking Head POP-UP & live speaking hold
  // - Frame 150-160 (5.00s-5.33s): ULTRA-FAST Product Demo pull-up & dual-card lockup
  // - Frame 195-299 (6.50s-10.0s): Camera punch + Hero Stacked Kinetic Typography
  const audioDropFrame = 36;
  const generateClickFrame = 56;
  const demoPullStartFrame = 150;

  // =========================================================================
  // GLOBAL CAMERA & DIRECTIONAL BLUR (1920x1080 16:9 Canvas)
  // =========================================================================
  let cameraScale = interpolate(frame, [0, 56], [0.96, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame >= 56 && frame < 180) {
    const popPunch = spring({
      frame: frame - 56,
      fps,
      config: { damping: 11, mass: 0.45, stiffness: 260 },
    });
    cameraScale = interpolate(popPunch, [0, 1], [0.98, 1.02]);
  } else if (frame >= 180 && frame < 196) {
    const pushProgress = interpolate(frame, [180, 194], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    cameraScale = interpolate(pushProgress, [0, 1], [1.02, 1.16]);
  } else if (frame >= 196) {
    const endSpring = spring({
      frame: frame - 196,
      fps,
      config: { damping: 12, mass: 0.6, stiffness: 220 },
    });
    const baseEndScale = interpolate(endSpring, [0, 1], [1.12, 1.0]);
    const finalPunch =
      frame >= 240
        ? interpolate(
            spring({
              frame: frame - 240,
              fps,
              config: { damping: 11, mass: 0.5, stiffness: 260 },
            }),
            [0, 1],
            [0, 0.03]
          )
        : 0;
    cameraScale = baseEndScale + finalPunch;
  }

  // Transition motion blur during fast camera push (frames 184-196)
  const transitionBlur =
    frame >= 184 && frame <= 198
      ? interpolate(frame, [184, 191, 198], [0, 5, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  // =========================================================================
  // TALKING HEAD CARD (Still Portrait 0-55 -> Pops Up Alive at Frame 56 on GENERATE click)
  // =========================================================================
  const cardWidth = 436;
  const cardHeight = 775;

  // Subtle recoil when audio drops at frame 36
  const audioDropBounce =
    frame >= audioDropFrame && frame < generateClickFrame
      ? interpolate(
          spring({
            frame: frame - audioDropFrame,
            fps,
            config: { damping: 10, mass: 0.4, stiffness: 280 },
          }),
          [0, 0.5, 1],
          [1, 1.03, 1]
        )
      : 1;

  // Explosive POP-UP when GENERATE is clicked at frame 56!
  const talkingHeadPopUp =
    frame >= generateClickFrame && frame < demoPullStartFrame
      ? interpolate(
          spring({
            frame: frame - generateClickFrame,
            fps,
            config: { damping: 8.5, mass: 0.45, stiffness: 320 },
          }),
          [0, 0.45, 1],
          [0.82, 1.08, 1]
        )
      : 1;

  let thX = 0;
  let thY = 0;
  let thScale = 0.92 * audioDropBounce * talkingHeadPopUp;
  let thRotateY = interpolate(frame, [0, 56], [-8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let thRotation = interpolate(frame, [0, 56], [-1.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame >= demoPullStartFrame && frame < 195) {
    // Fast snap left at 5.0s (Frame 150) as Product Demo pulls up fast
    const pairSpr = spring({
      frame: frame - demoPullStartFrame,
      fps,
      config: { damping: 12, mass: 0.42, stiffness: 340 },
    });
    thX = interpolate(pairSpr, [0, 1], [0, -295]);
    thScale = interpolate(pairSpr, [0, 1], [0.92, 0.88]);
    thRotateY = interpolate(pairSpr, [0, 1], [0, 9]);
    thRotation = interpolate(pairSpr, [0, 1], [0, -2]);
  } else if (frame >= 195) {
    // Hero Ending: Swing into left background
    const heroSpr = spring({
      frame: frame - 195,
      fps,
      config: { damping: 13, mass: 0.7, stiffness: 190 },
    });
    thX = interpolate(heroSpr, [0, 1], [-295, -495]);
    thY = interpolate(heroSpr, [0, 1], [0, -8]);
    thScale = interpolate(heroSpr, [0, 1], [0.88, 1.06]);
    thRotateY = interpolate(heroSpr, [0, 1], [9, 16]);
    thRotation = interpolate(heroSpr, [0, 1], [-2, -4]);
  }

  // =========================================================================
  // V2B-STYLE "GENERATE" BUTTON (Appears after Audio Drop at Frame 36, Clicked at Frame 56)
  // =========================================================================
  const showGenerateBtn = frame >= 36 && frame <= 65;
  const genEnterSpr = spring({
    frame: Math.max(0, frame - 36),
    fps,
    config: { damping: 11, mass: 0.42, stiffness: 300 },
  });
  const isHoveringGenerate = frame >= 46 && frame < generateClickFrame;
  const isClickingGenerate = frame >= generateClickFrame;

  const genClickPress =
    frame >= generateClickFrame
      ? interpolate(frame, [56, 58, 64], [1, 0.86, 1.18], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const genScale =
    interpolate(genEnterSpr, [0, 1], [0.5, isHoveringGenerate ? 1.06 : 1]) *
    genClickPress;
  const genOpacity =
    frame < generateClickFrame
      ? interpolate(frame, [36, 41], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(frame, [56, 64], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // =========================================================================
  // ULTRA-FAST PRODUCT DEMO PULL-UP AT 5.0 SECONDS (Frame 150)
  // =========================================================================
  const showDemoCard = frame >= 148;
  const fastPullSpr = spring({
    frame: Math.max(0, frame - 148),
    fps,
    config: { damping: 11.5, mass: 0.38, stiffness: 380 },
  });

  let demoX = interpolate(fastPullSpr, [0, 1], [540, 295]);
  let demoY = interpolate(fastPullSpr, [0, 1], [360, 0]);
  let demoScale = interpolate(fastPullSpr, [0, 1], [0.46, 0.88]);
  let demoRotateY = interpolate(fastPullSpr, [0, 1], [-18, -9]);
  let demoRotation = interpolate(fastPullSpr, [0, 1], [8, 2]);
  const demoOpacity = interpolate(frame, [148, 152], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame >= 195) {
    // Hero Ending: Swing into right background with perspective rotation
    const heroSpr = spring({
      frame: frame - 195,
      fps,
      config: { damping: 13, mass: 0.7, stiffness: 190 },
    });
    demoX = interpolate(heroSpr, [0, 1], [295, 495]);
    demoY = interpolate(heroSpr, [0, 1], [0, 10]);
    demoScale = interpolate(heroSpr, [0, 1], [0.88, 1.06]);
    demoRotateY = interpolate(heroSpr, [0, 1], [-9, -16]);
    demoRotation = interpolate(heroSpr, [0, 1], [2, 4]);
  }

  // =========================================================================
  // CUSTOM 3D PLUS SYMBOL CONNECTOR (`plus-symbol.png`) WHEN CARDS MEET
  // =========================================================================
  const showConnector = frame >= 155;
  const plusSpring = spring({
    frame: Math.max(0, frame - 155),
    fps,
    config: { damping: 9, mass: 0.45, stiffness: 320 },
  });
  const plusScale =
    frame < 195
      ? interpolate(plusSpring, [0, 1], [0.1, 1.05])
      : interpolate(
          spring({
            frame: frame - 195,
            fps,
            config: { damping: 12, mass: 0.6, stiffness: 200 },
          }),
          [0, 1],
          [1.05, 0.65]
        );
  const plusRotate =
    frame < 195
      ? interpolate(plusSpring, [0, 1], [-24, -4])
      : -8;
  const plusOpacity =
    frame < 195
      ? interpolate(frame, [155, 159], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(frame, [195, 204], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // =========================================================================
  // CURSOR TRAJECTORY
  // =========================================================================
  let cursorX = -720;
  let cursorY = 260;
  let cursorOpacity = 0;
  let cursorGrabbing = false;
  let showAudioPayload = false;
  let activeClickFrame: number | undefined = undefined;

  if (frame >= 6 && frame <= audioDropFrame) {
    // 1. Drag pure `audio_video.mp4` onto portrait card (frames 6-36)
    const moveProgress = interpolate(frame, [6, audioDropFrame], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const eased = 1 - Math.pow(1 - moveProgress, 3);
    cursorX = interpolate(eased, [0, 1], [-680, 12]);
    cursorY = interpolate(eased, [0, 1], [240, 24]);
    cursorOpacity = interpolate(frame, [6, 13], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    cursorGrabbing = true;
    showAudioPayload = true;
    activeClickFrame = audioDropFrame;
  } else if (frame > audioDropFrame && frame <= 78) {
    // 2. Move down to the `GENERATE` button (frames 37-50), click at Frame 56, then glide aside
    const toGen = interpolate(frame, [37, 49], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const easedToGen = 1 - Math.pow(1 - toGen, 2.5);
    const awayFromGen =
      frame > 58
        ? interpolate(frame, [58, 78], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 0;
    cursorX =
      interpolate(easedToGen, [0, 1], [12, 34]) +
      interpolate(awayFromGen, [0, 1], [0, 210]);
    cursorY =
      interpolate(easedToGen, [0, 1], [24, 222]) +
      interpolate(awayFromGen, [0, 1], [0, 60]);
    cursorOpacity = interpolate(frame, [68, 78], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    cursorGrabbing = frame >= 55 && frame <= 59;
    activeClickFrame = generateClickFrame;
  } else if (frame >= 142 && frame <= 174) {
    // 3. At 5.0s (Frame 150), fast whip pull-up of the Product Demo card!
    const enterForPull = interpolate(frame, [142, 148], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (frame <= 148) {
      cursorX = interpolate(enterForPull, [0, 1], [620, 540]);
      cursorY = interpolate(enterForPull, [0, 1], [420, 360]);
      cursorOpacity = enterForPull;
      cursorGrabbing = frame >= 147;
    } else if (frame <= 160) {
      cursorX = demoX + 18;
      cursorY = demoY + 24;
      cursorOpacity = 1;
      cursorGrabbing = true;
      activeClickFrame = 158;
    } else {
      cursorX = interpolate(frame, [160, 174], [313, 390], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      cursorY = interpolate(frame, [160, 174], [24, 130], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      cursorOpacity = interpolate(frame, [164, 174], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      cursorGrabbing = false;
      activeClickFrame = 158;
    }
  }

  // =========================================================================
  // INITIAL TOP & BOTTOM DISPLAY TYPOGRAPHY (Frames 0-194)
  // =========================================================================
  const initialTypoSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.55, stiffness: 210 },
  });
  const initialTypoOpacity =
    frame < 195
      ? interpolate(frame, [0, 10, 182, 194], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  // Top line text & bottom line text evolve across the beats:
  // Beat 1 (0-55): "ADD VOICE" (top) / "CLICK GENERATE" (bottom once audio drops) or "TO PORTRAIT"
  // Beat 2 (56-149): "TALKING HEAD" (top) / "GOES LIVE" (bottom)
  // Beat 3 (150-194): "TALKING HEAD" (top) / "+ PRODUCT DEMO" (bottom)
  const topHeadline =
    frame < generateClickFrame ? "ADD VOICE" : "TALKING HEAD";
  const bottomHeadline =
    frame < audioDropFrame
      ? "TO PORTRAIT"
      : frame < generateClickFrame
        ? "CLICK GENERATE"
        : frame < demoPullStartFrame
          ? "GOES LIVE"
          : "+ PRODUCT DEMO";

  // Pop animation on beat changes (frame 0, frame 36, frame 56, frame 150)
  const beatStart =
    frame < audioDropFrame
      ? 0
      : frame < generateClickFrame
        ? audioDropFrame
        : frame < demoPullStartFrame
          ? generateClickFrame
          : demoPullStartFrame;
  const beatSpring = spring({
    frame: Math.max(0, frame - beatStart),
    fps,
    config: { damping: 11, mass: 0.5, stiffness: 240 },
  });
  const beatScale = interpolate(beatSpring, [0, 1], [0.9, 1]);
  const beatY = interpolate(beatSpring, [0, 1], [12, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#07080C",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Clean Dark Studio Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.045) 0%, rgba(11, 13, 20, 0.96) 62%, #06070B 100%)",
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
          filter:
            transitionBlur > 0.2 ? `blur(${transitionBlur}px)` : "none",
          transformOrigin: "center center",
        }}
      >
        {/* 0. INITIAL TOP & BOTTOM DISPLAY TYPOGRAPHY (Frames 0-194) */}
        {initialTypoOpacity > 0.01 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 46,
              paddingBottom: 44,
              opacity: initialTypoOpacity,
              transform: `translate3d(0, ${beatY}px, 0) scale(${beatScale * interpolate(initialTypoSpring, [0, 1], [0.94, 1])})`,
              zIndex: 35,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {/* Upper Bold Filled Display Line (Top Zone Above Video Card) */}
            <div
              style={{
                fontFamily:
                  "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: 94,
                lineHeight: 0.9,
                letterSpacing: "-0.025em",
                color: "#FFFFFF",
                textShadow:
                  "0 0 32px rgba(255, 255, 255, 0.32), 0 12px 32px rgba(0, 0, 0, 0.9)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {topHeadline}
            </div>

            {/* Lower Bold Filled Display Line (Bottom Zone Below Video Card) */}
            <div
              style={{
                fontFamily:
                  "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: 90,
                lineHeight: 0.9,
                letterSpacing: "-0.025em",
                color:
                  frame >= generateClickFrame
                    ? "#FFE50E"
                    : frame >= audioDropFrame
                      ? "#FFFFFF"
                      : "rgba(255, 255, 255, 0.82)",
                textShadow:
                  frame >= generateClickFrame
                    ? "0 0 34px rgba(255, 229, 14, 0.38), 0 12px 32px rgba(0, 0, 0, 0.9)"
                    : "0 0 28px rgba(255, 255, 255, 0.24), 0 12px 32px rgba(0, 0, 0, 0.9)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {bottomHeadline}
            </div>
          </div>
        )}

        {/* 1. TALKING HEAD CARD (Still Portrait 0-55 -> Pops Up Live `v6/creator-1.mp4` at Frame 56) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: cardWidth,
            height: cardHeight,
            marginLeft: -cardWidth / 2,
            marginTop: -cardHeight / 2,
            transform: `perspective(1200px) translate3d(${thX}px, ${thY}px, 0) scale(${thScale}) rotate(${thRotation}deg) rotateY(${thRotateY}deg)`,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: "#0E1118",
            border:
              frame >= generateClickFrame && frame < 96
                ? "4px solid #FFE50E"
                : "4px solid #FFFFFF",
            boxShadow:
              "0 36px 90px rgba(0, 0, 0, 0.88), 0 12px 32px rgba(0, 0, 0, 0.65)",
            zIndex: 20,
          }}
        >
          {frame < generateClickFrame ? (
            <Img
              src={startPortraitSrc}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.03) saturate(0.96)",
              }}
            />
          ) : (
            <OffthreadVideo
              src={talkingHeadVideoSrc}
              volume={0}
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
        </div>

        {/* 2. SUBTLE AUDIO ACTIVATION PULSE & COMPACT CORNER BADGE (Drops at Frame 36) */}
        <AudioActivationPulse
          triggerFrame={audioDropFrame}
          durationFrames={88}
          x={thX}
          y={thY}
        />

        {/* 2B. V2B-STYLE "GENERATE" BUTTON (Frames 36-64; Cursor clicks at Frame 56 -> Talking Head Pops Up) */}
        {showGenerateBtn && genOpacity > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate3d(-50%, calc(-50% + 210px), 0) scale(${genScale})`,
              opacity: genOpacity,
              zIndex: 50,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 36px",
                borderRadius: 999,
                background: isClickingGenerate
                  ? "linear-gradient(135deg, #FFE50E 0%, #FF9900 100%)"
                  : isHoveringGenerate
                    ? "linear-gradient(135deg, rgba(24, 28, 40, 0.96) 0%, rgba(14, 17, 26, 0.98) 100%)"
                    : "rgba(14, 17, 26, 0.92)",
                border:
                  isHoveringGenerate || isClickingGenerate
                    ? "2.5px solid #FFE50E"
                    : "2px solid rgba(255, 255, 255, 0.78)",
                boxShadow:
                  isHoveringGenerate || isClickingGenerate
                    ? "0 0 36px rgba(255, 229, 14, 0.55), 0 18px 40px rgba(0, 0, 0, 0.85)"
                    : "0 16px 36px rgba(0, 0, 0, 0.85), 0 0 20px rgba(255, 255, 255, 0.18)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Sparkle Icon */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  transform: `rotate(${isHoveringGenerate ? 18 : 0}deg)`,
                }}
              >
                <path
                  d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z"
                  fill={isClickingGenerate ? "#08090D" : "#FFE50E"}
                />
              </svg>
              <span
                style={{
                  fontFamily:
                    "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
                  fontWeight: 900,
                  fontSize: 26,
                  letterSpacing: "0.1em",
                  color: isClickingGenerate ? "#08090D" : "#FFFFFF",
                  textTransform: "uppercase",
                }}
              >
                GENERATE
              </span>
            </div>
          </div>
        )}

        {/* 3. PRODUCT DEMO CARD (Enters at 5.0s / Frame 150 with ULTRA-FAST Pull-Up) */}
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
                frame >= 148 && frame <= 185
                  ? "4px solid #FFE50E"
                  : "4px solid #FFFFFF",
              boxShadow:
                "0 36px 90px rgba(0, 0, 0, 0.88), 0 12px 32px rgba(0, 0, 0, 0.65)",
              zIndex: 22,
            }}
          >
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

        {/* 5. HERO TYPOGRAPHY ENDING (0:06.5 - 0:10 / Frames 195-299) */}
        {frame >= 195 && (
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
            {/* Subtle radial dark backdrop behind central type for extreme legibility */}
            <div
              style={{
                position: "absolute",
                width: 1300,
                height: 620,
                background:
                  "radial-gradient(ellipse closest-side, rgba(7,8,14,0.72) 0%, rgba(7,8,14,0.32) 58%, rgba(7,8,14,0) 100%)",
                pointerEvents: "none",
              }}
            />

            <StackedKineticTypography
              startFrame={195}
              blocks={[
                {
                  text: "DYNAMIC & FAST",
                  bgColor: "#0D1017",
                  textColor: "#FFE50E",
                  borderColor: "rgba(255, 229, 14, 0.55)",
                  rotation: -3.2,
                  fontSize: 30,
                  paddingX: 24,
                  paddingY: 10,
                  delayFrames: 0,
                  offsetY: 0,
                  accentDotColor: "#FFE50E",
                },
                {
                  text: "TALKING HEAD",
                  bgColor: "#FFFFFF",
                  textColor: "#08090D",
                  rotation: -2.0,
                  fontSize: 136,
                  paddingX: 44,
                  paddingY: 18,
                  delayFrames: 3,
                  offsetY: 4,
                },
                {
                  text: "+ PRODUCT DEMO",
                  bgColor: "#FF5500",
                  textColor: "#FFFFFF",
                  rotation: 1.6,
                  fontSize: 120,
                  paddingX: 42,
                  paddingY: 18,
                  delayFrames: 9,
                  offsetY: 8,
                },
              ]}
            />
          </div>
        )}

        {/* 6. STUDIO CURSOR ACTOR (Native top-left orientation + pure `audio_video.mp4` payload) */}
        <CursorActor
          x={cursorX}
          y={cursorY}
          opacity={cursorOpacity}
          isGrabbing={cursorGrabbing}
          clickFrame={activeClickFrame}
          payload={showAudioPayload ? <AudioWaveformBadge /> : undefined}
          payloadOffset={{ x: -58, y: -64 }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
