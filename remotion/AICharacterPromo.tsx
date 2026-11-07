import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AICharacterSelectionFlow, type SelectionFlowGroup } from "./AICharacterSelectionStudy";

export const PART_FRAMES = 450; // 15.00s @ 30 FPS per influencer build + finale
export const AI_CHARACTER_PROMO_FRAMES = PART_FRAMES * 2; // 30.00s @ 30 FPS — Part 1 (Male) + Part 2 (Female)

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
    value: "TEXTURED CROP",
    src: ASSET("hair-textured-crop.png"),
    pillLabel: "Textured Crop · Jet Black",
    selectedSlot: 0,
    alternatives: [
      { label: "Natural Bob", src: ASSET("hair-bob.png") },
      { label: "Voluminous Curls", src: ASSET("hair-voluminous-curls.png") },
    ],
    sticker: {
      label: "Jet Black",
      swatches: ["#0B0B0B"],
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
    value: "STREETWEAR",
    src: ASSET("outfit-streetwear.png"),
    fit: "contain",
    bg: "#F1F1F3",
    pillLabel: "Streetwear",
    selectedSlot: 0,
    alternatives: [
      { label: "Crew Tee & Denim", src: ASSET("outfit-white-tee.png"), fit: "contain", bg: "#F1F1F3" },
      { label: "Leather Jacket", src: ASSET("outfit-leather-jacket.png"), fit: "contain", bg: "#F1F1F3" },
    ],
    sticker: { label: "Black · Half Portrait", swatches: ["#111111"], at: 280 },
  },
];

const FEMALE_BEATS: readonly TraitBeat[] = [
  {
    id: "type",
    start: 0,
    click: 30,
    end: 56,
    verb: "PICK A TYPE",
    category: "CHARACTER TYPE",
    value: "AVERAGE",
    src: ASSET("char-average.png"),
    pillLabel: "Average",
    selectedSlot: -1,
    alternatives: [
      { label: "Extreme", src: ASSET("char-extreme.png") },
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
    value: "CREAM ROOM",
    src: ASSET("bg-cream-room.png"),
    pillLabel: "Cream Room · Female 24",
    selectedSlot: 0,
    alternatives: [
      { label: "Workspace", src: ASSET("bg-workspace.png") },
      { label: "Studio Wall", src: ASSET("bg-normal-wall.png") },
    ],
    sticker: { label: "Female · Adult (24)", at: 84 },
  },
  {
    id: "heritage",
    start: 104,
    click: 124,
    end: 152,
    verb: "CHOOSE HERITAGE",
    category: "ETHNICITY",
    value: "LATINA",
    src: ASSET("eth-latina.png"),
    pillLabel: "Latina · Golden Tan",
    selectedSlot: 1,
    alternatives: [
      { label: "Middle Eastern", src: ASSET("eth-middle-eastern.png") },
      { label: "East Asian", src: ASSET("eth-east-asian.png") },
    ],
    sticker: { label: "Golden Tan skin", swatches: ["#D8A47F"], at: 132 },
  },
  {
    id: "face",
    start: 152,
    click: 170,
    end: 200,
    verb: "SCULPT THE FACE",
    category: "HEAD & EYES",
    value: "OVAL",
    src: ASSET("head-oval.png"),
    pillLabel: "Oval · Almond eyes",
    selectedSlot: -1,
    alternatives: [
      { label: "Square", src: ASSET("head-square.png") },
      { label: "Chiseled", src: ASSET("head-chiseled.png") },
    ],
    inset: {
      src: ASSET("eye-almond.png"),
      label: "Almond · Warm Hazel",
      swatch: "#6E4B26",
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
    value: "NATURAL BOB",
    src: ASSET("hair-bob.png"),
    pillLabel: "Natural Bob · Espresso Brown",
    selectedSlot: -1,
    alternatives: [
      { label: "Textured Crop", src: ASSET("hair-textured-crop.png") },
      { label: "Voluminous Curls", src: ASSET("hair-voluminous-curls.png") },
    ],
    sticker: {
      label: "Espresso Brown",
      swatches: ["#231712"],
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
    sticker: { label: "Cream · Half Portrait", swatches: ["#F3EFE6"], at: 280 },
  },
];

const GENERATE_START = 300;
const GENERATE_CLICK = 322;
const GENERATE_DONE = 344;
const FINALE_START = 352;

const activeBeatIndex = (frame: number, beats: readonly TraitBeat[] = BEATS) =>
  beats.findIndex((b) => frame >= b.start && frame < b.end);

const optionAtSlot = (beat: TraitBeat, slot: -1 | 0 | 1) => {
  if (slot === beat.selectedSlot) return undefined;
  const alternativeSlots = ([-1, 0, 1] as const).filter((s) => s !== beat.selectedSlot);
  return beat.alternatives[alternativeSlots.indexOf(slot)];
};

const buildFlowGroups = (beats: readonly TraitBeat[]): readonly SelectionFlowGroup[] =>
  beats.map((beat, i) => {
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

const FLOW_GROUPS: readonly SelectionFlowGroup[] = buildFlowGroups(BEATS);
const FEMALE_FLOW_GROUPS: readonly SelectionFlowGroup[] = buildFlowGroups(FEMALE_BEATS);

/* ------------------------------------------------------------------------ */
/* Kinetic headlines (Talking Head formula: white verb top, yellow value below) */
/* ------------------------------------------------------------------------ */

const SmoothWaveLine: React.FC<{
  text: string;
  relFrame: number;
  fontSize: number;
  activeColor: string;
  mutedColor?: string;
  stagger?: number;
  duration?: number;
  withStar?: boolean;
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
  fontWeight?: number;
  letterSpacing?: string;
  textShadow?: string;
}> = ({
  text,
  relFrame,
  fontSize,
  activeColor,
  mutedColor = "rgba(255,255,255,0.28)",
  stagger = 0.85,
  duration = 10,
  withStar = false,
  fontFamily = DISPLAY_FONT,
  fontStyle = "normal",
  fontWeight = 900,
  letterSpacing = "-0.025em",
  textShadow = "0 10px 28px rgba(0,0,0,0.85)",
}) => {
  const chars = text.split("");
  const starProgress = interpolate(relFrame, [0, 12], [0, 1], CLAMP);
  const starEased = 1 - Math.pow(1 - starProgress, 3);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: withStar ? 18 : 0,
        whiteSpace: "nowrap",
      }}
    >
      {withStar && (
        <span
          style={{
            display: "inline-block",
            fontSize: Math.round(fontSize * 0.56),
            color: HIGGS_YELLOW,
            opacity: interpolate(starEased, [0, 1], [0, 1], CLAMP),
            filter: `blur(${interpolate(starEased, [0, 1], [8, 0], CLAMP)}px)`,
            transform: `scale(${interpolate(starEased, [0, 1], [0.4, 1], CLAMP)}) rotate(${interpolate(starEased, [0, 1], [-90, 0], CLAMP)}deg)`,
            textShadow: "0 0 24px rgba(255,230,0,0.55)",
          }}
        >
          ✦
        </span>
      )}
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          fontFamily,
          fontStyle,
          fontWeight,
          fontSize,
          lineHeight: 0.96,
          letterSpacing,
        }}
      >
        {chars.map((ch, idx) => {
          const pRaw = interpolate(
            relFrame - idx * stagger,
            [0, duration],
            [0, 1],
            CLAMP
          );
          const p = 1 - Math.pow(1 - pRaw, 3);
          const blurPx = interpolate(p, [0, 1], [11, 0], CLAMP);
          const yPx = interpolate(p, [0, 1], [12, 0], CLAMP);
          const scaleVal = interpolate(p, [0, 1], [0.94, 1], CLAMP);
          const opVal = interpolate(p, [0, 1], [0.16, 1], CLAMP);

          return (
            <span
              key={idx}
              style={{
                display: "inline-block",
                color: p > 0.45 ? activeColor : mutedColor,
                opacity: opVal,
                filter: blurPx > 0.15 ? `blur(${blurPx.toFixed(2)}px)` : "none",
                transform: `translate3d(0, ${yPx.toFixed(2)}px, 0) scale(${scaleVal.toFixed(3)})`,
                textShadow: p > 0.6 ? textShadow : "none",
              }}
            >
              {ch === " " ? "\u00a0" : ch}
            </span>
          );
        })}
      </span>
    </div>
  );
};

