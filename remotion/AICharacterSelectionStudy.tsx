import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/*
 * Shared continuous selection panel: original isolated study plus full-cover mode.
 *
 * The default 3-second study keeps its two picks and camera scroll. Full mode
 * uses the cover's six original choices/timings and hands off at frame 300.
 *
 * Rules carried over from UGC-VID-045/055/056:
 * - Pure #000 stage, no click ripple or target rings.
 * - Same sculpted black 3D cursor, visible for every pointer frame.
 * - Exactly three readable choices per group, varied selected positions.
 * - Same authentic studio assets / chosen recipe as the cover.
 * New in this study:
 * - One continuous panel filmed by a camera (scroll + gentle zoom breath).
 * - Restrained vertical motion blur derived from camera velocity only.
 * - Cursor hit points are computed from the same world→screen camera transform.
 * - Picked settings accumulate in a strip below the panel.
 */

export const AI_CHARACTER_SELECTION_STUDY_FRAMES = 90; // 3.00s @ 30 FPS

const YELLOW = "#FFE600";
const FONT = "Inter, -apple-system, 'Segoe UI', sans-serif";
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ASSET = (name: string) => staticFile(`explore/covers/sources/aichar/${name}`);

/* ------------------------------------------------------------------------ */
/* World layout (panel-local px)                                             */
/* ------------------------------------------------------------------------ */

const PANEL_W = 820;
const SECTION_PAD = 24;
const TILE_GAP = 14;
const TILE_W = (PANEL_W - SECTION_PAD * 2 - TILE_GAP * 2) / 3; // 248
const TILE_H = 300;
const HEADER_H = 70;
const SECTION_GAP = 22;
const SECTION_H = HEADER_H + TILE_H + SECTION_PAD; // 394

interface Choice {
  label: string;
  src: string;
  position?: string;
  fit?: "cover" | "contain";
}

export interface SelectionFlowGroup {
  id: string;
  title: string;
  count: number;
  accent: string;
  choices: readonly [Choice, Choice, Choice];
  selected?: 0 | 1 | 2;
  click?: number;
  picked?: string;
  start?: number;
  detail?: { label: string; at: number; swatches?: string[]; image?: string };
}

type Group = SelectionFlowGroup;
interface FlowConfig {
  groups: readonly Group[];
  full: boolean;
  exitCursor?: { x: number; y: number };
}

const GROUPS: readonly Group[] = [
  {
    id: "type",
    title: "Character type",
    count: 3,
    accent: "#FF6B3D",
    choices: [
      { label: "Average", src: ASSET("char-average.png"), position: "50% 30%" },
      { label: "Extreme", src: ASSET("char-extreme.png"), position: "50% 30%" },
      { label: "Bold", src: ASSET("char-bold.png"), position: "50% 30%" },
    ],
    selected: 1,
    click: 26,
    picked: "Extreme",
  },
  {
    id: "scene",
    title: "Background",
    count: 20,
    accent: "#3DA9FF",
    choices: [
      { label: "Workspace", src: ASSET("bg-workspace.png") },
      { label: "Cream Room", src: ASSET("bg-cream-room.png") },
      { label: "Studio Wall", src: ASSET("bg-normal-wall.png") },
    ],
    selected: 2,
    click: 64,
    picked: "Studio Wall",
  },
  {
    id: "heritage",
    title: "Ethnicity",
    count: 6,
    accent: "#B66BFF",
    choices: [
      { label: "East Asian", src: ASSET("eth-east-asian.png"), position: "50% 25%" },
      { label: "Middle Eastern", src: ASSET("eth-middle-eastern.png"), position: "50% 25%" },
      { label: "Latina", src: ASSET("eth-latina.png"), position: "50% 25%" },
    ],
  },
];
const STUDY_CONFIG: FlowConfig = { groups: GROUPS, full: false };

const PANEL_TOP_PAD = 0;
const sectionTop = (i: number) => PANEL_TOP_PAD + i * (SECTION_H + SECTION_GAP);
const sectionCenterY = (i: number) => sectionTop(i) + SECTION_H / 2;
const tileWorld = (g: number, t: number) => ({
  x: SECTION_PAD + t * (TILE_W + TILE_GAP),
  y: sectionTop(g) + HEADER_H,
});

