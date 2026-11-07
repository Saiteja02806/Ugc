import React from "react";
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface CursorActorProps {
  x: number;
  y: number;
  opacity?: number;
  isGrabbing?: boolean;
  clickFrame?: number;
  showRipple?: boolean;
  payload?: React.ReactNode;
  payloadOffset?: { x: number; y: number };
}

/**
 * CursorActor renders the custom studio cursor asset (`custom-cursor.png`)
 * oriented naturally with its tip pointing up-left (standard pointer direction),
 * plus an optional dragged payload card.
 */
export const CursorActor: React.FC<CursorActorProps> = ({
  x,
  y,
  opacity = 1,
  isGrabbing = false,
  clickFrame,
  showRipple = true,
  payload,
  payloadOffset = { x: -48, y: -56 },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (opacity <= 0.01) return null;

  const customCursorSrc = staticFile("explore/covers/sources/custom-cursor.png");

  let clickScale = 1;
  let rippleRadius = 0;
  let rippleOpacity = 0;

  if (
    clickFrame !== undefined &&
    frame >= clickFrame &&
    frame <= clickFrame + 18
  ) {
    const rel = frame - clickFrame;
    const spr = spring({
      frame: rel,
      fps,
      config: { damping: 10, mass: 0.4, stiffness: 300 },
    });
    clickScale = interpolate(rel, [0, 3, 9], [1, 0.82, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    rippleRadius = interpolate(spr, [0, 1], [10, 64]);
    rippleOpacity = interpolate(rel, [0, 4, 18], [0, 0.45, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate3d(${x}px, ${y}px, 0)`,
        opacity,
        zIndex: 120,
        pointerEvents: "none",
      }}
    >
      {/* Dragged Payload Card */}
      {payload && (
        <div
          style={{
            position: "absolute",
            left: payloadOffset.x,
            top: payloadOffset.y,
            transform: `rotate(${isGrabbing ? -4 : 0}deg) scale(${isGrabbing ? 1.03 : 1})`,
            filter: "drop-shadow(0 18px 36px rgba(0, 0, 0, 0.78))",
          }}
        >
          {payload}
        </div>
      )}

      {/* Subtle Contact Ripple Ring on Click/Drop */}
      {showRipple && rippleOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: -rippleRadius,
            top: -rippleRadius,
            width: rippleRadius * 2,
            height: rippleRadius * 2,
            borderRadius: "50%",
            border: "2px solid rgba(255, 255, 255, 0.55)",
            opacity: rippleOpacity,
          }}
        />
      )}

      {/* Provided Custom Cursor Asset (`custom-cursor.png`) in Native Orientation (0deg) */}
      {/* In custom-cursor.png, the pointer tip is natively at top-left (~18px, 9px) and the notch is at the bottom */}
      <div
        style={{
          position: "relative",
          width: 64,
          height: 64,
          marginLeft: -18,
          marginTop: -9,
          transform: `scale(${clickScale}) rotate(${isGrabbing ? -5 : 0}deg)`,
          transformOrigin: "18px 9px",
          filter:
            "drop-shadow(0 0 2.2px #FFFFFF) drop-shadow(0 0 2px #FFFFFF) drop-shadow(0 12px 24px rgba(0, 0, 0, 0.88))",
        }}
      >
        <Img
          src={customCursorSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
};