const KineticHeadlines: React.FC<{
  frame: number;
  fps: number;
  beats?: readonly TraitBeat[];
}> = ({ frame, beats = BEATS }) => {
  if (frame >= FINALE_START - 4) return null;

  let top = "Hit Generate";
  let bottom = frame >= GENERATE_CLICK ? "Generating 4K Studio…" : "6 Traits Locked In";
  let topStart = GENERATE_START;
  let bottomStart = frame >= GENERATE_CLICK ? GENERATE_CLICK : GENERATE_START + 3;
  let bottomPicked = frame >= GENERATE_CLICK;

  const idx = activeBeatIndex(frame, beats);
  if (idx >= 0) {
    const beat = beats[idx];
    top = beat.verb;
    topStart = beat.start;
    bottomPicked = frame >= beat.click;
    bottom = bottomPicked ? beat.value : beat.category;
    bottomStart = bottomPicked ? beat.click : beat.start;
  }

  const fadeOut = interpolate(frame, [FINALE_START - 10, FINALE_START - 4], [1, 0], CLAMP);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 58,
        paddingBottom: 54,
        opacity: fadeOut,
        zIndex: 40,
        pointerEvents: "none",
      }}
    >
      <SmoothWaveLine
        text={top}
        relFrame={Math.max(0, frame - topStart)}
        fontSize={76}
        activeColor="#F7F5EF"
        stagger={0.8}
        duration={10}
        withStar
        letterSpacing="-0.03em"
        textShadow="0 0 28px rgba(255,255,255,0.22), 0 12px 32px rgba(0,0,0,0.9)"
      />
      <SmoothWaveLine
        text={bottom}
        relFrame={Math.max(0, frame - bottomStart)}
        fontSize={72}
        activeColor={bottomPicked ? HIGGS_YELLOW : "rgba(247,245,239,0.86)"}
        stagger={0.75}
        duration={10}
        withStar={bottomPicked}
        letterSpacing="-0.03em"
        textShadow={
          bottomPicked
            ? "0 0 34px rgba(255,230,0,0.38), 0 12px 32px rgba(0,0,0,0.9)"
            : "0 10px 28px rgba(0,0,0,0.85)"
        }
      />
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
  if (frame >= 0 || frame >= GENERATE_CLICK + 16) return null;

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