/* ------------------------------------------------------------------------ */
/* Camera                                                                    */
/* ------------------------------------------------------------------------ */

const SCREEN_OFFSET_Y = -10; // active group sits at centre; picked list lives in the left margin
const ease = Easing.bezier(0.65, 0, 0.35, 1);

function cameraAt(frame: number, config: FlowConfig = STUDY_CONFIG) {
  if (config.full) {
    let focusY = sectionCenterY(0);
    let scale = interpolate(frame, [0, 22], [1.36, 1.5], { ...CLAMP, easing: Easing.out(Easing.cubic) });
    for (let i = 1; i < config.groups.length; i++) {
      const start = (config.groups[i].start as number) - 12;
      const end = start + 16;
      if (frame < start) break;
      focusY = interpolate(frame, [start, end], [sectionCenterY(i - 1), sectionCenterY(i)], { ...CLAMP, easing: ease });
      if (frame < end) {
        scale = interpolate(frame, [start, (start + end) / 2, end], [1.5, 1.4, 1.5], { ...CLAMP, easing: ease });
        break;
      }
    }
    const handoff = interpolate(frame, [286, 300], [0, 1], CLAMP);
    return { focusY, scale: scale * (1 - handoff * 0.1) };
  }
  // Focus (world Y at screen centre)
  let focusY: number;
  if (frame < 36) {
    focusY = sectionCenterY(0);
  } else if (frame < 54) {
    focusY = interpolate(frame, [36, 54], [sectionCenterY(0), sectionCenterY(1)], {
      ...CLAMP,
      easing: ease,
    });
  } else if (frame < 76) {
    focusY = sectionCenterY(1);
  } else {
    // Begin drifting toward the next group: it peeks, never fully lands
    focusY = interpolate(frame, [76, 90], [sectionCenterY(1), sectionCenterY(1) + 150], {
      ...CLAMP,
      easing: Easing.bezier(0.5, 0, 0.75, 0.6),
    });
  }

  // Scale: gentle push-in, small breath during scroll, settle
  const scale =
    frame < 36
      ? interpolate(frame, [0, 22], [1.36, 1.5], { ...CLAMP, easing: Easing.out(Easing.cubic) })
      : frame < 58
        ? interpolate(frame, [36, 45, 58], [1.5, 1.4, 1.5], { ...CLAMP, easing: ease })
        : interpolate(frame, [76, 90], [1.5, 1.44], { ...CLAMP, easing: ease });

  return { focusY, scale };
}

const worldToScreen = (frame: number, wx: number, wy: number, config: FlowConfig = STUDY_CONFIG) => {
  const { focusY, scale } = cameraAt(frame, config);
  return {
    x: (wx - PANEL_W / 2) * scale,
    y: (wy - focusY) * scale + SCREEN_OFFSET_Y,
  };
};

/* ------------------------------------------------------------------------ */
/* Tile                                                                      */
/* ------------------------------------------------------------------------ */

