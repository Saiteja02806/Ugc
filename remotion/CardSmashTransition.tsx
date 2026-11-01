import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface CardSmashTransitionProps {
  startFrame: number;
  durationFrames?: number;
  word?: string;
  subtextTop?: string;
  subtextBottom?: string;
  style?: React.CSSProperties;
}

/**
 * CardSmashTransition renders a high-impact kinetic typography impact ("REMIX.")
 * that acts as a visual palette cleanser and dynamic beat between hero clips.
 */
export const CardSmashTransition: React.FC<CardSmashTransitionProps> = ({
  startFrame,
  durationFrames = 9,
  word = "REMIX.",
  subtextTop = "VIRAL BY DESIGN",
  subtextBottom = "ONE VIDEO • ENDLESS VISIONS",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = Math.max(0, frame - startFrame);
  if (frame < startFrame || frame >= startFrame + durationFrames) {
    return null;
  }

  // Rapid spring impact
  const spr = spring({
    frame: relFrame,
    fps,
    config: { damping: 9, mass: 0.45, stiffness: 320 },
  });

  // Scale smashes from 2.4 down to 1.0 with a crisp 3% rebound
  const scale = interpolate(spr, [0, 1], [2.4, 1.0]);

  // Optical expansion and fade out at the tail of the transition
  const exitProgress = interpolate(relFrame, [durationFrames - 3, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitScale = interpolate(exitProgress, [0, 1], [1.0, 1.15]);
  const exitOpacity = interpolate(exitProgress, [0, 1], [1.0, 0]);

  // Subtext split outwards
  const splitY = interpolate(exitProgress, [0, 1], [0, 60]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: exitOpacity,
        zIndex: 50,
        pointerEvents: "none",
        userSelect: "none",
        ...style,
      }}
    >
      {/* Top Banner */}
      {subtextTop && (
        <div
          style={{
            position: "absolute",
            top: `calc(50% - 140px - ${splitY}px)`,
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: "0.26em",
            color: "rgba(255, 255, 255, 0.75)",
            textTransform: "uppercase",
            textShadow: "0 4px 16px rgba(0, 0, 0, 0.9)",
          }}
        >
          {subtextTop}
        </div>
      )}

      {/* Main Kinetic Smash Word */}
      <div
        style={{
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 900,
          fontSize: 240,
          lineHeight: 0.86,
          letterSpacing: "-0.06em",
          color: "#F7F7F7",
          textTransform: "uppercase",
          transform: `scale(${scale * exitScale})`,
          textShadow: "0 24px 70px rgba(0, 0, 0, 0.95)",
        }}
      >
        {word}
      </div>

      {/* Bottom Banner */}
      {subtextBottom && (
        <div
          style={{
            position: "absolute",
            bottom: `calc(50% - 140px - ${splitY}px)`,
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: "0.22em",
            color: "rgba(255, 255, 255, 0.75)",
            textTransform: "uppercase",
            textShadow: "0 4px 16px rgba(0, 0, 0, 0.9)",
          }}
        >
          {subtextBottom}
        </div>
      )}
    </div>
  );
};
