import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AICharacterSelectionFlow, type SelectionFlowGroup } from "./AICharacterSelectionStudy";

export const AI_CHARACTER_PROMO_FRAMES = 450; // 15.00s @ 30 FPS — AI Influencer Studio

/*
 * Continuous-panel direction (v4), preserving UGC-VID-055/056 contracts:
 * - Three curated choices per beat, never a full configurator grid or swatch row.
 * - Reuse the built study: camera scrolls between groups, picks flash in place,
 *   and selected settings accumulate. Handoff into the original recipe/Generate
 *   sequence at frame 300. V5 refines only Generate and the finale title.
 * - No click ripple rings. The sculpted, glossy black 3D cursor stays consistent
 *   through every selection and all pointer travel.
 */

const HIGGS_YELLOW = "#FFE600";
const HIGGS_CYAN = "#00F5D4";
const DISPLAY_FONT = "Inter, 'Arial Black', -apple-system, sans-serif";
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const ASSET = (name: string) => `explore/covers/sources/aichar/${name}`;

const CARD_W = 420;
const CARD_H = 560;
const STACK_X = -640;
const STACK_TOP = -236;
const STACK_GAP = 80;
const CHOICE_SCALE = 0.62;
const CHOICE_SPACING = 315;

interface TraitOption {
  label: string;
  src: string;
  fit?: "cover" | "contain";
  bg?: string;
}

interface TraitBeat {
  id: string;
  start: number;
  click: number;
  end: number;
  verb: string;
  category: string;
  value: string;
  src: string;
  fit?: "cover" | "contain";
  bg?: string;
  pillLabel: string;
  selectedSlot: -1 | 0 | 1;
  alternatives: readonly [TraitOption, TraitOption];
  sticker?: { label: string; swatches?: string[]; at: number };
  inset?: { src: string; label: string; swatch: string; at: number };
}

// Three authentic studio choices, with the same selected recipe and outcome.
const BEATS: readonly TraitBeat[] = [
  {
    id: "type",
    start: 0,
    click: 30,
    end: 56,
    verb: "PICK A TYPE",
    category: "CHARACTER TYPE",
    value: "EXTREME",
    src: ASSET("char-extreme.png"),
    pillLabel: "Extreme",
    selectedSlot: 0,
    alternatives: [
      { label: "Average", src: ASSET("char-average.png") },
      { label: "Bold", src: ASSET("char-bold.png") },
    ],
  },
  {
    id: "scene",
    start: 56,
    click: 76,
    end: 104,
    verb: "SET THE SCENE",
    category: "BACKGROUND",
    value: "STUDIO WALL",
    src: ASSET("bg-normal-wall.png"),
    pillLabel: "Studio Wall · Male 25",
    selectedSlot: 1,
    alternatives: [
      { label: "Workspace", src: ASSET("bg-workspace.png") },
      { label: "Cream Room", src: ASSET("bg-cream-room.png") },
    ],
    sticker: { label: "Male · Adult (25)", at: 84 },
  },
  {
    id: "heritage",
    start: 104,
    click: 124,
    end: 152,
    verb: "CHOOSE HERITAGE",
    category: "ETHNICITY",
    value: "MIDDLE EASTERN",
    src: ASSET("eth-middle-eastern.png"),
    pillLabel: "Middle Eastern · Light Olive",
    selectedSlot: -1,
    alternatives: [
      { label: "East Asian", src: ASSET("eth-east-asian.png") },
      { label: "Latina", src: ASSET("eth-latina.png") },
    ],
    sticker: { label: "Light Olive skin", swatches: ["#E5C8A8"], at: 132 },
  },
  {
    id: "face",
    start: 152,
    click: 170,
    end: 200,
    verb: "SCULPT THE FACE",
    category: "HEAD & EYES",
    value: "CHISELED",
    src: ASSET("head-chiseled.png"),
    pillLabel: "Chiseled · Round eyes",
    selectedSlot: 1,
    alternatives: [
      { label: "Oval", src: ASSET("head-oval.png") },
      { label: "Square", src: ASSET("head-square.png") },
    ],
    inset: {
      src: ASSET("eye-round.png"),
      label: "Round · Deep Espresso",
      swatch: "#3B2219",
      at: 178,
    },
  },
  {
    id: "hair",
    start: 200,
    click: 222,
    end: 254,
    verb: "STYLE THE HAIR",
    category: "HAIRSTYLE",
    value: "VOLUMINOUS CURLS",
    src: ASSET("hair-voluminous-curls.png"),
    pillLabel: "Curls · Black + Platinum",
    selectedSlot: 0,
    alternatives: [
      { label: "Natural Bob", src: ASSET("hair-bob.png") },
      { label: "Textured Crop", src: ASSET("hair-textured-crop.png") },
    ],
    sticker: {
      label: "Jet Black + Platinum Ash",
      swatches: ["#0B0B0B", "#D9D6CF"],
      at: 232,
    },
  },
  {
    id: "outfit",
    start: 254,
    click: 272,
    end: 300,
    verb: "DRESS THE LOOK",
    category: "OUTFIT",
    value: "CREW TEE & DENIM",
    src: ASSET("outfit-white-tee.png"),
    fit: "contain",
    bg: "#F1F1F3",
    pillLabel: "Crew Tee & Denim",
    selectedSlot: -1,
    alternatives: [
      { label: "Streetwear", src: ASSET("outfit-streetwear.png"), fit: "contain", bg: "#F1F1F3" },
      { label: "Leather Jacket", src: ASSET("outfit-leather-jacket.png"), fit: "contain", bg: "#F1F1F3" },
    ],
    sticker: { label: "Black · Half Portrait", swatches: ["#111111"], at: 280 },
  },
];

const GENERATE_START = 300;
const GENERATE_CLICK = 322;
const GENERATE_DONE = 344;
const FINALE_START = 352;

const activeBeatIndex = (frame: number) =>
  BEATS.findIndex((b) => frame >= b.start && frame < b.end);

const optionAtSlot = (beat: TraitBeat, slot: -1 | 0 | 1) => {
  if (slot === beat.selectedSlot) return undefined;
  const alternativeSlots = ([-1, 0, 1] as const).filter((s) => s !== beat.selectedSlot);
  return beat.alternatives[alternativeSlots.indexOf(slot)];
};

