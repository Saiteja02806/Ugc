/**
 * UGC Pilot — Wall of Text Cover Video Asset Configuration (V5)
 * References the three selected visually distinct authentic WOT assets.
 */

export interface WOTAsset {
  id: string;
  title: string;
  headlineSummary: string;
  sourceFile: string;
  publicPath: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  environment: string;
  dominantTone: string;
}

export const WOT_ASSETS: readonly WOTAsset[] = [
  {
    id: "wot-hero-1",
    title: "Nutrition & Fitness Truth",
    headlineSummary: "If you eat less and eat enough protein, you lose body fat...",
    sourceFile: "landing_page/WOT/WOT_1-Vmake - Copy.mp4",
    publicPath: "explore/covers/sources/wot-hero-1.mp4",
    width: 720,
    height: 1280,
    fps: 24,
    durationSeconds: 6.5,
    environment: "Indoor fitness & wellness setting with active creator gesture",
    dominantTone: "#141820",
  },
  {
    id: "wot-hero-2",
    title: "Travel & Perspective",
    headlineSummary: "People who travel alot judge less... Seen too many versions of normal.",
    sourceFile: "landing_page/WOT/WOT_2-Vmake - Copy.mp4",
    publicPath: "explore/covers/sources/wot-hero-2.mp4",
    width: 720,
    height: 1280,
    fps: 24,
    durationSeconds: 8.5,
    environment: "Historic European cobblestone city street with walking motion",
    dominantTone: "#1A1714",
  },
  {
    id: "wot-hero-3",
    title: "Mental Models & Laws",
    headlineSummary: "5 most famous laws: murphy law, kidlin law, gilbert law...",
    sourceFile: "public/explore/covers/sources/wot-hero-3.mp4",
    publicPath: "explore/covers/sources/wot-hero-3.mp4",
    width: 720,
    height: 1280,
    fps: 24,
    durationSeconds: 7.17,
    environment: "Atmospheric architectural & natural backdrop with calm pacing",
    dominantTone: "#10161A",
  },
];

export const TIMELINE = {
  totalFrames: 192,
  fps: 24,
  width: 1280,
  height: 720,
  // Exact V5 scene milestones (total 192 frames @ 24fps = 8.00s):
  scene1_Opening: { start: 0, end: 15 },
  scene2_Hero1: { start: 16, end: 37 },
  scene3_CardSwap: { start: 38, end: 44 },
  scene4_Hero2: { start: 45, end: 68 },
  scene5_RemixSmash: { start: 69, end: 77 },
  scene6_Hero3: { start: 78, end: 101 },
  scene7_ThreeCardBurst: { start: 102, end: 111 },
  scene8_CollageDevelop: { start: 112, end: 153 },
  scene9_FocusSequence: { start: 154, end: 179 },
  scene10_LoopReset: { start: 180, end: 191 },
} as const;
