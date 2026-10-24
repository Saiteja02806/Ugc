import { ImageResponse } from "next/og";

export const alt = "The Reaction Hook Library: 110 free natural video hooks from UGC Pilot.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#1f1f1f", color: "#f5f3f0", padding: "62px 76px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, borderBottom: "1px solid #3f3f3f", paddingBottom: 26 }}><span>UGC Pilot</span><span style={{ color: "#ff7045" }}>The Reaction Hook Library</span></div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 58 }}><div style={{ display: "flex", alignItems: "baseline" }}><span style={{ letterSpacing: "0.015em", marginRight: 20 }}>110</span><span>natural hooks</span></div><span style={{ color: "#ff7045" }}>for your next video.</span></div>
      <div style={{ display: "flex", marginTop: "auto", fontSize: 28, color: "#b9b5af" }}>TikTok · Reels · Shorts · Free PDF · No signup</div>
    </div>,
    size,
  );
}
