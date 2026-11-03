import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface KlickpinBandProps {
  topText: string;
  bottomText: string;
  beatStartFrame: number;
  highlightBottom?: boolean;
  opacity?: number;
}

/**
 * KlickpinHeaderBand renders unobstructed top-band and bottom-band display typography
 * using Higgsfield AI's tight-tracked (-0.04em), 900-weight uppercase display formula
 * with fast 6-frame elastic snap physics and geometric tape-slab highlights.
 */
export const KlickpinHeaderBand: React.FC<KlickpinBandProps> = ({
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
            lineHeight: 0.86,
            letterSpacing: "-0.04em",
            color,
            backgroundColor: stickerBg ?? "transparent",
            padding: stickerBg ? "12px 32px 10px 32px" : "0px",
            borderRadius: stickerBg ? 4 : 0,
            boxShadow: stickerBg
              ? "0 20px 48px rgba(0, 0, 0, 0.9), 0 0 36px rgba(255, 23, 107, 0.45)"
              : "none",
            textTransform: "uppercase",
            textShadow: stickerBg
              ? "none"
              : color === "#00F0FF"
                ? "0 0 30px rgba(0, 240, 255, 0.4), 0 10px 28px rgba(0, 0, 0, 0.92)"
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
        highlightBottom ? "#FFFFFF" : "#00F0FF",
        highlightBottom ? 80 : 84,
        highlightBottom ? "#FF176B" : undefined
      )}
    </div>
  );
};

export interface PerspectiveFoldTypographyProps {
  startFrame: number;
}

/**
 * PerspectiveFoldTypography implements the Higgsfield AI "Production Skills Bundle"
 * + "AI Influencer: Powered by Genjutsu" Hero Finale:
 * - Zero slow 3D rotation or warping
 * - Ultra-fast 6-frame staggered horizontal ribbon wipe + elastic letter snap
 * - Sharp-edged geometric tape slabs tightly nested at counter-angles:
 *     1. Eyebrow pill: `✦ VIDMAKE • HOOK STUDIO`
 *     2. Ribbon 1 (`#FF176B` Hot Viral Magenta, `-2.6deg`): `VIRAL HOOK` in `#FFFFFF`
 *     3. Ribbon 2 (`#07080C` Jet Ink, `+0.9deg`): `YOUR CREATOR` in `#00F0FF`
 *     4. Ribbon 3 (`#FFFFFF` Pure White, `-1.3deg`): `+ PRODUCT DEMO` in `#07080C`
 *     5. Bottom benefit pill: `ONE UPLOAD IN • READY-TO-POST AD OUT`
 */
export const PerspectiveFoldTypography: React.FC<
  PerspectiveFoldTypographyProps
> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) {
    return null;
  }

  const rel = frame - startFrame;

  // Eyebrow entrance (rel >= 0)
  const eyebrowSpr = spring({
    frame: rel,
    fps,
    config: { damping: 14, mass: 0.35, stiffness: 420 },
  });
  const eyebrowY = interpolate(eyebrowSpr, [0, 1], [-24, 0]);
  const eyebrowOpacity = interpolate(rel, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ribbons = [
    {
      text: "VIRAL HOOK",
      bg: "#FF176B",
      color: "#FFFFFF",
      tilt: -2.6,
      skewX: -6,
      fontSize: 128,
      delay: 1,
      origin: "left center" as const,
      marginTop: 0,
      offsetX: -14,
      shadow:
        "0 28px 65px rgba(0, 0, 0, 0.92), 0 0 48px rgba(255, 23, 107, 0.52)",
      border: "none",
    },
    {
      text: "YOUR CREATOR",
      bg: "#07080C",
      color: "#00F0FF",
      tilt: 0.9,
      skewX: -6,
      fontSize: 116,
      delay: 5,
      origin: "right center" as const,
      marginTop: 14,
      offsetX: 16,
      shadow:
        "0 28px 65px rgba(0, 0, 0, 0.95), 0 0 36px rgba(0, 240, 255, 0.28)",
      border: "2px solid rgba(0, 240, 255, 0.45)",
    },
    {
      text: "+ PRODUCT DEMO",
      bg: "#FFFFFF",
      color: "#07080C",
      tilt: -1.3,
      skewX: -6,
      fontSize: 102,
      delay: 9,
      origin: "left center" as const,
      marginTop: 12,
      offsetX: -6,
      shadow: "0 30px 70px rgba(0, 0, 0, 0.92)",
      border: "none",
    },
  ];

  // Bottom benefit subtitle pill (rel >= 13)
  const footerRel = Math.max(0, rel - 13);
  const footerSpr = spring({
    frame: footerRel,
    fps,
    config: { damping: 13, mass: 0.38, stiffness: 390 },
  });
  const footerScale = interpolate(footerSpr, [0, 1], [0.75, 1]);
  const footerY = interpolate(footerSpr, [0, 1], [22, 0]);
  const footerOpacity = interpolate(footerRel, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 65,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Tier 1: Higgsfield Studio Eyebrow Tag */}
      <div
        style={{
          opacity: eyebrowOpacity,
          transform: `translate3d(0, ${eyebrowY}px, 0)`,
          marginBottom: 26,
          padding: "8px 24px",
          borderRadius: 999,
          backgroundColor: "rgba(7, 8, 12, 0.9)",
          border: "1.5px solid rgba(255, 255, 255, 0.22)",
          boxShadow: "0 14px 32px rgba(0, 0, 0, 0.85)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            color: "#FF176B",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ✦
        </span>
        <span
          style={{
            fontFamily:
              "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: "0.22em",
            color: "#FFFFFF",
            textTransform: "uppercase",
          }}
        >
          VIDMAKE • HOOK STUDIO
        </span>
      </div>

      {/* Tiers 2-4: Higgsfield "Production Skills Bundle" Slanted Ribbon Stack */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {ribbons.map((ribbon, idx) => {
          const rRel = Math.max(0, rel - ribbon.delay);
          if (rel < ribbon.delay) return null;

          // Fast 5-frame horizontal tape wipe
          const bgSpr = spring({
            frame: rRel,
            fps,
            config: { damping: 14, mass: 0.34, stiffness: 450 },
          });
          const bgScaleX = interpolate(bgSpr, [0, 1], [0.12, 1.0]);
          const bgScaleY = interpolate(bgSpr, [0, 1], [1.24, 1.0]);
          const bgRot = interpolate(
            bgSpr,
            [0, 1],
            [ribbon.tilt * 2.1, ribbon.tilt]
          );

          // Foreground heavy display letters snap 1 frame after tape wipe
          const txtRel = Math.max(0, rRel - 1);
          const txtSpr = spring({
            frame: txtRel,
            fps,
            config: { damping: 13, mass: 0.36, stiffness: 430 },
          });
          const txtScaleX = interpolate(
            txtSpr,
            [0, 0.65, 1],
            [1.32, 0.92, 0.95]
          );
          const txtScaleY = interpolate(
            txtSpr,
            [0, 0.65, 1],
            [0.68, 1.05, 1.0]
          );
          const txtY = interpolate(txtSpr, [0, 1], [24, 0]);
          const txtOpacity = interpolate(txtRel, [0, 2.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const motionBlur = interpolate(rRel, [0, 3, 6], [6, 1.5, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={ribbon.text}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: ribbon.marginTop,
                marginLeft: ribbon.offsetX,
                zIndex: 20 + idx,
              }}
            >
              {/* Sharp Geometric Backing Tape Slab */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: ribbon.bg,
                  border: ribbon.border,
                  borderRadius: 4,
                  boxShadow: ribbon.shadow,
                  transform: `rotate(${bgRot}deg) skewX(${ribbon.skewX}deg) scale(${bgScaleX}, ${bgScaleY})`,
                  transformOrigin: ribbon.origin,
                }}
              />

              {/* Heavy Tight-Tracked Display Typography */}
              <div
                style={{
                  position: "relative",
                  padding: "14px 44px 14px 44px",
                  transform: `translate3d(0, ${txtY}px, 0) rotate(${ribbon.tilt}deg) scale(${txtScaleX}, ${txtScaleY})`,
                  opacity: txtOpacity,
                  filter: motionBlur > 0.2 ? `blur(${motionBlur}px)` : "none",
                }}
              >
                <span
                  style={{
                    fontFamily:
                      "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
                    fontWeight: 900,
                    fontSize: ribbon.fontSize,
                    lineHeight: 0.85,
                    letterSpacing: "-0.045em",
                    color: ribbon.color,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    display: "inline-block",
                  }}
                >
                  {ribbon.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tier 5: Higgsfield Benefit Subtitle Pill */}
      {rel >= 13 && (
        <div
          style={{
            marginTop: 22,
            opacity: footerOpacity,
            transform: `translate3d(0, ${footerY}px, 0) scale(${footerScale})`,
            backgroundColor: "#07080C",
            border: "2px solid rgba(0, 240, 255, 0.7)",
            borderRadius: 999,
            padding: "10px 30px",
            boxShadow:
              "0 20px 48px rgba(0, 0, 0, 0.9), 0 0 28px rgba(0, 240, 255, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#FF176B",
              boxShadow: "0 0 12px #FF176B",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily:
                "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, sans-serif",
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: "0.12em",
              color: "#FFFFFF",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            ONE UPLOAD IN •{" "}
            <span style={{ color: "#00F0FF" }}>READY-TO-POST AD OUT</span>
          </span>
        </div>
      )}
    </div>
  );
};
