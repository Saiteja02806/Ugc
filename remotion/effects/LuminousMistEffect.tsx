import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export interface LuminousMistEffectProps {
  triggerFrame: number;
  durationFrames?: number;
  centerX?: number;
  centerY?: number;
}

/**
 * LuminousMistEffect creates a cinematic volumetric fog / luminous mist
 * that spreads outward from the face contact point during Hook Video face transformation,
 * obscuring the face smoothly without a harsh white flash.
 */
export const LuminousMistEffect: React.FC<LuminousMistEffectProps> = ({
  triggerFrame,
  durationFrames = 40,
  centerX = 0,
  centerY = -40,
}) => {
  const frame = useCurrentFrame();
  if (frame < triggerFrame || frame > triggerFrame + durationFrames) {
    return null;
  }

  const rel = frame - triggerFrame;
  const progress = rel / durationFrames;

  // Envelope: rises smoothly, peaks at 22-48% (masking the identity swap), dissipates organically
  const opacity = interpolate(
    progress,
    [0, 0.22, 0.48, 0.82, 1],
    [0, 0.96, 0.94, 0.38, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const spreadScale = interpolate(progress, [0, 0.45, 1], [0.42, 1.08, 1.48]);
  const swirlDeg = interpolate(progress, [0, 1], [-22, 34]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate3d(${centerX}px, ${centerY}px, 0) scale(${spreadScale}) rotate(${swirlDeg}deg)`,
        opacity,
        pointerEvents: "none",
        zIndex: 48,
      }}
    >
      {/* Core Volumetric Mist Plume (Pearl White + Hot Viral Magenta + Electric Cyan) */}
      <div
        style={{
          position: "absolute",
          left: -240,
          top: -250,
          width: 480,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,248,252,0.96) 0%, rgba(255,23,107,0.62) 34%, rgba(0,240,255,0.38) 62%, rgba(0,0,0,0) 78%)",
          filter: "blur(22px)",
        }}
      />

      {/* Secondary Counter-Swirling Fog Wisp */}
      <div
        style={{
          position: "absolute",
          left: -200,
          top: -180,
          width: 400,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 38% 45%, rgba(255,255,255,0.94) 0%, rgba(168,85,247,0.56) 46%, rgba(0,0,0,0) 74%)",
          transform: `rotate(${-swirlDeg * 1.7}deg) translateX(${rel * 1.4}px)`,
          filter: "blur(16px)",
        }}
      />

      {/* Inner Silk Mist Core over Face Region */}
      <div
        style={{
          position: "absolute",
          left: -150,
          top: -160,
          width: 300,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(255,182,219,0.76) 44%, rgba(0,0,0,0) 72%)",
          transform: `translateY(${-rel * 0.9}px)`,
          filter: "blur(12px)",
        }}
      />
    </div>
  );
};
