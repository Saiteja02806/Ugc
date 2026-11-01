import React from "react";
import { OffthreadVideo, staticFile } from "remotion";

export interface WOTVideoPanelProps {
  src: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  rotateY?: number;
  opacity?: number;
  zIndex?: number;
  borderRadius?: number;
  boxShadow?: string;
  border?: string;
  badge?: string;
  style?: React.CSSProperties;
}

export const WOTVideoPanel: React.FC<WOTVideoPanelProps> = ({
  src,
  width = 360,
  height = 640,
  x = 0,
  y = 0,
  scale = 1,
  rotation = 0,
  rotateY = 0,
  opacity = 1,
  zIndex = 1,
  borderRadius = 14,
  boxShadow = "0 28px 70px rgba(0, 0, 0, 0.8), 0 8px 24px rgba(0, 0, 0, 0.5)",
  border = "1px solid rgba(255, 255, 255, 0.12)",
  badge,
  style = {},
}) => {
  // If the src is a relative public path, wrap with staticFile()
  const resolvedSrc = src.startsWith("http") ? src : staticFile(src);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        transform: `perspective(1000px) translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotation}deg) rotateY(${rotateY}deg)`,
        opacity,
        zIndex,
        borderRadius,
        overflow: "hidden",
        boxShadow,
        border,
        backgroundColor: "#0D0F14",
        transformOrigin: "center center",
        ...style,
      }}
    >
      {/* 9:16 Portrait Video element */}
      <OffthreadVideo
        src={resolvedSrc}
        volume={0}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
        }}
      />

      {/* Subtle hairline edge vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 16px rgba(0, 0, 0, 0.35)",
          pointerEvents: "none",
        }}
      />

      {/* Optional badge only if explicitly passed */}
      {badge && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            display: "flex",
            alignItems: "center",
            padding: "4px 8px",
            borderRadius: 6,
            backgroundColor: "rgba(10, 12, 18, 0.82)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontWeight: 800,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#FFFFFF",
            pointerEvents: "none",
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
};
