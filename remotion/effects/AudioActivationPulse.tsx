import React from "react";
import {
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";

/**
 * AudioWaveformBadge renders the pure animated `audio_video.mp4` equalizer asset as-is,
 * without any extra text labels.
 */
export const AudioWaveformBadge: React.FC<{ activePulse?: boolean }> = ({
  activePulse = true,
}) => {
  const audioWaveVideoSrc = staticFile("explore/covers/sources/audio-wave.mp4");

  return (
    <div
      style={{
        width: 78,
        height: 78,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "#000000",
        border: "2px solid rgba(255, 255, 255, 0.88)",
        boxShadow:
          "0 18px 38px rgba(0, 0, 0, 0.82), 0 0 16px rgba(255, 255, 255, 0.16)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <OffthreadVideo
        src={audioWaveVideoSrc}
        volume={0}
        muted
        style={{
          width: "128%",
          height: "128%",
          objectFit: "cover",
          filter: activePulse ? "contrast(1.18)" : "none",
        }}
      />
    </div>
  );
};

export interface AudioActivationPulseProps {
  triggerFrame: number;
  durationFrames?: number;
  x?: number;
  y?: number;
}

/**
 * AudioActivationPulse renders a clean, subtle circular ripple and a compact
 * pure equalizer badge (`audio_video.mp4`) on the top-right corner of the card upon audio drop.
 */
export const AudioActivationPulse: React.FC<AudioActivationPulseProps> = ({
  triggerFrame,
  durationFrames = 44,
  x = 0,
  y = 0,
}) => {
  const frame = useCurrentFrame();
  if (frame < triggerFrame || frame > triggerFrame + durationFrames) {
    return null;
  }

  const rel = frame - triggerFrame;
  const audioWaveVideoSrc = staticFile("explore/covers/sources/audio-wave.mp4");

  // Subtle single contact ripple
  const ringRadius = interpolate(rel, [0, 22], [24, 165], {
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(rel, [0, 4, 22], [0, 0.42, 0], {
    extrapolateRight: "clamp",
  });

  // Compact live equalizer corner badge
  const badgeOpacity = interpolate(
    rel,
    [0, 5, durationFrames - 10, durationFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const badgeScale = interpolate(rel, [0, 8], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate3d(${x}px, ${y}px, 0)`,
        zIndex: 45,
        pointerEvents: "none",
      }}
    >
      {/* Subtle Contact Ring */}
      <div
        style={{
          position: "absolute",
          left: -ringRadius,
          top: -ringRadius,
          width: ringRadius * 2,
          height: ringRadius * 2,
          borderRadius: "50%",
          border: "2px solid rgba(255, 255, 255, 0.5)",
          opacity: ringOpacity,
        }}
      />

      {/* Compact Active Equalizer Video Badge on Top-Right Corner of Talking Head Card */}
      <div
        style={{
          position: "absolute",
          left: 168,
          top: -368,
          width: 52,
          height: 52,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: "#000000",
          border: "1.5px solid rgba(255, 255, 255, 0.85)",
          boxShadow: "0 10px 24px rgba(0, 0, 0, 0.72)",
          opacity: badgeOpacity,
          transform: `scale(${badgeScale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <OffthreadVideo
          src={audioWaveVideoSrc}
          volume={0}
          muted
          style={{
            width: "128%",
            height: "128%",
            objectFit: "cover",
          }}
        />
      </div>
    </div>
  );
};
