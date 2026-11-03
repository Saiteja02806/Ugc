import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export interface SplashRecreateEffectProps {
  triggerFrame: number;
  durationFrames?: number;
  originX?: number;
  originY?: number;
}

/**
 * SplashRecreateEffect creates an energetic liquid/particle splash wave
 * erupting from the Recreate button and sweeping across the 7 slideshow cards.
 */
export const SplashRecreateEffect: React.FC<SplashRecreateEffectProps> = ({
  triggerFrame,
  durationFrames = 45,
  originX = 0,
  originY = 230,
}) => {
  const frame = useCurrentFrame();
  if (frame < triggerFrame || frame > triggerFrame + durationFrames) {
    return null;
  }

  const rel = frame - triggerFrame;
  const progress = rel / durationFrames;

  const waveRadius = interpolate(progress, [0, 1], [20, 1180]);
  const waveOpacity = interpolate(progress, [0, 0.15, 0.7, 1], [0, 1, 0.8, 0]);

  const dropletAngles = [
    -155, -135, -118, -102, -90, -78, -62, -45, -25, -168, -12, -142, -52, -84, -96, -110,
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate3d(${originX}px, ${originY}px, 0)`,
        pointerEvents: "none",
        zIndex: 60,
      }}
    >
      {/* Expanding Luminous Splash Wavefront */}
      <div
        style={{
          position: "absolute",
          left: -waveRadius,
          top: -waveRadius,
          width: waveRadius * 2,
          height: waveRadius * 2,
          borderRadius: "50%",
          border: "8px solid rgba(255, 85, 0, 0.85)",
          boxShadow:
            "0 0 60px rgba(255, 85, 0, 0.65), inset 0 0 50px rgba(212, 255, 0, 0.45)",
          opacity: waveOpacity,
        }}
      />

      {/* Energetic Liquid Droplets */}
      {dropletAngles.map((deg, idx) => {
        const rad = (deg * Math.PI) / 180;
        const speed = 0.75 + (idx % 4) * 0.18;
        const dist = waveRadius * speed;
        const dx = Math.cos(rad) * dist;
        const dy = Math.sin(rad) * dist;
        const size = 12 + (idx % 3) * 8;
        const color = idx % 2 === 0 ? "#FF5500" : idx % 3 === 0 ? "#D4FF00" : "#FFFFFF";

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: dx - size / 2,
              top: dy - size / 2,
              width: size,
              height: size * 1.4,
              borderRadius: "50%",
              backgroundColor: color,
              boxShadow: `0 0 16px ${color}`,
              transform: `rotate(${deg + 90}deg)`,
              opacity: waveOpacity,
            }}
          />
        );
      })}
    </div>
  );
};