const GenerateMoment: React.FC<{
  frame: number;
  fps: number;
  variant?: GenerateButtonVariant;
}> = ({ frame, fps, variant = "style4" }) => {
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

  if (variant === "style4") {
    // STYLE #4 FROM REFERENCE VIDEO (0:20-0:25):
    // Phase 1 (frames 304-321): White pill + 3D bottom-left coral-pink offset slab + top-right 4-point sparkles pop in cleanly (no static left arrow before click).
    // Phase 2 (clickAge 0..13, frames 322-335): Click on the right side launches a 270° over-the-top looping swoosh arrow from right -> top -> left cap (matching btn4_dense/frame-033 -> frame-036).
    // Phase 3 (clickAge 11..20, frames 333-342): Left-edge strike bursts into white ink-outlined droplets (! teardrop + 5 dots) while the front white pill rocks CLOCKWISE (+6.5deg: left lifts, right dips) against the 3D offset slab (matching btn4_dense/frame-039).
    // Phase 4 (clickAge 19..26, frames 341-348): Pill snaps back level (0deg) with two bottom-left diagonal impact ticks (//).

    const slabEnter = spring({
      frame: Math.max(0, frame - (GENERATE_START + 6)),
      fps,
      config: { damping: 14, mass: 0.45, stiffness: 260 },
    });
    const sparklePop = spring({
      frame: Math.max(0, frame - (GENERATE_START + 8)),
      fps,
      config: { damping: 11, mass: 0.4, stiffness: 300 },
    });

    // Front white pill clockwise scissor-tilt when the looping arrow strikes the left cap (clickAge 10..20)
    const frontPillTilt = clicked
      ? interpolate(
          clickAge,
          [0, 3, 7, 11, 15, 20, 24],
          [0, -1.6, 0, 4.2, 6.8, -1.1, 0],
          CLAMP
        )
      : isHoveringGenerate
        ? -0.8
        : 0;

    // Back 3D slab counter-tilts slightly to create the open "wedge" scissor gap on the left
    const backSlabTilt = clicked
      ? interpolate(
          clickAge,
          [0, 3, 11, 15, 20, 24],
          [0, 1.2, -1.8, -2.8, 0.6, 0],
          CLAMP
        )
      : 0;

    const frontPillY = clicked
      ? interpolate(
          clickAge,
          [0, 3, 7, 14, 20],
          [0, 6, 0, -4, 0],
          CLAMP
        )
      : 0;

    // Phase 2: Over-the-top looping swoosh arrow (clickAge 0..12)
    // Exact parametric curve from Right Click Point (692, 188) -> Top Arc (400, 24) -> Left Cap Loop (44, 156 -> 106, 206)
    const evalLoopPoint = (u: number): { x: number; y: number } => {
      const clamped = Math.max(0, Math.min(1, u));
      if (clamped <= 0.5) {
        const t = clamped * 2;
        const mt = 1 - t;
        // Segment 1: Right click (692, 188) -> Top-right (760, 44) -> Top-center (400, 24)
        const x =
          mt * mt * mt * 692 +
          3 * mt * mt * t * 768 +
          3 * mt * t * t * 620 +
          t * t * t * 400;
        const y =
          mt * mt * mt * 188 +
          3 * mt * mt * t * 62 +
          3 * mt * t * t * 22 +
          t * t * t * 24;
        return { x, y };
      } else {
        const t = (clamped - 0.5) * 2;
        const mt = 1 - t;
        // Segment 2: Top-center (400, 24) -> Top-left (90, 26) -> Left semicircle loop (24, 198) -> Left pill strike (106, 204)
        const x =
          mt * mt * mt * 400 +
          3 * mt * mt * t * 110 +
          3 * mt * t * t * 14 +
          t * t * t * 106;
        const y =
          mt * mt * mt * 24 +
          3 * mt * mt * t * 26 +
          3 * mt * t * t * 184 +
          t * t * t * 204;
        return { x, y };
      }
    };

    const buildSubPath = (u0: number, u1: number, steps = 28): string => {
      const a = Math.max(0, Math.min(1, u0));
      const b = Math.max(0, Math.min(1, u1));
      if (b - a <= 0.005) return "";
      const pts: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const u = a + ((b - a) * i) / steps;
        const { x, y } = evalLoopPoint(u);
        pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      return pts.join(" ");
    };

    const loopActive = clicked && clickAge >= 0 && clickAge <= 11;
    const headU = interpolate(clickAge, [0, 10], [0.14, 1], CLAMP);
    const tailU = interpolate(clickAge, [0, 4, 10], [0, 0.18, 0.62], CLAMP);
    const dashTailU1 = Math.max(0, tailU - 0.04);
    const dashTailU0 = Math.max(0, tailU - 0.12);
    const mainArcPath = buildSubPath(tailU, headU, 32);
    const trailDashPath = buildSubPath(dashTailU0, dashTailU1, 10);
    const tipPt = evalLoopPoint(headU);
    const prevPt = evalLoopPoint(Math.max(0, headU - 0.025));
    const headAngleDeg = (Math.atan2(tipPt.y - prevPt.y, tipPt.x - prevPt.x) * 180) / Math.PI;
    const loopOpacity = interpolate(clickAge, [0, 1, 9.5, 11.5], [0, 1, 1, 0], CLAMP);

    // Phase 3: Left-edge ink droplet burst (clickAge 10..21, matching btn4_dense/frame-039.png)
    const dropletsActive = clicked && clickAge >= 10 && clickAge <= 22;
    const dropProg = interpolate(clickAge, [10, 21], [0, 1], CLAMP);
    const dropOpacity = interpolate(clickAge, [10, 12, 18, 22], [0, 1, 1, 0], CLAMP);

    // Phase 4: Bottom-left diagonal impact ticks // (clickAge 17..26)
    const ticksActive = clicked && clickAge >= 17 && clickAge <= 26;
    const ticksOpacity = interpolate(clickAge, [17, 19, 24, 26], [0, 1, 1, 0], CLAMP);

    return (
      <div
        data-generate-state={clicked ? "loading" : "ready"}
        data-generate-feedback={
          clicked && clickAge < 6
            ? "press"
            : burstVisible
              ? "pixel-burst"
              : clicked
                ? "loading"
                : isHoveringGenerate
                  ? "hover"
                  : "ready"
        }
        data-press-scale={press}
        data-shake-x={shakeX}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 640,
          height: 158,
          marginLeft: -320,
          marginTop: -79,
          transform: `translate3d(${shakeX * 0.45}px, 0, 0) scale(${interpolate(enter, [0, 1], [0.68, 1]) * bodyPress * interpolate(exit, [0, 1], [1, 1.1])})`,
          opacity: interpolate(enter, [0, 0.3], [0, 1], CLAMP) * interpolate(exit, [0, 1], [1, 0]),
          zIndex: 45,
        }}
      >
        {/* Ambient studio backlight halo */}
        <div
          style={{
            position: "absolute",
            left: -90,
            right: -90,
            top: -80,
            bottom: -80,
            borderRadius: 999,
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(255, 230, 0, 0.22) 0%, rgba(255, 46, 108, 0.14) 45%, rgba(0,0,0,0) 72%)",
            filter: "blur(16px)",
            pointerEvents: "none",
          }}
        />

        {/* PHASE 2 OVER-THE-TOP LOOPING SWOOSH ARROW (frames 322-333, matching btn4_dense/frame-033 -> frame-036) */}
        {loopActive && mainArcPath && (
          <svg
            width="820"
            height="320"
            viewBox="0 0 820 320"
            fill="none"
            style={{
              position: "absolute",
              left: -95,
              top: -108,
              opacity: loopOpacity,
              pointerEvents: "none",
              zIndex: 60,
              overflow: "visible",
            }}
          >
            {/* Outer black comic ink stroke for the sweeping ribbon */}
            <path
              d={mainArcPath}
              stroke="#0B0B0E"
              strokeWidth="21"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Inner pure white ribbon fill stroke */}
            <path
              d={mainArcPath}
              stroke="#FFFFFF"
              strokeWidth="12.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Trailing detached dash segment (matching frame-036) */}
            {trailDashPath && (
              <>
                <path
                  d={trailDashPath}
                  stroke="#0B0B0E"
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={trailDashPath}
                  stroke="#FFFFFF"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
            {/* Moving hand-drawn arrowhead attached to the exact leading tip */}
            <g transform={`translate(${tipPt.x.toFixed(1)}, ${tipPt.y.toFixed(1)}) rotate(${headAngleDeg.toFixed(1)})`}>
              <path
                d="M -22 -18 L 16 0 L -22 18 L -11 0 Z"
                fill="#FFFFFF"
                stroke="#0B0B0E"
                strokeWidth="4.5"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        )}

        {/* PHASE 3 LEFT-EDGE INK DROPLET BURST (! exclamation teardrop + 5 droplets, matching btn4_dense/frame-039.png) */}
        {dropletsActive && (
          <svg
            width="240"
            height="240"
            viewBox="0 0 240 240"
            fill="none"
            style={{
              position: "absolute",
              left: -148,
              top: -46,
              opacity: dropOpacity,
              transform: `translate3d(${-dropProg * 14}px, ${-dropProg * 6}px, 0) scale(${0.9 + dropProg * 0.16})`,
              pointerEvents: "none",
              zIndex: 58,
              overflow: "visible",
            }}
          >
            {/* Vertical exclamation teardrop (!) */}
            <path
              d="M 108 42 C 116 42, 120 68, 112 96 C 109 106, 102 106, 99 96 C 92 68, 98 42, 108 42 Z"
              fill="#FFFFFF"
              stroke="#0B0B0E"
              strokeWidth="4"
            />
            <circle cx="105" cy="120" r="7.5" fill="#FFFFFF" stroke="#0B0B0E" strokeWidth="4" />
            {/* 5 scattered splash droplets on the left */}
            <circle cx="72" cy="84" r="6.5" fill="#FFFFFF" stroke="#0B0B0E" strokeWidth="3.8" />
            <circle cx="58" cy="112" r="8" fill="#FFFFFF" stroke="#0B0B0E" strokeWidth="4" />
            <circle cx="80" cy="138" r="6" fill="#FFFFFF" stroke="#0B0B0E" strokeWidth="3.8" />
            <circle cx="62" cy="156" r="7" fill="#FFFFFF" stroke="#0B0B0E" strokeWidth="3.8" />
            <circle cx="94" cy="164" r="5.5" fill="#FFFFFF" stroke="#0B0B0E" strokeWidth="3.5" />
          </svg>
        )}

        {/* PHASE 4 BOTTOM-LEFT IMPACT TICKS // (matching btn4_dense/frame-041) */}
        {ticksActive && (
          <svg
            width="120"
            height="90"
            viewBox="0 0 120 90"
            fill="none"
            style={{
              position: "absolute",
              left: -62,
              bottom: -44,
              opacity: ticksOpacity,
              pointerEvents: "none",
              zIndex: 58,
            }}
          >
            <line x1="48" y1="16" x2="22" y2="54" stroke="#0B0B0E" strokeWidth="11" strokeLinecap="round" />
            <line x1="48" y1="16" x2="22" y2="54" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" />
            <line x1="76" y1="24" x2="54" y2="62" stroke="#0B0B0E" strokeWidth="11" strokeLinecap="round" />
            <line x1="76" y1="24" x2="54" y2="62" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" />
          </svg>
        )}

        {/* Bottom-Left 3D Offset Shadow Pill Slab */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            background: "linear-gradient(90deg, #FF6B9D 0%, #FF2E55 100%)",
            border: "5px solid #0B0B0E",
            boxShadow: "0 28px 60px rgba(0,0,0,0.9)",
            transform: `translate3d(${-22 * slabEnter}px, ${20 * slabEnter}px, 0) rotate(${backSlabTilt}deg)`,
            transformOrigin: "center center",
          }}
        />

        {/* Front Pure White Pill Face with Clockwise Scissor-Tilt Rocking on Left-Edge Strike */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            backgroundColor: "#FFFFFF",
            border: "5px solid #0B0B0E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            transform: `translate3d(0, ${frontPillY}px, 0) rotate(${frontPillTilt}deg)`,
            transformOrigin: "center center",
          }}
        >
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize: 54,
              letterSpacing: "-0.03em",
              color: "#0B0B0E",
              whiteSpace: "nowrap",
            }}
          >
            {clicked ? `GENERATING ${pct}%` : "GENERATE 4K"}
          </span>
        </div>

        {/* Top-Right Dual 4-Point Sparkles (Large Lime-Yellow + Small Amber-Gold) */}
        <div
          style={{
            position: "absolute",
            right: -52,
            top: -54,
            width: 130,
            height: 110,
            transform: `scale(${sparklePop * (clicked ? interpolate(clickAge, [0, 4, 12], [1, 1.24, 1.06], CLAMP) : 1)}) rotate(${clicked ? interpolate(clickAge, [0, 8, 18], [0, 16, 6], CLAMP) : 0}deg)`,
            pointerEvents: "none",
          }}
        >
          {/* Small warm gold 4-point star */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            style={{ position: "absolute", left: 0, top: 6, overflow: "visible" }}
          >
            <path
              d="M24 2 C27 16, 32 21, 46 24 C32 27, 27 32, 24 46 C21 32, 16 27, 2 24 C16 21, 21 16, 24 2 Z"
              fill="#FFB800"
              stroke="#0B0B0E"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
          </svg>
          {/* Large neon lime-yellow 4-point star */}
          <svg
            width="84"
            height="84"
            viewBox="0 0 84 84"
            style={{ position: "absolute", left: 34, top: 12, overflow: "visible" }}
          >
            <path
              d="M42 3 C47 28, 56 37, 81 42 C56 47, 47 56, 42 81 C37 56, 28 47, 3 42 C28 37, 37 28, 42 3 Z"
              fill="#B8FF2C"
              stroke="#0B0B0E"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    );
  }

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
    {
      text: "Design Your",
      size: 118,
      height: 126,
      color: "#F7F5EF",
      width: 980,
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: "italic" as const,
      letterSpacing: "-0.02em",
      isSlab: false,
      tag: "NO CAMERA CREW",
    },
    {
      text: "ICONIC AI",
      size: 162,
      height: 184,
      color: "#050507",
      width: 820,
      fontFamily: "'AI Character Anton', Impact, sans-serif",
      fontStyle: "normal" as const,
      letterSpacing: "0.01em",
      isSlab: true,
      tag: undefined,
    },
    {
      text: "INFLUENCER.",
      size: 166,
      height: 176,
      color: "#F7F5EF",
      width: 1060,
      fontFamily: "'AI Character Anton', Impact, sans-serif",
      fontStyle: "normal" as const,
      letterSpacing: "-0.01em",
      isSlab: false,
      tag: undefined,
    },
  ];
  return (
    <div
      data-finale-title="DESIGN YOUR ICONIC AI INFLUENCER"
      data-title-settled={settled}
      aria-label="Design your iconic AI influencer"
      style={{ perspective: 1400, width: 1080, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {rows.map((row, ri) => {
        const start = 2 + ri * 4;
        const reveal = settled
          ? 1
          : Math.min(
              1,
              spring({
                frame: Math.max(0, rel - start),
                fps,
                config: { damping: 18, mass: 0.45, stiffness: 250 },
              })
            );
        return (
          <div
            key={row.text}
            data-finale-row={ri}
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              height: row.height,
              width: row.width,
              opacity: interpolate(reveal, [0, 0.25], [0, 1], CLAMP),
              transformOrigin: "left center",
              transform: settled
                ? "none"
                : `translateY(${(1 - reveal) * 28}px) rotateY(${(1 - reveal) * -10}deg)`,
            }}
          >
            <div
              style={
                row.isSlab
                  ? {
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "6px 34px 10px 30px",
                      backgroundColor: HIGGS_YELLOW,
                      border: "3px solid #F7F5EF",
                      boxShadow: "10px 10px 0 #000000, 13px 13px 0 #FFE600",
                      transform: "skewX(-10deg)",
                      fontFamily: row.fontFamily,
                      fontStyle: row.fontStyle,
                      fontSize: row.size,
                      fontWeight: 400,
                      lineHeight: 0.96,
                      letterSpacing: row.letterSpacing,
                      whiteSpace: "nowrap",
                      color: row.color,
                    }
                  : {
                      fontFamily: row.fontFamily,
                      fontStyle: row.fontStyle,
                      fontSize: row.size,
                      fontWeight: 400,
                      lineHeight: 0.98,
                      letterSpacing: row.letterSpacing,
                      whiteSpace: "nowrap",
                      color: row.color,
                    }
              }
            >
              <span style={row.isSlab ? { display: "inline-block", transform: "skewX(10deg)" } : undefined}>
                {row.text.split("").map((char, i) => {
                  const p = settled
                    ? 1
                    : Math.min(
                        1,
                        spring({
                          frame: Math.max(0, rel - start - i * 0.35),
                          fps,
                          config: { damping: 18, mass: 0.42, stiffness: 260 },
                        })
                      );
                  const isAccentDot = ri === 2 && char === ".";
                  return (
                    <span
                      key={i}
                      data-title-glyph={`${ri}-${i}`}
                      style={{
                        display: "inline-block",
                        transformOrigin: "50% 75%",
                        transform: settled
                          ? "none"
                          : `translateY(${(1 - p) * 24}px) scale(${0.82 + p * 0.18})`,
                        opacity: Math.max(0.25, p),
                        color: isAccentDot ? HIGGS_YELLOW : undefined,
                        textShadow:
                          ri === 2
                            ? "0 6px 0 #14141A"
                            : "none",
                      }}
                    >
                      {char === " " ? "\u00a0" : char}
                    </span>
                  );
                })}
              </span>
            </div>
            {row.tag && (
              <div
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  backgroundColor: "rgba(255,230,0,0.1)",
                  border: `1.5px solid ${HIGGS_YELLOW}`,
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: "0.14em",
                  color: HIGGS_YELLOW,
                  whiteSpace: "nowrap",
                }}
              >
                {row.tag}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export type FinaleVariant = "v0" | "v1" | "v2" | "v3" | "v4";
export type GenerateButtonVariant = "default" | "style4";

const FinaleLeftLockup: React.FC<{ rel: number; fps: number; variant: FinaleVariant }> = ({
  rel,
  fps,
  variant,
}) => {
  const spr1 = spring({ frame: Math.max(0, rel - 1), fps, config: { damping: 14, mass: 0.42, stiffness: 280 } });
  const spr2 = spring({ frame: Math.max(0, rel - 5), fps, config: { damping: 14, mass: 0.42, stiffness: 280 } });
  const spr3 = spring({ frame: Math.max(0, rel - 9), fps, config: { damping: 14, mass: 0.42, stiffness: 280 } });
  const sprFooter = spring({ frame: Math.max(0, rel - 14), fps, config: { damping: 15, mass: 0.45, stiffness: 260 } });

  if (variant === "v1") {
    // OPTION 1: Counter-Tilted Brutalist Tape Ribbons (Talking-Head / Hook Studio Style)
    const ribbons = [
      {
        text: "YOUR OWN",
        bg: "#FFFFFF",
        color: "#07080C",
        tilt: -2.4,
        skew: -5,
        size: 132,
        spr: spr1,
        offsetX: -10,
        shadow: "10px 10px 0 #000000, 0 24px 54px rgba(0,0,0,0.88)",
        border: "3px solid #07080C",
      },
      {
        text: "AI CREATOR",
        bg: HIGGS_YELLOW,
        color: "#07080C",
        tilt: 1.5,
        skew: -5,
        size: 138,
        spr: spr2,
        offsetX: 22,
        shadow: "10px 10px 0 #000000, 0 28px 64px rgba(255,230,0,0.28)",
        border: "3px solid #07080C",
      },
      {
        text: "IN 6 CLICKS",
        bg: "#FF1E6E",
        color: "#FFFFFF",
        tilt: -1.3,
        skew: -5,
        size: 120,
        spr: spr3,
        offsetX: -4,
        shadow: "10px 10px 0 #000000, 0 24px 58px rgba(255,30,110,0.38)",
        border: "3px solid #FFFFFF",
      },
    ];
    return (
      <div style={{ width: 1110, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div
          style={{
            marginBottom: 24,
            marginLeft: 6,
            padding: "9px 22px",
            borderRadius: 999,
            backgroundColor: "#0D0F14",
            border: "1.5px solid rgba(255,230,0,0.55)",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            transform: "rotate(-1.8deg)",
            opacity: spr1,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: HIGGS_YELLOW }} />
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: "0.14em",
              color: HIGGS_YELLOW,
            }}
          >
            AI INFLUENCER STUDIO  •  ZERO PHOTOSHOOTS
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
          {ribbons.map((r, idx) => (
            <div
              key={r.text}
              style={{
                marginLeft: r.offsetX,
                padding: "12px 42px 14px 42px",
                backgroundColor: r.bg,
                border: r.border,
                borderRadius: 10,
                boxShadow: r.shadow,
                transform: `translate3d(0, ${(1 - r.spr) * 28}px, 0) rotate(${r.tilt}deg) skewX(${r.skew}deg) scale(${0.86 + r.spr * 0.14})`,
                opacity: r.spr,
                zIndex: 10 + idx,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  transform: `skewX(${-r.skew}deg)`,
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 900,
                  fontSize: r.size,
                  lineHeight: 0.88,
                  letterSpacing: "-0.045em",
                  color: r.color,
                  whiteSpace: "nowrap",
                }}
              >
                {r.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "v2") {
    // OPTION 2: High-Fashion Casting Sheet / Editorial Magazine Dossier
    return (
      <div style={{ width: 1080, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        {/* Top architectural rule */}
        <div
          style={{
            width: 960,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 16,
            marginBottom: 18,
            borderBottom: "1.5px solid rgba(255,255,255,0.22)",
            opacity: spr1,
          }}
        >
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "0.22em",
              color: HIGGS_YELLOW,
            }}
          >
            STUDIO CASTING SHEET  //  01 — 06
          </span>
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.65)",
            }}
          >
            100% SYNTHETIC  •  4K RAW
          </span>
        </div>

        {/* Luxury Serif Italic Line */}
        <div
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic",
            fontSize: 132,
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            color: HIGGS_YELLOW,
            opacity: spr1,
            transform: `translateY(${(1 - spr1) * 20}px)`,
          }}
        >
          Every Trait,
        </div>

        {/* Giant Condensed Display Lines */}
        <div
          style={{
            fontFamily: "'AI Character Anton', Impact, sans-serif",
            fontSize: 176,
            lineHeight: 0.94,
            letterSpacing: "-0.01em",
            color: "#F7F5EF",
            opacity: spr2,
            transform: `translateY(${(1 - spr2) * 24}px)`,
          }}
        >
          YOUR OWN AI
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            opacity: spr3,
            transform: `translateY(${(1 - spr3) * 24}px)`,
          }}
        >
          <span
            style={{
              fontFamily: "'AI Character Anton', Impact, sans-serif",
              fontSize: 176,
              lineHeight: 0.94,
              letterSpacing: "-0.01em",
              color: "#F7F5EF",
            }}
          >
            INFLUENCER
          </span>
          <div
            style={{
              padding: "14px 22px",
              borderRadius: 16,
              backgroundColor: HIGGS_YELLOW,
              color: "#050507",
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: "0.06em",
              boxShadow: "0 12px 30px rgba(255,230,0,0.35)",
            }}
          >
            4K STUDIO
          </div>
        </div>

        {/* Bottom 3-column architectural spec strip */}
        <div
          style={{
            width: 960,
            marginTop: 28,
            paddingTop: 20,
            borderTop: "1.5px solid rgba(255,255,255,0.22)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
            opacity: sprFooter,
          }}
        >
          {[
            ["01 / IDENTITY", "Face, Skin & Eyes"],
            ["02 / STYLING", "Textured Crop & Fit"],
            ["03 / OUTPUT", "Ready in 6 Clicks"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 12, letterSpacing: "0.18em", color: HIGGS_YELLOW }}>
                {k}
              </span>
              <span style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 20, color: "#F7F5EF" }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "v3") {
    // OPTION 3: Cylindrical Concave 3D Display Banner + Smooth Left-to-Right Optical Blur-to-Focus Wave
    const renderCurvedWord = (
      word: string,
      color: string,
      rimColor: string,
      fontSize: number,
      startRel: number,
      stagger = 1.05,
      duration = 12
    ) => {
      const chars = word.split("");
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            perspective: 1100,
            transformStyle: "preserve-3d",
            gap: 3,
          }}
        >
          {chars.map((ch, idx) => {
            const u = (idx - (chars.length - 1) / 2) / ((chars.length - 1) / 2);
            const u2 = u * u;
            const scaleY = 0.88 + 0.42 * u2;
            const rotateY = -u * 22;
            const skewY = u * 3.6;

            const pRaw = interpolate(
              rel - startRel - idx * stagger,
              [0, duration],
              [0, 1],
              CLAMP
            );
            const p = 1 - Math.pow(1 - pRaw, 3);
            const blurPx = interpolate(p, [0, 1], [12, 0], CLAMP);
            const yPx = interpolate(p, [0, 1], [14, 0], CLAMP);
            const scaleChar = interpolate(p, [0, 1], [0.92, 1], CLAMP);
            const opVal = interpolate(p, [0, 1], [0.14, 1], CLAMP);

            return (
              <span
                key={idx}
                style={{
                  display: "inline-block",
                  fontFamily: "'AI Character Anton', Impact, sans-serif",
                  fontSize,
                  lineHeight: 0.96,
                  color: p > 0.4 ? color : "rgba(255,255,255,0.28)",
                  opacity: opVal,
                  filter: blurPx > 0.15 ? `blur(${blurPx.toFixed(2)}px)` : "none",
                  transform: `translate3d(0, ${yPx.toFixed(2)}px, 0) rotateY(${rotateY}deg) skewY(${skewY}deg) scale(${scaleChar.toFixed(3)}, ${(scaleY * scaleChar).toFixed(3)})`,
                  textShadow:
                    p > 0.55
                      ? `0 4px 0 ${rimColor}, 0 14px 32px rgba(0,0,0,0.92)`
                      : "none",
                }}
              >
                {ch === " " ? "\u00a0" : ch}
              </span>
            );
          })}
        </div>
      );
    };

    const subChars = "Face, hair & studio fit — built from scratch.".split("");
    const starLeadProg = 1 - Math.pow(1 - interpolate(rel - 14, [0, 12], [0, 1], CLAMP), 3);

    return (
      <div style={{ width: 1120, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
        {renderCurvedWord("CREATE YOUR", "#F7F5EF", "#23232E", 168, 1, 0.9, 11)}
        {renderCurvedWord("AI INFLUENCER", HIGGS_YELLOW, "#665800", 174, 7, 0.9, 12)}

        <div
          style={{
            marginTop: 22,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontSize: 34,
              color: HIGGS_YELLOW,
              opacity: interpolate(starLeadProg, [0, 1], [0, 1], CLAMP),
              filter: `blur(${interpolate(starLeadProg, [0, 1], [8, 0], CLAMP)}px)`,
              transform: `rotate(${interpolate(starLeadProg, [0, 1], [-120, 0], CLAMP)}deg) scale(${interpolate(starLeadProg, [0, 1], [0.4, 1], CLAMP)})`,
              textShadow: "0 0 24px rgba(255,230,0,0.5)",
            }}
          >
            ✦
          </span>
          <span
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: "italic",
              fontSize: 56,
              letterSpacing: "-0.01em",
              color: "#F7F5EF",
              display: "inline-flex",
              alignItems: "baseline",
            }}
          >
            {subChars.map((ch, idx) => {
              const pRaw = interpolate(rel - 14 - idx * 0.4, [0, 10], [0, 1], CLAMP);
              const p = 1 - Math.pow(1 - pRaw, 3);
              const blurPx = interpolate(p, [0, 1], [8, 0], CLAMP);
              const yPx = interpolate(p, [0, 1], [8, 0], CLAMP);
              return (
                <span
                  key={idx}
                  style={{
                    display: "inline-block",
                    color: p > 0.45 ? "#F7F5EF" : "rgba(247,245,239,0.28)",
                    opacity: interpolate(p, [0, 1], [0.12, 1], CLAMP),
                    filter: blurPx > 0.15 ? `blur(${blurPx.toFixed(2)}px)` : "none",
                    transform: `translate3d(0, ${yPx.toFixed(2)}px, 0)`,
                  }}
                >
                  {ch === " " ? "\u00a0" : ch}
                </span>
              );
            })}
          </span>
        </div>
      </div>
    );
  }

  if (variant === "v4") {
    // OPTION 4: Outlined Hollow + Solid Neon-Gold Brutalist Poster Lockup
    return (
      <div style={{ width: 1100, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div
          style={{
            fontFamily: "'AI Character Anton', Impact, sans-serif",
            fontSize: 164,
            lineHeight: 0.94,
            letterSpacing: "0.01em",
            color: "transparent",
            WebkitTextStroke: "3.5px rgba(247,245,239,0.88)",
            opacity: spr1,
            transform: `translateY(${(1 - spr1) * 20}px)`,
          }}
        >
          NO CAMERA.
        </div>

        <div
          style={{
            fontFamily: "'AI Character Anton', Impact, sans-serif",
            fontSize: 176,
            lineHeight: 0.94,
            letterSpacing: "0.01em",
            color: HIGGS_YELLOW,
            textShadow: "8px 8px 0 #1A1A22, 0 0 40px rgba(255,230,0,0.22)",
            opacity: spr2,
            transform: `translateY(${(1 - spr2) * 22}px)`,
          }}
        >
          NO MODEL.
        </div>

        <div
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 22,
            padding: "10px 34px 12px 30px",
            backgroundColor: "#F7F5EF",
            borderRadius: 14,
            boxShadow: "10px 10px 0 #FFE600",
            opacity: spr3,
            transform: `translateY(${(1 - spr3) * 24}px)`,
          }}
        >
          <span
            style={{
              fontFamily: "'AI Character Anton', Impact, sans-serif",
              fontSize: 136,
              lineHeight: 0.94,
              color: "#050507",
              whiteSpace: "nowrap",
            }}
          >
            YOUR AI INFLUENCER
          </span>
        </div>

        <div
          style={{
            marginTop: 26,
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic",
            fontSize: 52,
            color: "#F7F5EF",
            opacity: sprFooter,
          }}
        >
          Pick 6 traits. <span style={{ color: HIGGS_YELLOW }}>Generate 4K studio portraits.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 1110, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <FoldedInfluencerTitle rel={rel} fps={fps} />
    </div>
  );
};

const EditorialCharacterFinale: React.FC<{
  frame: number;
  fps: number;
  variant?: FinaleVariant;
  portraitSrc?: string;
}> = ({
  frame,
  fps,
  variant = "v3",
  portraitSrc = ASSET("aichar-final-outcome.png"),
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
        padding: "0 80px 0 88px",
        zIndex: 60,
      }}
    >
      {/* Editorial mixed-typography lockup */}
      <FinaleLeftLockup rel={rel} fps={fps} variant={variant} />
      <div style={{ display: "none" }}>
        <FoldedInfluencerTitle rel={rel} fps={fps} />
        ZERO PHOTOSHOOTS • 100% STUDIO BUILD YOUR AI INFLUENCER
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
          src={staticFile(portraitSrc)}
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

function getCursorState(
  frame: number,
  beats: readonly TraitBeat[] = BEATS
): {
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
  const choiceX = (i: number) => beats[i].selectedSlot * CHOICE_SPACING;
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

const AICharacterPromoAct: React.FC<{
  beats: readonly TraitBeat[];
  flowGroups: readonly SelectionFlowGroup[];
  portraitSrc: string;
  finaleVariant: FinaleVariant;
  generateVariant: GenerateButtonVariant;
  fadeOutAtEnd?: boolean;
  fadeInAtStart?: boolean;
}> = ({
  beats,
  flowGroups,
  portraitSrc,
  finaleVariant,
  generateVariant,
  fadeOutAtEnd = false,
  fadeInAtStart = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cursor = getCursorState(frame, beats);
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

  // Smooth transition between Part 1 Finale and Part 2 Opening
  const actFadeOut = fadeOutAtEnd
    ? interpolate(frame, [PART_FRAMES - 12, PART_FRAMES - 1], [1, 0], CLAMP)
    : 1;
  const actFadeIn = fadeInAtStart
    ? interpolate(frame, [0, 10], [0, 1], CLAMP)
    : 1;
  const actOpacity = actFadeOut * actFadeIn;

  const activeIdx = activeBeatIndex(frame, beats);
  const selectionFlowActive = frame < GENERATE_START;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden", opacity: actOpacity }}>
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
          transform: selectionFlowActive
            ? "none"
            : `perspective(1800px) scale(${cameraScale}) rotateX(${stageRotateX}deg) rotateY(${stageRotateY}deg)`,
          transformOrigin: "50% 50%",
          filter: cameraBlur > 0.2 ? `blur(${cameraBlur}px)` : "none",
        }}
      >
        {selectionFlowActive ? (
          <>
            <AICharacterSelectionFlow groups={flowGroups} exitCursor={getCursorState(GENERATE_START, beats)} />
            {frame >= 290 && (
              <AbsoluteFill
                data-recipe-handoff-opacity={interpolate(frame, [290, GENERATE_START], [0, 1], CLAMP)}
                style={{ opacity: interpolate(frame, [290, GENERATE_START], [0, 1], CLAMP), pointerEvents: "none" }}
              >
                <RecipeStack frame={frame} fps={fps} />
              </AbsoluteFill>
            )}
          </>
        ) : (
          <>
            <KineticHeadlines frame={frame} fps={fps} beats={beats} />
            <StepOdometer frame={frame} fps={fps} />
            <RecipeStack frame={frame} fps={fps} />
            {activeIdx >= 0 &&
              ([-1, 0, 1] as const).map((slot) => (
                <SelectedTraitCard
                  key={`${beats[activeIdx].id}-${slot}`}
                  beat={beats[activeIdx]}
                  index={activeIdx}
                  frame={frame}
                  fps={fps}
                  slot={slot}
                  option={optionAtSlot(beats[activeIdx], slot)}
                />
              ))}
            <GenerateMoment frame={frame} fps={fps} variant={generateVariant} />
            <EditorialCharacterFinale
              frame={frame}
              fps={fps}
              variant={finaleVariant}
              portraitSrc={portraitSrc}
            />
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
    </AbsoluteFill>
  );
};

export const AICharacterPromo: React.FC<{
  finaleVariant?: FinaleVariant;
  generateVariant?: GenerateButtonVariant;
}> = ({ finaleVariant = "v3", generateVariant = "style4" }) => {
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
          @font-face {
            font-family: 'AI Character Anton';
            font-style: normal;
            font-weight: 400;
            src: url('${staticFile("fonts/anton-latin-400-normal.woff2")}') format('woff2');
          }
        `}
      </style>

      {/* PART 1 (0.0s – 15.0s, frames 0–449): Male Influencer Build -> Generate 4K -> CREATE YOUR AI INFLUENCER (Male Portrait) */}
      <Sequence from={0} durationInFrames={PART_FRAMES} name="Part 1 - Male Influencer">
        <AICharacterPromoAct
          beats={BEATS}
          flowGroups={FLOW_GROUPS}
          portraitSrc={ASSET("aichar-part1-male-final.jpg")}
          finaleVariant={finaleVariant}
          generateVariant={generateVariant}
          fadeOutAtEnd
        />
      </Sequence>

      {/* PART 2 (15.0s – 30.0s, frames 450–899): Female Influencer Build -> Generate 4K -> CREATE YOUR AI INFLUENCER (Female Portrait) */}
      <Sequence from={PART_FRAMES} durationInFrames={PART_FRAMES} name="Part 2 - Female Influencer">
        <AICharacterPromoAct
          beats={FEMALE_BEATS}
          flowGroups={FEMALE_FLOW_GROUPS}
          portraitSrc={ASSET("aichar-part2-female-final.jpg")}
          finaleVariant={finaleVariant}
          generateVariant={generateVariant}
          fadeInAtStart
        />
      </Sequence>
    </AbsoluteFill>
  );
};