// Adapt the original recipe, image roles and exact pick times into the built study.
const FLOW_GROUPS: readonly SelectionFlowGroup[] = BEATS.map((beat, i) => {
  const choice = (slot: -1 | 0 | 1) => {
    const option = optionAtSlot(beat, slot);
    return {
      label: option?.label ?? beat.value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()),
      src: staticFile(option?.src ?? beat.src),
      fit: option?.fit ?? beat.fit,
      position: beat.id === "type" || beat.id === "heritage" ? "50% 30%" : undefined,
    };
  };
  return {
    id: beat.id,
    title: ["Character type", "Background", "Ethnicity", "Head & eyes", "Hairstyle", "Outfit"][i],
    count: 3,
    accent: ["#FF6B3D", "#3DA9FF", "#B66BFF", "#43CFC6", "#F18EBB", HIGGS_YELLOW][i],
    choices: [choice(-1), choice(0), choice(1)],
    selected: (beat.selectedSlot + 1) as 0 | 1 | 2,
    click: beat.click,
    start: beat.start,
    picked: beat.pillLabel,
    detail: beat.sticker ? {
      label: beat.sticker.label, at: beat.sticker.at, swatches: beat.sticker.swatches,
    } : beat.inset ? {
      label: beat.inset.label, at: beat.inset.at, swatches: [beat.inset.swatch], image: staticFile(beat.inset.src),
    } : undefined,
  };
});

/* ------------------------------------------------------------------------ */
/* Kinetic headlines (Talking Head formula: white verb top, yellow value below) */
/* ------------------------------------------------------------------------ */

const KineticHeadlines: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  if (frame >= FINALE_START - 4) return null;

  let top = "HIT GENERATE";
  let bottom = frame >= GENERATE_CLICK ? "GENERATING 4K…" : "10 TRAITS LOCKED";
  let topStart = GENERATE_START;
  let bottomStart = frame >= GENERATE_CLICK ? GENERATE_CLICK : GENERATE_START;
  let bottomPicked = frame >= GENERATE_CLICK;

  const idx = activeBeatIndex(frame);
  if (idx >= 0) {
    const beat = BEATS[idx];
    top = beat.verb;
    topStart = beat.start;
    bottomPicked = frame >= beat.click;
    bottom = bottomPicked ? beat.value : beat.category;
    bottomStart = bottomPicked ? beat.click : beat.start;
  }

  const fadeOut = interpolate(frame, [FINALE_START - 10, FINALE_START - 4], [1, 0], CLAMP);

  const topSpr = spring({
    frame: Math.max(0, frame - topStart),
    fps,
    config: { damping: 13, mass: 0.42, stiffness: 300 },
  });
  const botSpr = spring({
    frame: Math.max(0, frame - bottomStart),
    fps,
    config: { damping: 11, mass: 0.4, stiffness: 320 },
  });

  const lineStyle: React.CSSProperties = {
    fontFamily: DISPLAY_FONT,
    fontWeight: 900,
    fontStyle: "italic",
    lineHeight: 0.9,
    letterSpacing: "-0.03em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 50,
        paddingBottom: 46,
        opacity: fadeOut,
        zIndex: 40,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...lineStyle,
          fontSize: 92,
          color: "#FFFFFF",
          textShadow: "0 0 32px rgba(255,255,255,0.28), 0 12px 32px rgba(0,0,0,0.9)",
          opacity: interpolate(topSpr, [0, 0.4], [0, 1], CLAMP),
          filter: `blur(${interpolate(topSpr, [0, 0.6], [10, 0], CLAMP)}px)`,
          transform: `translate3d(0, ${interpolate(topSpr, [0, 1], [-26, 0])}px, 0) scale(${interpolate(topSpr, [0, 0.7, 1], [1.16, 0.97, 1])}, ${interpolate(topSpr, [0, 0.7, 1], [0.74, 1.04, 1])})`,
        }}
      >
        {top}
      </div>
      <div
        style={{
          ...lineStyle,
          fontSize: 88,
          color: bottomPicked ? HIGGS_YELLOW : "rgba(255,255,255,0.78)",
          textShadow: bottomPicked
            ? "0 0 36px rgba(255,230,0,0.42), 0 12px 32px rgba(0,0,0,0.9)"
            : "0 0 26px rgba(255,255,255,0.18), 0 12px 32px rgba(0,0,0,0.9)",
          opacity: interpolate(botSpr, [0, 0.4], [0, 1], CLAMP),
          filter: `blur(${interpolate(botSpr, [0, 0.6], [10, 0], CLAMP)}px)`,
          transform: `translate3d(0, ${interpolate(botSpr, [0, 1], [26, 0])}px, 0) scale(${interpolate(botSpr, [0, 0.7, 1], [1.2, 0.96, 1])}, ${interpolate(botSpr, [0, 0.7, 1], [0.7, 1.05, 1])})`,
        }}
      >
        {bottom}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Selected trait hero card                                                  */
/* ------------------------------------------------------------------------ */

const SwatchDot: React.FC<{ hex: string; size?: number }> = ({ hex, size = 22 }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      backgroundColor: hex,
      border: "2px solid rgba(255,255,255,0.85)",
      boxShadow: "0 4px 10px rgba(0,0,0,0.6)",
      flexShrink: 0,
      display: "inline-block",
    }}
  />
);