const Tile: React.FC<{
  group: Group;
  index: number;
  choice: Choice;
  frame: number;
  fps: number;
  hovered: boolean;
}> = ({ group, index, choice, frame, fps, hovered }) => {
  const isSelected = group.selected === index && group.click !== undefined;
  const clickAge = group.click !== undefined ? frame - group.click : -1;
  const picked = isSelected && clickAge >= 0;
  const groupDecided = group.click !== undefined && clickAge >= 0;

  const press = picked
    ? interpolate(clickAge, [0, 3, 6], [1, 0.95, 1], CLAMP) +
      0.035 *
        spring({ frame: clickAge - 3, fps, config: { damping: 11, stiffness: 220, mass: 0.5 } }) *
        interpolate(clickAge, [6, 20], [1, 0], CLAMP)
    : 1;
  const hoverLift = hovered && !groupDecided ? 1.025 : 1;
  const dim = groupDecided && !isSelected ? interpolate(clickAge, [0, 8], [1, 0.5], CLAMP) : 1;
  const wash = picked ? interpolate(clickAge, [0, 2, 14], [0, 0.42, 0.1], CLAMP) : 0;
  const ring = picked ? interpolate(clickAge, [0, 4], [0, 1], CLAMP) : 0;
  const check = picked
    ? spring({ frame: clickAge - 2, fps, config: { damping: 12, stiffness: 240, mass: 0.5 } })
    : 0;
  const w = tileWorld(0, index);

  return (
    <div
      data-trait-beat={group.id}
      data-trait-option={index - 1}
      data-selected={picked}
      style={{
        position: "absolute",
        left: w.x,
        top: HEADER_H,
        width: TILE_W,
        height: TILE_H,
        borderRadius: 20,
        overflow: "hidden",
        transform: `scale(${press * hoverLift})`,
        opacity: dim,
        background: "#1E2024",
        boxShadow: picked
          ? `0 0 0 ${3 * ring}px ${YELLOW}, 0 0 ${34 * ring}px rgba(255,230,0,${0.42 * ring})`
          : hovered && !groupDecided
            ? "0 0 0 2px rgba(255,255,255,0.55)"
            : "0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      <Img
        src={choice.src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: choice.fit ?? "cover",
          objectPosition: choice.position ?? "50% 50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.78) 100%)",
        }}
      />
      {wash > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 60%, rgba(255,230,0,${wash}) 0%, rgba(255,230,0,${wash * 0.4}) 70%)`,
            mixBlendMode: "screen",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: 18,
          bottom: 14,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: -0.3,
          color: picked ? YELLOW : "#FFFFFF",
          textShadow: "0 2px 10px rgba(0,0,0,0.6)",
        }}
      >
        {choice.label}
      </div>
      {check > 0.01 && (
        <div
          style={{
            position: "absolute",
            right: 14,
            top: 14,
            width: 38,
            height: 38,
            borderRadius: 19,
            background: YELLOW,
            transform: `scale(${check})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#000" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Section (one rounded group card)                                          */
/* ------------------------------------------------------------------------ */

const Section: React.FC<{
  group: Group;
  gi: number;
  frame: number;
  fps: number;
  hoveredTile: number | null;
}> = ({ group, gi, frame, fps, hoveredTile }) => {
  const decided = group.click !== undefined && frame >= group.click;
  const valueIn = decided
    ? spring({ frame: frame - (group.click as number) - 4, fps, config: { damping: 14, stiffness: 200 } })
    : 0;
  const detail = group.detail && frame >= group.detail.at ? group.detail : undefined;
  const titleFocus =
    group.start !== undefined
      ? interpolate(frame, [group.start - 6, group.start + 10], [0, 1], CLAMP)
      : 1;
  const valueBlur = group.start !== undefined ? (1 - valueIn) * 7 : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: sectionTop(gi),
        width: PANEL_W,
        height: SECTION_H,
        borderRadius: 28,
        background: "linear-gradient(180deg, #17181B 0%, #121315 100%)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 30px 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          left: SECTION_PAD,
          right: SECTION_PAD,
          top: 0,
          height: HEADER_H,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: FONT,
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 4, background: group.accent }} />
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#E9E9EC",
            opacity: group.start !== undefined ? 0.35 + titleFocus * 0.65 : 1,
            filter: titleFocus < 0.99 ? `blur(${((1 - titleFocus) * 5).toFixed(2)}px)` : undefined,
            transform: group.start !== undefined ? `translateY(${((1 - titleFocus) * 6).toFixed(2)}px)` : undefined,
          }}
        >
          {group.title}
        </div>
        <div style={{ fontSize: 26, fontWeight: 500, color: "rgba(255,255,255,0.38)" }}>
          · {group.count}
        </div>
        <div style={{ flex: 1 }} />
        {valueIn > 0.01 && (
          <div
            data-selection-detail={detail ? group.id : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: detail ? 20 : 22,
              fontWeight: 700,
              color: YELLOW,
              opacity: valueIn,
              filter: valueBlur > 0.15 ? `blur(${valueBlur.toFixed(2)}px)` : undefined,
              transform: `translateX(${(1 - valueIn) * 16}px)`,
            }}
          >
            {detail?.image && <Img src={detail.image} style={{ width: 58, height: 38, borderRadius: 8, objectFit: "cover" }} />}
            {detail?.swatches?.map((hex) => <span key={hex} style={{ width: 18, height: 18, borderRadius: 999, background: hex, border: "1px solid #FFFFFF" }} />)}
            {detail?.label ?? group.picked}
          </div>
        )}
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ opacity: 0.45 }}>
          <path d="M6 9l6 6 6-6" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
        </svg>
      </div>
      {group.choices.map((c, ti) => (
        <Tile
          key={c.label}
          group={group}
          index={ti}
          choice={c}
          frame={frame}
          fps={fps}
          hovered={hoveredTile === ti}
        />
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Picked settings strip (screen space)                                      */
/* ------------------------------------------------------------------------ */

const PickedStrip: React.FC<{ frame: number; fps: number; config: FlowConfig }> = ({ frame, fps, config }) => {
  if (config.full) return null;
  const picks = config.groups.filter((g) => g.click !== undefined && g.picked);
  const first = (picks[0].click as number) + 4;
  if (frame < first) return null;
  const inP = spring({ frame: frame - first, fps, config: { damping: 15, stiffness: 180 } });
  const handoff = config.full ? interpolate(frame, [286, 300], [0, 1], CLAMP) : 0;
  const summaryOpacity = inP * (config.full ? interpolate(frame, [284, 290], [1, 0], CLAMP) : 1);
  return (
    <div
      data-picked-summary-opacity={config.full ? summaryOpacity : undefined}
      style={{
        position: "absolute",
        left: 56,
        top: config.full ? 271 : 452,
        transform: `translateX(${(1 - inP) * -40}px)`,
        opacity: summaryOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 14,
        fontFamily: FONT,
        zIndex: 60,
      }}
    >
      <div
        style={{
          position: config.full ? "absolute" : undefined,
          top: config.full ? -36 : undefined,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
          marginBottom: 4,
        }}
      >
        Picked
      </div>
      {picks.map((g, i) => {
        const at = (g.click as number) + 6;
        if (frame < at) return null;
        const p = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 230, mass: 0.55 } });
        return (
          <div
            key={g.id}
            data-picked-trait={g.id}
            style={{
              position: config.full ? "absolute" : undefined,
              top: config.full ? i * 80 : undefined,
              left: config.full ? handoff * 96 : undefined,
              maxWidth: config.full ? 336 : undefined,
              whiteSpace: "nowrap",
              fontSize: config.full ? 22 : 30,
              fontWeight: 800,
              color: "#111",
              background: YELLOW,
              borderRadius: 999,
              padding: "10px 24px",
              transformOrigin: "0% 50%",
              transform: `translateX(${(1 - p) * -30}px) scale(${0.7 + 0.3 * p})`,
              opacity: Math.min(1, p * 1.4),
              boxShadow: "0 10px 26px rgba(255,230,0,0.18)",
            }}
          >
            {g.picked}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Black sculpted 3D cursor (same geometry/materials as AICharacterPromo v3) */
/* ------------------------------------------------------------------------ */

const ARROW_PATH = "M0 0 L0 30 L7 23.6 L11.8 34.6 L17.4 32.2 L12.6 21.4 L21.8 21.4 Z";
const VB = 4;

const BlackCursor3D: React.FC<{ x: number; y: number; opacity: number; clickFrame?: number }> = ({
  x,
  y,
  opacity,
  clickFrame,
}) => {
  const frame = useCurrentFrame();
  if (opacity <= 0.01) return null;
  const press =
    clickFrame !== undefined && frame >= clickFrame && frame <= clickFrame + 9
      ? interpolate(frame - clickFrame, [0, 3, 9], [1, 0.82, 1], CLAMP)
      : 1;
  const unit = 3.1 * press;
  const w = 36 * unit;
  const h = 46 * unit;
  const tip = VB * unit;
  const depth = 9;
  return (
    <div
      data-cursor-style="black-3d"
      data-cursor-x={x}
      data-cursor-y={y}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate3d(${x}px, ${y}px, 0)`,
        opacity,
        zIndex: 140,
        pointerEvents: "none",
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`-${VB} -${VB} 36 46`}
        style={{ position: "absolute", left: -tip + 14, top: -tip + 22, filter: "blur(10px)", opacity: 0.6 }}
      >
        <path d={ARROW_PATH} fill="#000" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: -tip,
          top: -tip,
          width: w,
          height: h,
          transform: "perspective(600px) translate3d(-6px, -10px, 0) rotateX(20deg) rotateY(-22deg) rotateZ(-6deg)",
          transformOrigin: `${tip}px ${tip}px`,
        }}
      >
        <svg width={w} height={h} viewBox={`-${VB} -${VB} 36 46`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id="studyCursorFace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#77777F" />
              <stop offset="38%" stopColor="#34343A" />
              <stop offset="70%" stopColor="#151518" />
              <stop offset="100%" stopColor="#3E3E45" />
            </linearGradient>
            <linearGradient id="studyCursorRim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <linearGradient id="studyCursorGloss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {Array.from({ length: depth }, (_, k) => depth - k).map((d) => {
            const shade = Math.round(interpolate(d / depth, [0, 1], [46, 10]));
            const c = `rgb(${shade},${shade},${shade + 3})`;
            return (
              <path
                key={d}
                d={ARROW_PATH}
                fill={c}
                stroke={c}
                strokeWidth={1.4}
                strokeLinejoin="round"
                transform={`translate(${d * 0.36} ${d * 0.52})`}
              />
            );
          })}
          <path d={ARROW_PATH} fill="url(#studyCursorFace)" stroke="#0B0B0D" strokeWidth={0.7} strokeLinejoin="round" />
          <path d={ARROW_PATH} fill="url(#studyCursorGloss)" transform="translate(2.4 4.6) scale(0.78)" />
          <path d={ARROW_PATH} fill="none" stroke="url(#studyCursorRim)" strokeWidth={0.9} strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Cursor path: targets derive from the camera transform at the click frame  */
/* ------------------------------------------------------------------------ */

const TIP_IN_TILE = { x: TILE_W * 0.52, y: TILE_H * 0.5 };

function clickTarget(gi: number, config: FlowConfig = STUDY_CONFIG) {
  const g = config.groups[gi];
  const t = tileWorld(gi, g.selected as number);
  return worldToScreen(g.click as number, t.x + TIP_IN_TILE.x, t.y + TIP_IN_TILE.y, config);
}

function cursorAt(frame: number, config: FlowConfig = STUDY_CONFIG) {
  const a = clickTarget(0, config);
  const b = clickTarget(1, config);
  const pts: Array<{ f: number; x: number; y: number }> = config.full ? [
    { f: 4, x: 640, y: 470 },
    ...config.groups.flatMap((g, gi) => {
      const target = clickTarget(gi, config);
      return [
        { f: (g.click as number) - 6, x: target.x + 8, y: target.y + 10 },
        { f: g.click as number, ...target },
        { f: (g.click as number) + 10, x: target.x + 60, y: target.y + 40 },
      ];
    }),
    { f: 300, x: config.exitCursor?.x ?? 170, y: config.exitCursor?.y ?? 260 },
  ] : [
    { f: 4, x: 640, y: 470 },
    { f: 22, x: a.x + 6, y: a.y + 10 },
    { f: 26, x: a.x, y: a.y },
    { f: 34, x: a.x + 60, y: a.y + 40 },
    { f: 52, x: a.x + 300, y: a.y + 150 },
    { f: 60, x: b.x + 8, y: b.y + 10 },
    { f: 64, x: b.x, y: b.y },
    { f: 76, x: 690, y: b.y + 70 }, // rest outside the panel: no accidental third pick
    { f: 90, x: 720, y: b.y + 110 },
  ];
  let i = 0;
  while (i < pts.length - 2 && frame > pts[i + 1].f) i++;
  const p0 = pts[i];
  const p1 = pts[i + 1];
  const p = interpolate(frame, [p0.f, p1.f], [0, 1], CLAMP);
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const opacity = interpolate(frame, [4, 10], [0, 1], CLAMP);
  const clicks = config.groups.map((g) => g.click).filter((c): c is number => c !== undefined);
  const clickFrame = clicks.find((c) => frame >= c && frame <= c + 10);
  return {
    x: interpolate(e, [0, 1], [p0.x, p1.x]),
    y: interpolate(e, [0, 1], [p0.y, p1.y]),
    opacity,
    clickFrame,
  };
}

/* ------------------------------------------------------------------------ */
/* Composition                                                               */
/* ------------------------------------------------------------------------ */

const SelectionFlowStage: React.FC<{ config: FlowConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cam = cameraAt(frame, config);
  const prev = cameraAt(Math.max(0, frame - 1), config);
  const screenVelocity = Math.abs(cam.focusY * cam.scale - prev.focusY * prev.scale);
  const vBlur = Math.min(7, screenVelocity * 0.16); // restrained, movement-only
  const tilt = Math.min(3, screenVelocity * 0.07);

  // Panel entrance (blur-in rise); pre-rolled so frame 0 already shows the panel
  const enter = config.full ? 1 : spring({ frame: frame + 5, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } });
  const enterBlur = interpolate(frame, [0, 8], [7, 0], CLAMP);

  const cursor = cursorAt(frame, config);

  // Hover: tile under the approaching cursor in the active, undecided group
  const hoverFor = (gi: number): number | null => {
    const g = config.groups[gi];
    if (g.click === undefined || frame >= g.click || frame < g.click - 10) return null;
    return g.selected as number;
  };

  const panelX = -PANEL_W / 2;
  const translateY = -cam.focusY * cam.scale + SCREEN_OFFSET_Y + (1 - enter) * 120;
  const activeGroup = config.groups.filter((g) => frame >= (g.start ?? 0)).at(-1)?.id;

  return (
    <AbsoluteFill
      data-selection-flow={config.full ? "full" : "study"}
      data-active-group={config.full ? activeGroup : undefined}
      data-camera-focus={cam.focusY}
      data-camera-scale={cam.scale}
      style={{ backgroundColor: "#000000", overflow: "hidden" }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="studyVBlur" x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation={`0 ${vBlur.toFixed(2)}`} />
        </filter>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 40% 55% at 50% 45%, rgba(255,255,255,0.045) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      {/* Camera world */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          perspective: 1800,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: panelX * cam.scale,
            top: 0,
            width: PANEL_W,
            transformOrigin: "0 0",
            transform: `translateY(${translateY}px) scale(${cam.scale}) rotateX(${tilt}deg)`,
            opacity: enter * (config.full ? interpolate(frame, [286, 300], [1, 0], CLAMP) : 1),
            filter:
              enterBlur > 0.2
                ? `blur(${enterBlur}px)`
                : vBlur > 0.3
                  ? "url(#studyVBlur)"
                  : "none",
          }}
        >
          {config.groups.map((g, gi) => (
            <Section key={g.id} group={g} gi={gi} frame={frame} fps={fps} hoveredTile={hoverFor(gi)} />
          ))}
        </div>
      </div>

      {/* Edge fades so neighbouring groups read as a continuous scroll */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #000 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 80%, #000 96%)",
          pointerEvents: "none",
        }}
      />

      <PickedStrip frame={frame} fps={fps} config={config} />

      <BlackCursor3D x={cursor.x} y={cursor.y} opacity={cursor.opacity} clickFrame={cursor.clickFrame} />
    </AbsoluteFill>
  );
};

export const AICharacterSelectionStudy: React.FC = () => <SelectionFlowStage config={STUDY_CONFIG} />;

/** Full ten-second flow reuses the existing study; its isolated 90-frame composition stays available. */
export const AICharacterSelectionFlow: React.FC<{
  groups: readonly SelectionFlowGroup[];
  exitCursor: { x: number; y: number };
}> = ({ groups, exitCursor }) => <SelectionFlowStage config={{ groups, full: true, exitCursor }} />;
