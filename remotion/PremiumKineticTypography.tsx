import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface PremiumKineticTypographyProps {
  text: string;
  subtext?: string;
  startFrame?: number;
  mode?: "slide-up" | "mask-reveal" | "smash-overshoot" | "video-mask" | "fade";
  videoSrc?: string;
  fontSize?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const PremiumKineticTypography: React.FC<PremiumKineticTypographyProps> = ({
  text,
  subtext,
  startFrame = 0,
  mode = "slide-up",
  videoSrc,
  fontSize = 96,
  color = "#FFFFFF",
  textAlign = "center",
  letterSpacing = "-0.04em",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const relFrame = Math.max(0, frame - startFrame);

  // Smooth editorial spring
  const springProgress = spring({
    frame: relFrame,
    fps,
    config: {
      damping: 14,
      mass: 0.8,
      stiffness: 180,
    },
  });

  // Snappy smash spring with controlled overshoot
  const smashSpring = spring({
    frame: relFrame,
    fps,
    config: {
      damping: 9,
      mass: 0.6,
      stiffness: 240,
    },
  });

  if (mode === "video-mask" && videoSrc) {
    // Deterministic SVG Mask: text letterforms act as a window revealing the video
    // Mask reveal animation: the video plays inside the text from frame 0..12,
    // then smoothly expands to reveal the full video card from frame 12..19.
    const expansion = interpolate(relFrame, [12, 19], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const textScale = interpolate(relFrame, [0, 12], [0.94, 1.02], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Create unique clip ID
    const clipId = `wot-text-clip-${startFrame}`;

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          ...style,
        }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <defs>
            <clipPath id={clipId}>
              {expansion > 0 ? (
                // Interpolate from text cutout to rounded hero rectangle (360x640)
                <rect
                  x={interpolate(expansion, [0, 1], [width / 2 - 280, width / 2 - 180])}
                  y={interpolate(expansion, [0, 1], [height / 2 - 140, height / 2 - 320])}
                  width={interpolate(expansion, [0, 1], [560, 360])}
                  height={interpolate(expansion, [0, 1], [280, 640])}
                  rx={interpolate(expansion, [0, 1], [4, 16])}
                />
              ) : (
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    fontWeight: 900,
                    fontSize: fontSize * textScale,
                    letterSpacing,
                    textTransform: "uppercase",
                  }}
                >
                  {text}
                </text>
              )}
            </clipPath>
          </defs>

          {/* Video rendered inside SVG via foreignObject */}
          <g clipPath={`url(#${clipId})`}>
            <foreignObject x={0} y={0} width={width} height={height}>
              <video
                src={videoSrc}
                muted
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                }}
              />
            </foreignObject>
          </g>
        </svg>
      </div>
    );
  }

  if (mode === "smash-overshoot") {
    const scale = interpolate(smashSpring, [0, 1], [2.2, 1]);
    const opacity = interpolate(relFrame, [0, 2], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity,
          transform: `scale(${scale})`,
          ...style,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontWeight: 900,
            fontSize,
            lineHeight: 0.9,
            letterSpacing,
            color,
            textAlign,
            textTransform: "uppercase",
            textShadow: "0 10px 40px rgba(0,0,0,0.8)",
          }}
        >
          {text}
        </span>
        {subtext && (
          <span
            style={{
              marginTop: 16,
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontWeight: 700,
              fontSize: Math.round(fontSize * 0.22),
              letterSpacing: "0.2em",
              color: "#94A3B8",
              textTransform: "uppercase",
            }}
          >
            {subtext}
          </span>
        )}
      </div>
    );
  }

  if (mode === "mask-reveal") {
    // Horizontal or vertical mask reveal using clip-path inset
    const wipe = interpolate(springProgress, [0, 1], [100, 0]);
    const translateY = interpolate(springProgress, [0, 1], [40, 0]);

    return (
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          clipPath: `inset(0 ${wipe}% 0 0)`,
          transform: `translateY(${translateY}px)`,
          ...style,
        }}
      >
        <div
          style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontWeight: 900,
            fontSize,
            lineHeight: 0.95,
            letterSpacing,
            color,
            textAlign,
            textTransform: "uppercase",
          }}
        >
          {text}
        </div>
        {subtext && (
          <div
            style={{
              marginTop: 12,
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontWeight: 700,
              fontSize: Math.round(fontSize * 0.24),
              letterSpacing: "0.18em",
              color: "#94A3B8",
              textTransform: "uppercase",
            }}
          >
            {subtext}
          </div>
        )}
      </div>
    );
  }

  // Default: slide-up with tight settling
  const translateY = interpolate(springProgress, [0, 1], [60, 0]);
  const opacity = interpolate(relFrame, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        opacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 900,
          fontSize,
          lineHeight: 0.92,
          letterSpacing,
          color,
          textAlign,
          textTransform: "uppercase",
        }}
      >
        {text}
      </div>
      {subtext && (
        <div
          style={{
            marginTop: 10,
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontWeight: 700,
            fontSize: Math.round(fontSize * 0.25),
            letterSpacing: "0.22em",
            color: "#94A3B8",
            textAlign,
            textTransform: "uppercase",
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
};
