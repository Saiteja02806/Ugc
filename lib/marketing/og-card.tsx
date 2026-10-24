import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export function marketingOgImage({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          padding: "72px",
          background: "#151515",
          color: "#f8f4ed",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            width: 760,
            height: 760,
            right: -170,
            top: -330,
            borderRadius: 9999,
            background: "rgba(255, 107, 69, 0.22)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            width: 500,
            height: 500,
            right: 110,
            bottom: -330,
            borderRadius: 9999,
            background: "rgba(255, 107, 69, 0.12)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              padding: "10px 16px",
              border: "1px solid rgba(255, 107, 69, 0.55)",
              borderRadius: 9999,
              color: "#ff8b6c",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 980,
              marginTop: 42,
              fontSize: 68,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.055em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              maxWidth: 860,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#c9c0b6",
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    ),
    ogSize,
  );
}
