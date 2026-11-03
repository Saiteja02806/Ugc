import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface StackedBlockItem {
  text: string;
  bgColor: string;
  textColor: string;
  rotation: number; // e.g., -2.6, +1.8
  fontSize?: number;
  paddingX?: number;
  paddingY?: number;
  delayFrames?: number;
  borderColor?: string;
  offsetX?: number;
  offsetY?: number;
  accentDotColor?: string;
}

export interface StackedKineticTypographyProps {
  startFrame: number;
  blocks: StackedBlockItem[];
  style?: React.CSSProperties;
}

/**
 * StackedKineticTypography implements the "DYNAMIC AND FAST" reference visual language:
 * - Heavy uppercase lettering
 * - Independent contrasting rectangular backing shapes (white, black, electric orange, lime)
 * - Diagonal energy with distinct per-block angles
 * - Separate animation timelines for backing shapes vs. foreground letters
 *   (elastic horizontal stretch, compression, overshoot, and sharp focus settle)
 */
export const StackedKineticTypography: React.FC<StackedKineticTypographyProps> = ({
  startFrame,
  blocks,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        userSelect: "none",
        ...style,
      }}
    >
      {blocks.map((block, index) => {
        const blockStart = startFrame + (block.delayFrames ?? index * 5);
        const relFrame = Math.max(0, frame - blockStart);

        if (frame < blockStart) return null;

        // 1. Independent Backing Shape Physics (expands horizontally + tilts into place)
        const bgSpring = spring({
          frame: relFrame,
          fps,
          config: { damping: 10, mass: 0.5, stiffness: 260 },
        });

        const bgScaleX = interpolate(bgSpring, [0, 1], [0.15, 1.0]);
        const bgScaleY = interpolate(bgSpring, [0, 1], [1.35, 1.0]);
        const bgRot = interpolate(bgSpring, [0, 1], [block.rotation * 2.8, block.rotation]);
        const bgSkewX = interpolate(bgSpring, [0, 1], [-14, -2]);

        // 2. Independent Foreground Letter Physics (arrives 2 frames after backing block, elastic stretch)
        const textRel = Math.max(0, relFrame - 2);
        const textSpring = spring({
          frame: textRel,
          fps,
          config: { damping: 9, mass: 0.48, stiffness: 290 },
        });

        // Elastic horizontal stretch -> compress -> normalize
        const textStretchX = interpolate(textSpring, [0, 0.7, 1], [1.42, 0.94, 1.0]);
        const textStretchY = interpolate(textSpring, [0, 0.7, 1], [0.68, 1.06, 1.0]);
        const textY = interpolate(textSpring, [0, 1], [36, 0]);
        const textRot = interpolate(textSpring, [0, 1], [block.rotation * -1.5, block.rotation]);
        const textOpacity = interpolate(textRel, [0, 3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Simulated motion blur during the initial 5-frame impact
        const blurPx = interpolate(relFrame, [0, 4, 8], [8, 2, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const fontSize = block.fontSize ?? 124;
        const padX = block.paddingX ?? 38;
        const padY = block.paddingY ?? 14;

        return (
          <div
            key={index}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: index === 0 ? 0 : 12 + (block.offsetY ?? 0),
              marginLeft: block.offsetX ?? 0,
              zIndex: 10 + index,
            }}
          >
            {/* LAYER A: Independent Contrasting Backing Shape */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: block.bgColor,
                border: block.borderColor ? `2px solid ${block.borderColor}` : "none",
                borderRadius: 8,
                transform: `rotate(${bgRot}deg) skewX(${bgSkewX}deg) scale(${bgScaleX}, ${bgScaleY})`,
                boxShadow:
                  "0 24px 60px rgba(0, 0, 0, 0.78), 0 6px 20px rgba(0, 0, 0, 0.55)",
                transformOrigin: index % 2 === 0 ? "left center" : "right center",
              }}
            />

            {/* LAYER B: Independent Heavy Uppercase Display Letters */}
            <div
              style={{
                position: "relative",
                padding: `${padY}px ${padX}px`,
                display: "flex",
                alignItems: "center",
                gap: 14,
                transform: `translate3d(0, ${textY}px, 0) rotate(${textRot}deg) scale(${textStretchX}, ${textStretchY})`,
                opacity: textOpacity,
                filter: blurPx > 0.2 ? `blur(${blurPx}px)` : "none",
              }}
            >
              {block.accentDotColor && (
                <span
                  style={{
                    width: Math.round(fontSize * 0.18),
                    height: Math.round(fontSize * 0.18),
                    borderRadius: "50%",
                    backgroundColor: block.accentDotColor,
                    boxShadow: `0 0 18px ${block.accentDotColor}`,
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontFamily:
                    "'Clash Display', 'Cabinet Grotesk', Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 900,
                  fontSize,
                  lineHeight: 0.88,
                  letterSpacing: "-0.045em",
                  textTransform: "uppercase",
                  color: block.textColor,
                  whiteSpace: "nowrap",
                }}
              >
                {block.text}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
