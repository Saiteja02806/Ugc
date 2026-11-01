import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface KineticTitleProps {
  text: string;
  subtext?: string;
  startFrame: number;
  durationFrames?: number;
  fontSize?: number;
  subFontSize?: number;
  color?: string;
  subColor?: string;
  tracking?: string;
  align?: "center" | "left" | "right";
  direction?: "up" | "down" | "left" | "right" | "scale" | "clip-up";
  overshoot?: boolean;
  style?: React.CSSProperties;
}

export const KineticTitle: React.FC<KineticTitleProps> = ({
  text,
  subtext,
  startFrame,
  durationFrames = 20,
  fontSize = 110,
  subFontSize = 24,
  color = "#F7F7F7",
  subColor = "rgba(255, 255, 255, 0.7)",
  tracking = "-0.045em",
  align = "center",
  direction = "clip-up",
  overshoot = true,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = Math.max(0, frame - startFrame);

  const spr = spring({
    frame: relFrame,
    fps,
    config: overshoot
      ? { damping: 11, mass: 0.55, stiffness: 220 }
      : { damping: 18, mass: 0.8, stiffness: 180 },
  });

  let transform = "none";
  let clipPath = "none";
  let opacity = 1;

  if (direction === "clip-up") {
    const yShift = interpolate(spr, [0, 1], [100, 0]);
    const clipInset = interpolate(spr, [0, 1], [100, 0]);
    transform = `translate3d(0, ${yShift}%, 0)`;
    clipPath = `inset(0 0 ${clipInset}% 0)`;
    opacity = interpolate(relFrame, [0, 4], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (direction === "scale") {
    const scale = interpolate(spr, [0, 1], [2.2, 1.0]);
    transform = `scale(${scale})`;
    opacity = interpolate(relFrame, [0, 3], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (direction === "left") {
    const xShift = interpolate(spr, [0, 1], [300, 0]);
    transform = `translate3d(${xShift}px, 0, 0)`;
    opacity = interpolate(relFrame, [0, 4], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (direction === "up") {
    const yShift = interpolate(spr, [0, 1], [-80, 0]);
    transform = `translate3d(0, ${yShift}px, 0)`;
    opacity = interpolate(relFrame, [0, 4], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end",
        justifyContent: "center",
        textAlign: align,
        transform,
        clipPath,
        opacity,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: "none",
        pointerEvents: "none",
        ...style,
      }}
    >
      {subtext && (
        <span
          style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 800,
            fontSize: subFontSize,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: subColor,
            marginBottom: 8,
            textShadow: "0 4px 16px rgba(0, 0, 0, 0.8)",
          }}
        >
          {subtext}
        </span>
      )}
      <span
        style={{
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 900,
          fontSize,
          lineHeight: 0.88,
          letterSpacing: tracking,
          color,
          textTransform: "uppercase",
          textShadow: "0 16px 48px rgba(0, 0, 0, 0.95)",
        }}
      >
        {text}
      </span>
    </div>
  );
};