const SelectedTraitCard: React.FC<{
  beat: TraitBeat;
  index: number;
  frame: number;
  fps: number;
  option?: TraitOption;
  slot?: -1 | 0 | 1;
}> = ({ beat, index, frame, fps, option, slot = 0 }) => {
  if (frame < beat.start || frame >= beat.end) return null;
  const isChosenCard = slot === beat.selectedSlot;
  if (!isChosenCard && frame >= beat.click + 8) return null;

  const rel = frame - beat.start;
  const side = index % 2 === 0 ? 1 : -1;

  const enter = spring({
    frame: rel,
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 210 },
  });

  // Collapse toward the docked pill slot in the left recipe stack
  const exitStart = beat.end - 12;
  const exitP = isChosenCard ? interpolate(frame, [exitStart, beat.end], [0, 1], CLAMP) : 0;
  const exitE = exitP * exitP * (3 - 2 * exitP);
  const slotY = STACK_TOP + index * STACK_GAP;

  const pressScale =
    isChosenCard && frame >= beat.click && frame <= beat.click + 10
      ? interpolate(frame - beat.click, [0, 3, 7, 10], [1, 0.94, 1.04, 1], CLAMP)
      : 1;

  const picked = isChosenCard && frame >= beat.click;
  const pickSpr = picked
    ? spring({ frame: frame - beat.click, fps, config: { damping: 12, mass: 0.4, stiffness: 300 } })
    : 0;

  const idleFloat = Math.sin((frame + index * 11) * 0.07) * 6;
  const idleTilt = Math.sin((frame + index * 7) * 0.05) * 2.2;

  const clearP = interpolate(frame, [beat.click + 1, beat.click + 8], [0, 1], CLAMP);
  // Pick the actual left/right card, then bring that card to the existing hero/dock path.
  const chosenX = interpolate(pickSpr, [0, 1], [slot * CHOICE_SPACING, 0], CLAMP);
  const x = isChosenCard
    ? interpolate(exitE, [0, 1], [chosenX, STACK_X])
    : slot * (CHOICE_SPACING + clearP * 48);
  const y =
    interpolate(enter, [0, 1], [130, 0]) +
    idleFloat * (1 - exitE) +
    interpolate(exitE, [0, 1], [0, slotY]);
  const scale =
    interpolate(enter, [0, 1], [0.8, 1]) *
    (isChosenCard ? interpolate(pickSpr, [0, 1], [CHOICE_SCALE, 1]) : CHOICE_SCALE) *
    pressScale *
    interpolate(exitE, [0, 1], [1, 0.14]);
  const rotY =
    interpolate(enter, [0, 1], [32 * side, 0]) +
    idleTilt * (1 - exitE) +
    interpolate(exitE, [0, 1], [0, 24]);
  const rotZ = interpolate(enter, [0, 1], [5 * side, 0]) + interpolate(exitE, [0, 1], [0, -6]);
  const blur = interpolate(rel, [0, 9], [16, 0], CLAMP) + interpolate(exitE, [0.3, 1], [0, 6], CLAMP);
  const opacity = interpolate(rel, [0, 5], [0, 1], CLAMP) *
    (isChosenCard ? interpolate(exitE, [0.6, 1], [1, 0], CLAMP) : 1 - clearP);

  // Glossy light sweep across the card on pick (no ripple rings)
  const sweep = interpolate(frame, [beat.click, beat.click + 14], [-120, 160], CLAMP);
  const sweepOpacity =
    picked && frame <= beat.click + 14
      ? interpolate(frame - beat.click, [0, 3, 14], [0, 0.85, 0], CLAMP)
      : 0;

  const stickerSpr =
    isChosenCard && beat.sticker && frame >= beat.sticker.at
      ? spring({ frame: frame - beat.sticker.at, fps, config: { damping: 11, mass: 0.4, stiffness: 320 } })
      : 0;
  const insetSpr =
    isChosenCard && beat.inset && frame >= beat.inset.at
      ? spring({ frame: frame - beat.inset.at, fps, config: { damping: 12, mass: 0.45, stiffness: 280 } })
      : 0;

  return (
    <div
      data-trait-beat={beat.id}
      data-trait-option={slot}
      data-selected={picked}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: CARD_W,
        height: CARD_H,
        marginLeft: -CARD_W / 2,
        marginTop: -CARD_H / 2 + 10,
        transform: `perspective(1400px) translate3d(${x}px, ${y}px, 0) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`,
        opacity,
        filter: blur > 0.2 ? `blur(${blur}px)` : "none",
        zIndex: isChosenCard ? 32 : 30,
      }}
    >
      {/* Card body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 30,
          overflow: "hidden",
          backgroundColor: option?.bg ?? beat.bg ?? "#0B0B0E",
          border: picked
            ? `3px solid ${HIGGS_YELLOW}`
            : "2px solid rgba(255,255,255,0.22)",
          boxShadow: picked
            ? `0 40px 90px rgba(0,0,0,0.95), 0 0 ${interpolate(pickSpr, [0, 1], [70, 34])}px rgba(255,230,0,0.38)`
            : "0 40px 90px rgba(0,0,0,0.95)",
        }}
      >
        <Img
          src={staticFile(option?.src ?? beat.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: option?.fit ?? beat.fit ?? "cover",
          }}
        />
        {!picked && (
          <div
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 20,
              padding: "16px 8px",
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.8)",
              color: "#FFFFFF",
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              fontSize: 29,
              textAlign: "center",
              zIndex: 1,
            }}
          >
            {option?.label ?? beat.value}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 62%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        {sweepOpacity > 0.01 && (
          <div
            style={{
              position: "absolute",
              top: "-20%",
              bottom: "-20%",
              left: `${sweep}%`,
              width: "38%",
              background:
                "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 100%)",
              transform: "skewX(-14deg)",
              opacity: sweepOpacity,
            }}
          />
        )}
      </div>

      {/* Selected check chip */}
      {picked && (
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: HIGGS_YELLOW,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 26px rgba(0,0,0,0.7), 0 0 24px rgba(255,230,0,0.55)",
            transform: `scale(${interpolate(pickSpr, [0, 1], [0.2, 1])}) rotate(${interpolate(pickSpr, [0, 1], [-60, 0])}deg)`,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
      )}

      {/* Secondary pick sticker (gender / skin / hair colour / dye + framing) */}
      {beat.sticker && stickerSpr > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -30,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 24px",
            borderRadius: 14,
            backgroundColor: HIGGS_YELLOW,
            boxShadow: "0 18px 40px rgba(0,0,0,0.9), 0 0 28px rgba(255,230,0,0.45)",
            transform: `translateX(-50%) rotate(${interpolate(stickerSpr, [0, 1], [-14, -3])}deg) scale(${interpolate(stickerSpr, [0, 1], [0.3, 1])})`,
            whiteSpace: "nowrap",
          }}
        >
          {beat.sticker.swatches?.map((hex) => (
            <SwatchDot key={hex} hex={hex} size={26} />
          ))}
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize: 24,
              letterSpacing: "-0.01em",
              color: "#000000",
              textTransform: "uppercase",
            }}
          >
            {beat.sticker.label}
          </span>
        </div>
      )}

      {/* Inset mini card (eye shape + iris colour) */}
      {beat.inset && insetSpr > 0.01 && (
        <div
          style={{
            position: "absolute",
            right: -150,
            bottom: 36,
            width: 220,
            transform: `translate3d(${interpolate(insetSpr, [0, 1], [90, 0])}px, ${interpolate(insetSpr, [0, 1], [40, 0])}px, 0) rotate(${interpolate(insetSpr, [0, 1], [16, 6])}deg) scale(${interpolate(insetSpr, [0, 1], [0.5, 1])})`,
            opacity: interpolate(insetSpr, [0, 0.3], [0, 1], CLAMP),
          }}
        >
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 24,
              overflow: "hidden",
              border: `3px solid ${HIGGS_YELLOW}`,
              boxShadow: "0 26px 60px rgba(0,0,0,0.95)",
            }}
          >
            <Img src={staticFile(beat.inset.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              borderRadius: 12,
              backgroundColor: "#0B0B0E",
              border: "1.5px solid rgba(255,255,255,0.22)",
              whiteSpace: "nowrap",
            }}
          >
            <SwatchDot hex={beat.inset.swatch} size={20} />
            <span style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 18, color: "#FFFFFF" }}>
              {beat.inset.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Docked recipe pills (left stack) — selected traits only                   */
/* ------------------------------------------------------------------------ */

const pillOrbitPos = (i: number) => {
  const angle = (-150 + i * 60) * (Math.PI / 180);
  return { x: Math.cos(angle) * 520, y: Math.sin(angle) * 250 };
};

const RecipeStack: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  if (frame >= GENERATE_CLICK + 16) return null;

  return (
    <>
      {BEATS.map((beat, i) => {
        const dockAt = beat.end - 4;
        if (frame < dockAt) return null;

        const dockSpr = spring({
          frame: frame - dockAt,
          fps,
          config: { damping: 13, mass: 0.42, stiffness: 280 },
        });

        // Generate beat: pills orbit the button, then fuse into it on click
        const orbitSpr =
          frame >= GENERATE_START
            ? spring({
                frame: frame - GENERATE_START - i * 1.5,
                fps,
                config: { damping: 14, mass: 0.5, stiffness: 200 },
              })
            : 0;
        const fuseP = interpolate(frame, [GENERATE_CLICK, GENERATE_CLICK + 14], [0, 1], CLAMP);
        const fuseE = fuseP * fuseP;

        const orbit = pillOrbitPos(i);
        const baseX = interpolate(orbitSpr, [0, 1], [STACK_X, orbit.x]);
        const baseY = interpolate(orbitSpr, [0, 1], [STACK_TOP + i * STACK_GAP, orbit.y]);
        const x = interpolate(fuseE, [0, 1], [baseX, 0]);
        const y = interpolate(fuseE, [0, 1], [baseY, 0]);
        const scale =
          interpolate(dockSpr, [0, 1], [0.4, 1]) * interpolate(fuseE, [0, 1], [1, 0.2]);
        const opacity =
          interpolate(dockSpr, [0, 0.3], [0, 1], CLAMP) * interpolate(fuseE, [0.5, 1], [1, 0], CLAMP);
        const isNewest = frame - dockAt < 14;
        const float = Math.sin((frame + i * 13) * 0.06) * 3 * orbitSpr;

        return (
          <div
            key={beat.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 336,
              height: 66,
              marginLeft: -168,
              marginTop: -33,
              transform: `perspective(1200px) translate3d(${x}px, ${y + float}px, 0) rotateY(${interpolate(orbitSpr, [0, 1], [14, 0])}deg) scale(${scale})`,
              opacity,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "0 18px 0 9px",
              borderRadius: 999,
              backgroundColor: "#0A0A0D",
              border: isNewest
                ? `1.5px solid ${HIGGS_YELLOW}`
                : "1.5px solid rgba(255,255,255,0.16)",
              boxShadow: isNewest
                ? "0 18px 40px rgba(0,0,0,0.9), 0 0 22px rgba(255,230,0,0.35)"
                : "0 18px 40px rgba(0,0,0,0.9)",
              zIndex: 25 + i,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                overflow: "hidden",
                flexShrink: 0,
                backgroundColor: beat.bg ?? "#141418",
                border: "1.5px solid rgba(255,255,255,0.35)",
              }}
            >
              <Img
                src={staticFile(beat.src)}
                style={{ width: "100%", height: "100%", objectFit: beat.fit ?? "cover" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 700,
                  fontSize: 11.5,
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                }}
              >
                {beat.category}
              </span>
              <span
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 800,
                  fontSize: 17,
                  color: "#FFFFFF",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {beat.pillLabel}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};

/* ------------------------------------------------------------------------ */
/* Right-side odometer step counter                                          */
/* ------------------------------------------------------------------------ */

const StepOdometer: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  if (frame >= GENERATE_START + 8) return null;
  const exit = interpolate(frame, [GENERATE_START - 4, GENERATE_START + 8], [1, 0], CLAMP);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 440,
        height: 250,
        marginLeft: 640 - 220,
        marginTop: -125,
        overflow: "hidden",
        opacity: exit,
        zIndex: 20,
      }}
    >
      {BEATS.map((beat, i) => {
        const inSpr = spring({
          frame: Math.max(0, frame - beat.start),
          fps,
          config: { damping: 14, mass: 0.45, stiffness: 260 },
        });
        const outSpr =
          frame >= beat.end
            ? spring({ frame: frame - beat.end, fps, config: { damping: 14, mass: 0.45, stiffness: 260 } })
            : 0;
        if (frame < beat.start - 1 || outSpr > 0.995) return null;
        const y = interpolate(inSpr, [0, 1], [220, 0]) + interpolate(outSpr, [0, 1], [0, -220]);
        return (
          <div
            key={beat.id}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: `translate3d(0, ${y}px, 0)`,
            }}
          >
            <span
              style={{
                fontFamily: DISPLAY_FONT,
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: 210,
                lineHeight: 0.9,
                letterSpacing: "-0.05em",
                color: "rgba(255,255,255,0.03)",
                WebkitTextStroke: "3px rgba(255,255,255,0.85)",
              }}
            >
              {`0${i + 1}`}
            </span>
            <span
              style={{
                marginTop: 6,
                fontFamily: DISPLAY_FONT,
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "0.28em",
                color: HIGGS_YELLOW,
              }}
            >
              / 06
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Generate button beat                                                      */
/* ------------------------------------------------------------------------ */

const GenerateMoment: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  if (frame < GENERATE_START + 4 || frame >= FINALE_START) return null;
  const enter = spring({
    frame: frame - (GENERATE_START + 4),
    fps,
    config: { damping: 16, mass: 0.5, stiffness: 260 },
  });
  const clicked = frame >= GENERATE_CLICK;
  const isHoveringGenerate = frame >= GENERATE_CLICK - 10 && !clicked;
  const clickAge = frame - GENERATE_CLICK;
  // Reference: compress the circular action, release once, then settle.
  const press = clicked ? interpolate(clickAge, [0, 3, 8, 14], [1, 0.82, 1.13, 1], CLAMP) : 1;
  const bodyPress = clicked ? interpolate(clickAge, [0, 3, 8, 14], [1, 0.98, 1.025, 1], CLAMP) : 1;
  const shakeEnvelope = clicked ? interpolate(clickAge, [0, 12], [1, 0], CLAMP) : 0;
  const shakeX = Math.sin(clickAge * 2.2) * 6 * shakeEnvelope;
  const shakeRotate = Math.sin(clickAge * 1.7) * 0.45 * shakeEnvelope;
  const pct = Math.round(interpolate(frame, [GENERATE_CLICK, GENERATE_DONE], [8, 100], CLAMP));
  const exit = interpolate(frame, [GENERATE_DONE + 2, FINALE_START], [0, 1], CLAMP);
  const burst = interpolate(clickAge, [3, 17], [0, 1], CLAMP);
  const burstVisible = clicked && clickAge >= 3 && clickAge < 17;
  const iconScale = press * (isHoveringGenerate ? 1.06 : 1);

  return (
    <div
      data-generate-state={clicked ? "loading" : "ready"}
      data-generate-feedback={clicked && clickAge < 6 ? "press" : burstVisible ? "pixel-burst" : clicked ? "loading" : isHoveringGenerate ? "hover" : "ready"}
      data-press-scale={press}
      data-shake-x={shakeX}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 690,
        height: 150,
        marginLeft: -345,
        marginTop: -75,
        borderRadius: 34,
        background: "linear-gradient(160deg, #202328 0%, #131519 52%, #0B0D10 100%)",
        border: isHoveringGenerate ? "2px solid rgba(255,230,0,0.66)" : "2px solid rgba(255,255,255,0.22)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 0 #050608, 0 24px 44px rgba(0,0,0,0.8)",
        transform: `translate3d(${shakeX}px, 0, 0) rotate(${shakeRotate}deg) scale(${interpolate(enter, [0, 1], [0.65, 1]) * bodyPress * interpolate(exit, [0, 1], [1, 1.12])})`,
        opacity: interpolate(enter, [0, 0.3], [0, 1], CLAMP) * interpolate(exit, [0, 1], [1, 0]),
        boxSizing: "border-box",
        zIndex: 45,
      }}
    >
      <div style={{ position: "absolute", left: 38, right: 176, top: 24, fontFamily: DISPLAY_FONT }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14 }}>
          <span style={{ fontSize: 48, lineHeight: 1.15, fontWeight: 900, letterSpacing: "-0.035em", color: "#F7F5EF", whiteSpace: "nowrap" }}>
            {clicked ? "GENERATING" : "GENERATE"}
          </span>
          {clicked && <span data-generate-percent={pct} style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: HIGGS_YELLOW, whiteSpace: "nowrap" }}>{pct}%</span>}
        </div>
        <div style={{ marginTop: 9, fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#B8BAC1" }}>4K PORTRAIT</div>
        {clicked && <div style={{ position: "absolute", top: 88, left: 0, right: 0, height: 6, borderRadius: 3, overflow: "hidden", background: "rgba(255,255,255,0.12)" }}>
          <div data-generate-progress={pct} style={{ width: `${pct}%`, height: 6, background: HIGGS_YELLOW }} />
        </div>}
      </div>
      {/* Squares release from the action itself; no rings around the cursor. */}
      {burstVisible && Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const radius = 62 + burst * (54 + (i % 4) * 12);
        const size = (i % 3 === 0 ? 10 : 6) * (1 - burst * 0.55);
        return <span key={i} data-generate-pixel={i} style={{
          position: "absolute", left: 612 + Math.round(Math.cos(angle) * radius / 6) * 6 - size / 2,
          top: 73 + Math.round(Math.sin(angle) * radius / 6) * 6 - size / 2, width: size, height: size,
          background: i % 4 === 0 ? "#F7F5EF" : HIGGS_YELLOW,
          opacity: interpolate(burst, [0, 0.2, 1], [0.6, 0.9, 0], CLAMP),
          transform: `rotate(${i % 2 === 0 ? 0 : 45}deg)`, pointerEvents: "none",
        }} />;
      })}
      <div data-generate-action="spark" data-action-press={press} style={{
        position: "absolute", right: 18, top: 17, width: 112, height: 112, borderRadius: "50%",
        background: HIGGS_YELLOW, color: "#0B0D10", display: "grid", placeItems: "center",
        boxShadow: `inset 0 2px 0 rgba(255,255,255,0.6), 0 ${clicked && clickAge < 6 ? 2 : 6}px 0 #887700, 0 0 ${isHoveringGenerate || burstVisible ? 32 : 12}px rgba(255,230,0,0.3)`,
        transform: `scale(${iconScale})`,
      }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ transform: `rotate(${clicked ? interpolate(clickAge, [3, 14], [-12, 0], CLAMP) : isHoveringGenerate ? -8 : 0}deg)` }}>
          {clicked && pct === 100 ? <path d="M19 36L30 47L54 23" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /> : <>
            <path d="M41 8C44 26 48 30 65 33C48 36 44 41 41 59C38 41 34 36 17 33C34 30 38 26 41 8Z" fill="currentColor" />
            <path d="M16 43C18 51 20 53 28 55C20 57 18 60 16 68C14 60 12 57 4 55C12 53 14 51 16 43Z" fill="currentColor" />
          </>}
        </svg>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Finale: condensed folding title + original generated 4K portrait         */
/* ------------------------------------------------------------------------ */

const FoldedInfluencerTitle: React.FC<{ rel: number; fps: number }> = ({ rel, fps }) => {
  const settled = rel >= 46;
  const rows = [
    { text: "BUILD YOUR", size: 138, height: 148, color: "#F7F5EF", width: 980 },
    { text: "OWN AI", size: 186, height: 194, color: HIGGS_YELLOW, width: 980 },
    { text: "INFLUENCER", size: 174, height: 182, color: "#F7F5EF", width: 1040 },
  ];
  return <div data-finale-title="BUILD YOUR OWN AI INFLUENCER" data-title-settled={settled}
    aria-label="Build your own AI influencer" style={{ perspective: 1400, width: 1080 }}>
    {rows.map((row, ri) => {
      const start = 6 + ri * 4;
      const reveal = settled ? 1 : Math.min(1, spring({ frame: Math.max(0, rel - start), fps, config: { damping: 18, mass: 0.45, stiffness: 240 } }));
      return <div key={row.text} data-finale-row={ri} aria-hidden="true" style={{
        height: row.height, width: row.width, fontFamily: "'AI Character Anton', Impact, sans-serif", fontSize: row.size,
        fontWeight: 400, lineHeight: 1, letterSpacing: "-0.015em", whiteSpace: "nowrap", color: row.color,
        opacity: interpolate(reveal, [0, 0.25], [0, 1], CLAMP), transformOrigin: "left center",
        transform: settled ? "none" : `rotateY(${(1 - reveal) * -14}deg) skewY(${(1 - reveal) * (ri % 2 ? 4 : -4)}deg)`,
      }}>
        {row.text.split("").map((char, i) => {
          const p = settled ? 1 : Math.min(1, spring({ frame: Math.max(0, rel - start - i * 0.55), fps, config: { damping: 18, mass: 0.45, stiffness: 240 } }));
          const side = (i / (row.text.length - 1) - 0.5) * 2;
          return <span key={i} data-title-glyph={`${ri}-${i}`} style={{
            display: "inline-block", transformOrigin: "50% 70%",
            transform: settled ? "none" : `translateY(${(1 - p) * (ri % 2 ? -42 : 42)}px) rotateY(${side * 38 * (1 - p)}deg) scale(${0.66 + p * 0.34}, ${1.36 - p * 0.36})`,
            opacity: p, textShadow: ri === 1 ? "0 4px 0 #5E5100" : "none",
          }}>{char === " " ? "\u00a0" : char}</span>;
        })}
      </div>;
    })}
  </div>;
};

const EditorialCharacterFinale: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  if (frame < FINALE_START) return null;
  const rel = frame - FINALE_START;

  const portraitSpr = spring({ frame: rel, fps, config: { damping: 14, mass: 0.55, stiffness: 200 } });
  const slab = spring({ frame: Math.max(0, rel - 18), fps, config: { damping: 11, mass: 0.4, stiffness: 320 } });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 80px 0 84px",
        zIndex: 60,
      }}
    >
      {/* Reference-based fold resolves into an unwarped, readable hold. */}
      <div style={{ width: 1110, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <FoldedInfluencerTitle rel={rel} fps={fps} />
        <div style={{ marginTop: 30, opacity: interpolate(rel, [24, 36], [0, 1], CLAMP), transform: `translateY(${interpolate(rel, [24, 36], [18, 0], CLAMP)}px)` }}>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 25, fontWeight: 800, letterSpacing: "0.025em", color: HIGGS_YELLOW }}>ZERO PHOTOSHOOTS • 100% STUDIO</div>
          <div style={{ marginTop: 12, fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 48, lineHeight: 1, color: "#F7F5EF" }}>made in clicks.</div>
        </div>
      </div>

      {/* RIGHT: generated 4K portrait */}
      <div
        style={{
          position: "relative",
          width: 540,
          height: 740,
          borderRadius: 32,
          overflow: "hidden",
          backgroundColor: "#08080C",
          border: `3px solid ${HIGGS_YELLOW}`,
          boxShadow: "0 40px 100px rgba(0,0,0,0.98), 0 0 50px rgba(255,230,0,0.32)",
          transform: `perspective(1400px) rotateY(${interpolate(portraitSpr, [0, 1], [-18, -4])}deg) scale(${interpolate(portraitSpr, [0, 1], [1.14, 1])})`,
          filter: `blur(${interpolate(rel, [0, 8], [12, 0], CLAMP)}px)`,
          opacity: interpolate(rel, [0, 4], [0, 1], CLAMP),
        }}
      >
        <Img
          src={staticFile(ASSET("aichar-final-outcome.png"))}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 66%, rgba(0,0,0,0.9) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "9px 16px",
            borderRadius: 999,
            backgroundColor: "rgba(5,5,8,0.9)",
            border: `1.5px solid ${HIGGS_YELLOW}`,
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: HIGGS_CYAN, boxShadow: `0 0 10px ${HIGGS_CYAN}` }} />
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: "0.1em",
              color: "#FFFFFF",
            }}
          >
            GENERATED · 4K STUDIO
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            bottom: 22,
            padding: "15px 20px",
            borderRadius: 14,
            backgroundColor: HIGGS_YELLOW,
            textAlign: "center",
            fontFamily: DISPLAY_FONT,
            fontWeight: 900,
            fontSize: 18,
            color: "#000000",
            boxShadow: "0 12px 28px rgba(255,230,0,0.4)",
            transform: `translate3d(0, ${interpolate(slab, [0, 1], [80, 0])}px, 0)`,
          }}
        >
          ★ Saved to My Influencers
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------ */
/* Persistent sculpted black 3D cursor (no ripple rings)                     */
/* ------------------------------------------------------------------------ */

/**
 * Keep the original selective stage-tilt choreography independent of cursor style.
 * The cursor itself is black and fully extruded for its entire visible lifetime.
 */
function getStageTiltProgress(frame: number): number {
  const windows: Array<[number, number, number, number]> = [
    [20, 27, 37, 44],
    [212, 219, 234, 242],
    [308, 315, 332, 340],
  ];
  for (const [a, b, c, d] of windows) {
    if (frame >= a && frame <= d) {
      const v = frame < b
        ? interpolate(frame, [a, b], [0, 1], CLAMP)
        : frame <= c
          ? 1
          : interpolate(frame, [c, d], [1, 0], CLAMP);
      return v * v * (3 - 2 * v);
    }
  }
  return 0;
}

const ARROW_PATH = "M0 0 L0 30 L7 23.6 L11.8 34.6 L17.4 32.2 L12.6 21.4 L21.8 21.4 Z";
const VB = 4; // viewBox padding around the tip

const Interactive3DCursorActor: React.FC<{
  x: number;
  y: number;
  opacity: number;
  clickFrame?: number;
  mode3D: 1;
}> = ({ x, y, opacity, clickFrame, mode3D }) => {
  const frame = useCurrentFrame();
  if (opacity <= 0.01) return null;

  const press =
    clickFrame !== undefined && frame >= clickFrame && frame <= clickFrame + 9
      ? interpolate(frame - clickFrame, [0, 3, 9], [1, 0.82, 1], CLAMP)
      : 1;

  const unit = interpolate(mode3D, [0, 1], [1.45, 3.1]) * press; // px per path unit
  const w = 36 * unit;
  const h = 46 * unit;
  const tip = VB * unit;
  const depth = 9;

  const rotX = 20 * mode3D;
  const rotY = -22 * mode3D;
  const rotZ = -6 * mode3D;

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
      {/* Soft contact shadow (3D only) */}
      {mode3D > 0.02 && (
        <svg
          width={w}
          height={h}
          viewBox={`-${VB} -${VB} 36 46`}
          style={{
            position: "absolute",
            left: -tip + 14 * mode3D,
            top: -tip + 22 * mode3D,
            filter: `blur(${4 + 6 * mode3D}px)`,
            opacity: 0.6 * mode3D,
          }}
        >
          <path d={ARROW_PATH} fill="#000" />
        </svg>
      )}

      <div
        style={{
          position: "absolute",
          left: -tip,
          top: -tip,
          width: w,
          height: h,
          transform: `perspective(600px) translate3d(${-6 * mode3D}px, ${-10 * mode3D}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
          transformOrigin: `${tip}px ${tip}px`,
        }}
      >
        {/* Sculpted glossy 3D arrow: real extrusion + bevel + specular rim */}
        {mode3D > 0.02 && (
          <svg
            width={w}
            height={h}
            viewBox={`-${VB} -${VB} 36 46`}
            style={{ position: "absolute", inset: 0, opacity: mode3D, overflow: "visible" }}
          >
            <defs>
              <linearGradient id="aicharCursorFace" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#77777F" />
                <stop offset="38%" stopColor="#34343A" />
                <stop offset="70%" stopColor="#151518" />
                <stop offset="100%" stopColor="#3E3E45" />
              </linearGradient>
              <linearGradient id="aicharCursorRim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="45%" stopColor="rgba(255,255,255,0.25)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <linearGradient id="aicharCursorGloss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                <stop offset="60%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            {/* Extrusion side walls, far → near */}
            {Array.from({ length: depth }, (_, k) => depth - k).map((d) => {
              const t = d / depth;
              const shade = Math.round(interpolate(t, [0, 1], [46, 10]));
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
            {/* Top face */}
            <path d={ARROW_PATH} fill="url(#aicharCursorFace)" stroke="#0B0B0D" strokeWidth={0.7} strokeLinejoin="round" />
            {/* Inner bevel gloss */}
            <path d={ARROW_PATH} fill="url(#aicharCursorGloss)" transform="translate(2.4 4.6) scale(0.78)" />
            {/* Specular rim on the lit edges */}
            <path d={ARROW_PATH} fill="none" stroke="url(#aicharCursorRim)" strokeWidth={0.9} strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Cursor trajectory                                                         */
/* ------------------------------------------------------------------------ */

function getCursorState(frame: number): {
  x: number;
  y: number;
  opacity: number;
  clickFrame?: number;
} {
  if (frame < 6 || frame > 350) {
    return { x: 520, y: 420, opacity: 0 };
  }

  interface Waypoint {
    frame: number;
    x: number;
    y: number;
    isClick?: boolean;
  }

  // Every approach/click targets the selected slot, using the same slot data as the cards.
  const choiceX = (i: number) => BEATS[i].selectedSlot * CHOICE_SPACING;
  const handoffP = 6 / 22;
  const handoffEase = 4 * handoffP * handoffP * handoffP;
  const waypoints: readonly Waypoint[] = [
    { frame: 6, x: 560, y: 430 },
    { frame: 24, x: choiceX(0) + 70, y: 60 },
    { frame: 30, x: choiceX(0) + 50, y: 40, isClick: true }, // Extreme
    { frame: 48, x: 190, y: 230 },
    { frame: 70, x: choiceX(1) - 10, y: 90 },
    { frame: 76, x: choiceX(1) - 30, y: 70, isClick: true }, // Studio Wall (right)
    { frame: 96, x: 210, y: 270 },
    { frame: 118, x: choiceX(2) + 40, y: 40 },
    { frame: 124, x: choiceX(2) + 20, y: 20, isClick: true }, // Middle Eastern (left)
    { frame: 144, x: -210, y: 250 },
    { frame: 164, x: choiceX(3) - 60, y: 90 },
    { frame: 170, x: choiceX(3) - 80, y: 70, isClick: true }, // Chiseled (right)
    { frame: 192, x: -230, y: 250 },
    { frame: 216, x: choiceX(4) + 30, y: -30 },
    { frame: 222, x: choiceX(4) + 10, y: -50, isClick: true }, // Voluminous Curls
    { frame: 246, x: 190, y: 240 },
    { frame: 266, x: choiceX(5) - 20, y: 50 },
    { frame: 272, x: choiceX(5) - 40, y: 30, isClick: true }, // Crew Tee & Denim (left)
    { frame: 294, x: 170, y: 260 },
    { frame: 300, x: interpolate(handoffEase, [0, 1], [170, 70]), y: interpolate(handoffEase, [0, 1], [260, 30]) },
    { frame: 316, x: 278, y: 18 },
    { frame: GENERATE_CLICK, x: 269, y: 0, isClick: true }, // Circular Generate action (3D)
    { frame: 340, x: 260, y: 250 },
    { frame: 350, x: 380, y: 380 },
  ];

  let prev = waypoints[0];
  let next = waypoints[waypoints.length - 1];
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (frame >= waypoints[i].frame && frame <= waypoints[i + 1].frame) {
      prev = waypoints[i];
      next = waypoints[i + 1];
      break;
    }
  }

  const p = interpolate(frame, [prev.frame, next.frame], [0, 1], CLAMP);
  const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const x = interpolate(eased, [0, 1], [prev.x, next.x]);
  const y = interpolate(eased, [0, 1], [prev.y, next.y]);

  const opacity =
    frame < 12
      ? interpolate(frame, [6, 12], [0, 1], CLAMP)
      : interpolate(frame, [338, 350], [1, 0], CLAMP);

  let clickFrame: number | undefined;
  for (const w of waypoints) {
    if (w.isClick && frame >= w.frame && frame <= w.frame + 10) {
      clickFrame = w.frame;
      break;
    }
  }

  return { x, y, opacity, clickFrame };
}

/* ------------------------------------------------------------------------ */
/* Composition                                                               */
/* ------------------------------------------------------------------------ */

const CLICK_FRAMES = [...BEATS.map((b) => b.click), GENERATE_CLICK];

export const AICharacterPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cursor = getCursorState(frame);
  const stageTilt = getStageTiltProgress(frame);

  // Camera punch on every pick, push-in on Generate, settle on the finale
  let punch = 0;
  for (const cf of CLICK_FRAMES) {
    if (frame >= cf && frame < cf + 16) {
      punch = interpolate(frame - cf, [0, 3, 16], [0, 0.022, 0], CLAMP);
    }
  }
  const generatePush = interpolate(frame, [GENERATE_CLICK, GENERATE_DONE + 4], [0, 0.08], CLAMP);
  const finaleSettle =
    frame >= FINALE_START
      ? interpolate(
          spring({ frame: frame - FINALE_START, fps, config: { damping: 14, mass: 0.6, stiffness: 190 } }),
          [0, 1],
          [1.06, 1]
        )
      : 1;
  const cameraScale =
    frame >= FINALE_START ? finaleSettle : 1 + punch + generatePush;
  const cameraBlur =
    frame >= GENERATE_DONE - 2 && frame <= FINALE_START + 6
      ? interpolate(frame, [GENERATE_DONE - 2, FINALE_START - 2, FINALE_START + 6], [0, 6, 0], CLAMP)
      : 0;

  // Preserve the original stage accents; continuous cursor depth does not tilt the finale.
  const stageRotateX = 2.4 * stageTilt;
  const stageRotateY = (frame >= GENERATE_START ? -3 : 2.4) * stageTilt;

  // White flash bridging Generate → finale reveal
  const flash =
    frame >= GENERATE_DONE && frame <= FINALE_START + 8
      ? interpolate(frame, [GENERATE_DONE, FINALE_START, FINALE_START + 8], [0, 0.9, 0], CLAMP)
      : 0;

  const activeIdx = activeBeatIndex(frame);
  const selectionFlowActive = frame < GENERATE_START;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <style>
        {`
          @font-face {
            font-family: 'Instrument Serif';
            font-style: italic;
            font-weight: 400;
            src: url('${staticFile("fonts/instrument-serif-latin-400-italic.woff2")}') format('woff2');
          }
        `}
      </style>

      {frame >= GENERATE_START && <style>{`
        @font-face {
          font-family: 'AI Character Anton';
          font-style: normal;
          font-weight: 400;
          src: url('${staticFile("fonts/anton-latin-400-normal.woff2")}') format('woff2');
        }
      `}</style>}

      {/* Soft spotlight behind the focused element (still pure black at the edges) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 46% 52% at 50% 52%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          transform: selectionFlowActive ? "none" : `perspective(1800px) scale(${cameraScale}) rotateX(${stageRotateX}deg) rotateY(${stageRotateY}deg)`,
          transformOrigin: "50% 50%",
          filter: cameraBlur > 0.2 ? `blur(${cameraBlur}px)` : "none",
        }}
      >
        {selectionFlowActive ? (
          <>
            <AICharacterSelectionFlow groups={FLOW_GROUPS} exitCursor={getCursorState(GENERATE_START)} />
            {frame >= 290 && (
              <AbsoluteFill
                data-recipe-handoff-opacity={interpolate(frame, [290, GENERATE_START], [0, 1], CLAMP)}
                style={{ opacity: interpolate(frame, [290, GENERATE_START], [0, 1], CLAMP), pointerEvents: "none" }}>
                <RecipeStack frame={frame} fps={fps} />
              </AbsoluteFill>
            )}
          </>
        ) : (
          <>
        <KineticHeadlines frame={frame} fps={fps} />
        <StepOdometer frame={frame} fps={fps} />
        <RecipeStack frame={frame} fps={fps} />
        {activeIdx >= 0 && ([-1, 0, 1] as const).map((slot) => (
          <SelectedTraitCard
            key={`${BEATS[activeIdx].id}-${slot}`}
            beat={BEATS[activeIdx]}
            index={activeIdx}
            frame={frame}
            fps={fps}
            slot={slot}
            option={optionAtSlot(BEATS[activeIdx], slot)}
          />
        ))}
        <GenerateMoment frame={frame} fps={fps} />
        <EditorialCharacterFinale frame={frame} fps={fps} />
        <Interactive3DCursorActor
          x={cursor.x}
          y={cursor.y}
          opacity={cursor.opacity}
          clickFrame={cursor.clickFrame}
          mode3D={1}
        />
          </>
        )}
      </AbsoluteFill>

      {flash > 0.01 && (
        <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity: flash, pointerEvents: "none" }} />
      )}
    </AbsoluteFill>
  );
};
