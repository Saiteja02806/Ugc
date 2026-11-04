import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/*
 * VIDMAKE (vidmake.io) FLAGSHIP PRODUCT LAUNCH VIDEO
 * Duration: 48.00s (1440 frames @ 30 FPS), 1920x1080
 *
 * Built from the 6 visual craft primitives extracted from the 7 vidmake.io references:
 * 1. <StudioStage>: Warm Stone Ivory (#EFECE6) <-> Deep Obsidian (#08090C) with
 *    animated radial color aura and SVG fractalNoise film grain.
 * 2. <EchoTrail>: Sub-frame shutter-trail ghosts (frame - k*delta) on fast card/phone motion
 *    (inspired by UseFastlane 25s & 63s).
 * 3. <BlurWordTitle>: Word-by-word optical Gaussian blur + spring reveal mixing
 *    tight-tracked Inter 800 with Instrument Serif Italic (inspired by Clivo & rerun.build).
 * 4. <CameraRig>: 3D perspective camera with velocity-driven directional blur and
 *    Dutch-angle macro zoom (inspired by Remotion 14s & Gojiberry).
 * 5. <PhoneReelEjector>: 3D iPhone 16 Pro frame ejecting live <OffthreadVideo> vertical reels
 *    into a 3D fan (inspired by UseFastlane 63s).
 * 6. <Sculpted3DCursor>: Multi-slice extruded 3D pointer with curved trajectory & spring press.
 */

export const VIDMAKE_LAUNCH_FRAMES = 1440; // 48.00s @ 30 FPS

export const BRAND_NAME = "vidmake";
export const BRAND_DOMAIN = "vidmake.io";
export const BRAND_TAGLINE = "The autonomous AI UGC & viral video studio.";

const IVORY = "#EFECE6";
const OBSIDIAN = "#08090C";
const INK = "#111216";
const COBALT = "#2563EB";
const AMBER = "#F97316";
const LIME = "#FFE600";
const EMERALD = "#10B981";

const SANS = "Inter, -apple-system, 'Segoe UI', sans-serif";
const SERIF = "'Instrument Serif', Georgia, serif";
const DISPLAY = "'Anton', Inter, 'Arial Black', sans-serif";
const MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SRC = (p: string) => staticFile(`explore/covers/sources/${p}`);
const AICHAR = (p: string) => staticFile(`explore/covers/sources/aichar/${p}`);

const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/* ------------------------------------------------------------------------ */
/* Primitive 1: <BlurWordTitle> — Optical blur-in word-by-word header        */
/* ------------------------------------------------------------------------ */

export interface TitleToken {
  text: string;
  serif?: boolean;
  color?: string;
  badgeBg?: string;
}

const BlurWordTitle: React.FC<{
  tokens: readonly TitleToken[];
  startFrame: number;
  fontSize?: number;
  darkTheme?: boolean;
  y?: number;
  stagger?: number;
  subline?: string;
}> = ({
  tokens,
  startFrame,
  fontSize = 68,
  darkTheme = false,
  y = 74,
  stagger = 2.6,
  subline,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rel = frame - startFrame;
  if (rel < -2) return null;

  const baseColor = darkTheme ? "#F8FAFC" : INK;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          gap: Math.round(fontSize * 0.22),
          maxWidth: 1620,
          padding: "0 40px",
        }}
      >
        {tokens.map((tok, i) => {
          const wRel = rel - i * stagger;
          const p = spring({
            frame: wRel,
            fps,
            config: { damping: 16, stiffness: 180, mass: 0.65 },
          });
          const blur = interpolate(wRel, [0, 10], [14, 0], CLAMP);
          const op = interpolate(wRel, [0, 6], [0, 1], CLAMP);
          const ty = interpolate(p, [0, 1], [24, 0]);
          const color = tok.color ?? (tok.serif ? (darkTheme ? LIME : COBALT) : baseColor);

          return (
            <span
              key={`${tok.text}-${i}`}
              style={{
                display: "inline-block",
                fontFamily: tok.serif ? SERIF : SANS,
                fontStyle: tok.serif ? "italic" : "normal",
                fontWeight: tok.serif ? 400 : 800,
                fontSize: tok.serif ? Math.round(fontSize * 1.14) : fontSize,
                letterSpacing: tok.serif ? -0.5 : -fontSize * 0.038,
                lineHeight: 1.05,
                color,
                background: tok.badgeBg,
                padding: tok.badgeBg ? "4px 18px 8px" : undefined,
                borderRadius: tok.badgeBg ? 16 : undefined,
                transform: `translateY(${ty}px) scale(${0.92 + 0.08 * p})`,
                opacity: op,
                filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "none",
              }}
            >
              {tok.text}
            </span>
          );
        })}
      </div>

      {subline && (
        <div
          style={{
            marginTop: 14,
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: -0.3,
            color: darkTheme ? "rgba(255,255,255,0.58)" : "rgba(17,18,22,0.56)",
            opacity: interpolate(rel - tokens.length * stagger, [0, 10], [0, 1], CLAMP),
            transform: `translateY(${interpolate(
              rel - tokens.length * stagger,
              [0, 12],
              [12, 0],
              CLAMP
            )}px)`,
          }}
        >
          {subline}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Primitive 2: <EchoTrail> — Multi-sample shutter motion trail              */
/* ------------------------------------------------------------------------ */

const EchoTrail: React.FC<{
  frame: number;
  samples?: number;
  stepFrames?: number;
  trailOpacity?: number;
  renderAt: (sampleFrame: number, isGhost: boolean) => React.ReactNode;
}> = ({ frame, samples = 4, stepFrames = 0.55, trailOpacity = 0.22, renderAt }) => {
  return (
    <>
      {Array.from({ length: samples }, (_, idx) => {
        const k = samples - idx; // render oldest ghost first
        const sf = frame - k * stepFrames;
        const op = trailOpacity * ((samples - k + 1) / (samples + 1));
        return (
          <div
            key={`ghost-${k}`}
            style={{
              position: "absolute",
              inset: 0,
              opacity: op,
              filter: `blur(${(k * 1.6).toFixed(1)}px)`,
              pointerEvents: "none",
            }}
          >
            {renderAt(sf, true)}
          </div>
        );
      })}
      <div style={{ position: "absolute", inset: 0 }}>{renderAt(frame, false)}</div>
    </>
  );
};

/* ------------------------------------------------------------------------ */
/* Primitive 3: <Sculpted3DCursor> — Extruded glossy 3D cursor actor         */
/* ------------------------------------------------------------------------ */

const ARROW_PATH = "M0 0 L0 30 L7 23.6 L11.8 34.6 L17.4 32.2 L12.6 21.4 L21.8 21.4 Z";
const VB = 4;

const Sculpted3DCursor: React.FC<{
  x: number;
  y: number;
  opacity?: number;
  clicking?: boolean;
  scale?: number;
  tiltZ?: number;
}> = ({ x, y, opacity = 1, clicking = false, scale = 1, tiltZ = 0 }) => {
  if (opacity <= 0.01) return null;
  const press = clicking ? 0.84 : 1;
  const unit = 2.85 * press * scale;
  const w = 36 * unit;
  const h = 46 * unit;
  const tip = VB * unit;
  const depth = 8;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate3d(${x}px, ${y}px, 0)`,
        opacity,
        zIndex: 220,
        pointerEvents: "none",
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`-${VB} -${VB} 36 46`}
        style={{
          position: "absolute",
          left: -tip + 14,
          top: -tip + 22,
          filter: "blur(9px)",
          opacity: 0.45,
        }}
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
          transform: `perspective(600px) rotateX(18deg) rotateY(-20deg) rotateZ(${-6 + tiltZ}deg)`,
          transformOrigin: `${tip}px ${tip}px`,
        }}
      >
        <svg
          width={w}
          height={h}
          viewBox={`-${VB} -${VB} 36 46`}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          <defs>
            <linearGradient id="vmCursorFace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6E707A" />
              <stop offset="40%" stopColor="#2A2B32" />
              <stop offset="75%" stopColor="#121317" />
              <stop offset="100%" stopColor="#3B3D46" />
            </linearGradient>
            <linearGradient id="vmCursorRim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.28)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {Array.from({ length: depth }, (_, k) => depth - k).map((d) => {
            const shade = Math.round(interpolate(d / depth, [0, 1], [48, 12]));
            const c = `rgb(${shade},${shade},${shade + 4})`;
            return (
              <path
                key={d}
                d={ARROW_PATH}
                fill={c}
                stroke={c}
                strokeWidth={1.3}
                strokeLinejoin="round"
                transform={`translate(${d * 0.36} ${d * 0.52})`}
              />
            );
          })}
          <path
            d={ARROW_PATH}
            fill="url(#vmCursorFace)"
            stroke="#09090B"
            strokeWidth={0.7}
            strokeLinejoin="round"
          />
          <path
            d={ARROW_PATH}
            fill="none"
            stroke="url(#vmCursorRim)"
            strokeWidth={0.95}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Brand Mark Component                                                      */
/* ------------------------------------------------------------------------ */

const VidmakeLogoMark: React.FC<{ size?: number; dark?: boolean }> = ({
  size = 56,
  dark = false,
}) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.28) }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 55%, #F97316 100%)",
        boxShadow: "0 12px 30px rgba(37,99,235,0.38), inset 0 1px 2px rgba(255,255,255,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
        <path
          d="M4 5.5L10.2 19h3.2L19.8 5.5h-3.4l-4.6 10.2L7.4 5.5H4z"
          fill="#FFFFFF"
        />
        <circle cx="19" cy="18" r="2.4" fill={LIME} />
      </svg>
    </div>
    <span
      style={{
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: Math.round(size * 0.86),
        letterSpacing: -size * 0.04,
        color: dark ? "#FFFFFF" : INK,
      }}
    >
      {BRAND_NAME}
      <span style={{ color: COBALT }}>.io</span>
    </span>
  </div>
);

/* ======================================================================== */
/* ACT I (0–180 | 0:00–0:06): THE BROKEN OLD WAY → VIDMAKE REVEAL           */
/* ======================================================================== */

interface PainPill {
  tag: string;
  title: string;
  meta: string;
  accent: string;
  x: number;
  y: number;
  rot: number;
  delay: number;
}

const PAIN_PILLS: readonly PainPill[] = [
  {
    tag: "INVOICE #409",
    title: "$450 / 1 UGC Video",
    meta: "Plus $120 product shipping · No raw files",
    accent: "#EF4444",
    x: -510,
    y: -150,
    rot: -5,
    delay: 4,
  },
  {
    tag: "WHATSAPP · UNREAD",
    title: "“Hey, still waiting on the creator...”",
    meta: "14 days since sample delivered",
    accent: "#10B981",
    x: 490,
    y: -140,
    rot: 4.5,
    delay: 9,
  },
  {
    tag: "META ADS MANAGER",
    title: "Ad Fatigue · CPA jumped to $84",
    meta: "Creative frequency 4.8x · Needs fresh hooks",
    accent: "#F97316",
    x: -470,
    y: 175,
    rot: 3.5,
    delay: 14,
  },
  {
    tag: "REVISION THREAD #4",
    title: "“Wrong hook, wrong brand tone”",
    meta: "Re-shoot fee requested: +$200",
    accent: "#8B5CF6",
    x: 470,
    y: 180,
    rot: -4,
    delay: 19,
  },
  {
    tag: "CONTENT CALENDAR",
    title: "0 Reels Scheduled This Week",
    meta: "Competitors posted 18 videos in 7 days",
    accent: "#EC4899",
    x: 0,
    y: 255,
    rot: 1.5,
    delay: 24,
  },
];

const Act1BrokenToBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // At frame 96..118, the cursor sweeps across and shatters the old-way pills
  const shatterP = interpolate(frame, [94, 118], [0, 1], { ...CLAMP, easing: easeInOut });
  const brandIn = spring({
    frame: frame - 116,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });
  const exitP = interpolate(frame, [166, 180], [0, 1], { ...CLAMP, easing: easeInOut });

  const cursorX = interpolate(frame, [82, 96, 118, 150], [760, -640, 620, 260], CLAMP);
  const cursorY = interpolate(frame, [82, 96, 118, 150], [420, -160, 140, 85], CLAMP);
  const cursorOp = interpolate(frame, [82, 92, 154, 168], [0, 1, 1, 0], CLAMP);

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${1 + exitP * 0.14})`,
        opacity: 1 - exitP,
      }}
    >
      {/* Phase 1A: Pain Hook (0..118) */}
      {frame < 126 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - shatterP }}>
          <BlurWordTitle
            startFrame={4}
            y={82}
            fontSize={72}
            tokens={[
              { text: "Hiring" },
              { text: "UGC" },
              { text: "creators" },
              { text: "is" },
              { text: "broken.", serif: true, color: "#DC2626" },
            ]}
            subline="Weeks of shipping samples, ghosted DMs, and $450 invoices for a single reel."
          />

          {PAIN_PILLS.map((pill, i) => {
            const enter = spring({
              frame: frame - pill.delay,
              fps,
              config: { damping: 13, stiffness: 190, mass: 0.6 },
            });
            const floatY = Math.sin((frame + i * 17) * 0.08) * 6;
            const explodeX = pill.x * (1 + shatterP * 1.45);
            const explodeY = pill.y + floatY + shatterP * (i % 2 === 0 ? -240 : 280);
            const explodeRot = pill.rot + shatterP * (i % 2 === 0 ? -28 : 32);

            return (
              <div
                key={pill.tag}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "54%",
                  width: 440,
                  padding: "20px 24px",
                  borderRadius: 24,
                  background: "#FFFFFF",
                  boxShadow:
                    "0 24px 50px rgba(17,18,22,0.10), 0 0 0 1px rgba(17,18,22,0.07)",
                  transform: `translate(-50%, -50%) translate3d(${explodeX}px, ${explodeY}px, 0) rotate(${explodeRot}deg) scale(${enter * (1 - shatterP * 0.3)})`,
                  opacity: Math.min(1, enter * 1.3) * (1 - shatterP),
                  filter: shatterP > 0.05 ? `blur(${(shatterP * 12).toFixed(1)}px)` : "none",
                  fontFamily: SANS,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: pill.accent,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: 1.1,
                      color: pill.accent,
                    }}
                  >
                    {pill.tag}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 23,
                    fontWeight: 800,
                    letterSpacing: -0.5,
                    color: INK,
                    marginBottom: 4,
                  }}
                >
                  {pill.title}
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "rgba(17,18,22,0.55)" }}>
                  {pill.meta}
                </div>
              </div>
            );
          })}

          {/* Center "Waiting on creators..." spinner pill before shatter */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "52%",
              transform: `translate(-50%, -50%) scale(${interpolate(
                frame,
                [18, 28],
                [0.7, 1],
                CLAMP
              )})`,
              opacity: interpolate(frame, [18, 26, 94, 108], [0, 1, 1, 0], CLAMP),
              padding: "18px 32px",
              borderRadius: 999,
              background: INK,
              color: "#FFF",
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 24,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: "0 26px 60px rgba(0,0,0,0.24)",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                border: "3px solid rgba(255,255,255,0.25)",
                borderTopColor: LIME,
                transform: `rotate(${frame * 14}deg)`,
              }}
            />
            <span>Chasing creators & agencies...</span>
          </div>
        </div>
      )}

      {/* Phase 1B: Vidmake Studio Reveal (112..180) */}
      {frame >= 112 && (
        <EchoTrail
          frame={frame}
          samples={4}
          stepFrames={0.6}
          trailOpacity={frame < 134 ? 0.25 : 0}
          renderAt={(sf) => {
            const p = spring({
              frame: sf - 114,
              fps,
              config: { damping: 14, stiffness: 170, mass: 0.65 },
            });
            return (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) scale(${0.76 + 0.24 * p})`,
                  opacity: interpolate(sf, [112, 122], [0, 1], CLAMP),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 24,
                }}
              >
                <div
                  style={{
                    padding: "28px 48px",
                    borderRadius: 36,
                    background: "#FFFFFF",
                    boxShadow:
                      "0 36px 90px rgba(37,99,235,0.18), 0 0 0 1px rgba(17,18,22,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                  }}
                >
                  <VidmakeLogoMark size={74} />
                  <span
                    style={{
                      padding: "8px 18px",
                      borderRadius: 999,
                      background: "rgba(37,99,235,0.1)",
                      color: COBALT,
                      fontFamily: SANS,
                      fontWeight: 800,
                      fontSize: 20,
                    }}
                  >
                    AI UGC STUDIO 2.0
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 54,
                    letterSpacing: -1.8,
                    color: INK,
                    textAlign: "center",
                    opacity: brandIn,
                  }}
                >
                  Turn one URL into{" "}
                  <span
                    style={{
                      fontFamily: SERIF,
                      fontStyle: "italic",
                      fontWeight: 400,
                      fontSize: 64,
                      color: COBALT,
                    }}
                  >
                    daily viral UGC.
                  </span>
                </div>
              </div>
            );
          }}
        />
      )}

      <Sculpted3DCursor x={cursorX} y={cursorY} opacity={cursorOp} clicking={frame >= 96 && frame <= 116} />
    </AbsoluteFill>
  );
};

/* ======================================================================== */
/* ACT II (180–390 | 0:06–0:13): BRAND URL → AVATARS & VIRAL MEMORY         */
/* ======================================================================== */

const Act2BrandIntelligence: React.FC = () => {
  const frame = useCurrentFrame(); // 0..210 local
  const { fps } = useVideoConfig();

  const urlText = "vidmake.io/brand/lumina-serum";
  const typedCount = Math.floor(interpolate(frame, [10, 48], [0, urlText.length], CLAMP));
  const clickedAnalyze = frame >= 58;
  const cardsSpawn = frame >= 68;

  // Macro 3D camera: zoomed in while typing URL, pulls back smoothly when 3 cards fan out
  const camScale = interpolate(
    frame,
    [0, 18, 56, 86, 195, 210],
    [1.18, 1.38, 1.38, 1.0, 1.0, 1.12],
    { ...CLAMP, easing: easeInOut }
  );
  const camRotX = interpolate(frame, [0, 56, 88], [10, 8, 2], CLAMP);
  const camRotY = interpolate(frame, [0, 56, 88], [-9, -6, 0], CLAMP);
  const camY = interpolate(frame, [0, 56, 88], [80, 70, 0], { ...CLAMP, easing: easeInOut });
  const exitOp = interpolate(frame, [196, 210], [1, 0], CLAMP);

  const cursorX = interpolate(frame, [14, 52, 58, 92], [460, 235, 225, 580], {
    ...CLAMP,
    easing: easeOut,
  });
  const cursorY = interpolate(frame, [14, 52, 58, 92], [280, -148, -152, 340], {
    ...CLAMP,
    easing: easeOut,
  });

  const learnPct = Math.round(interpolate(frame, [58, 86], [12, 100], CLAMP));

  return (
    <AbsoluteFill style={{ opacity: exitOp }}>
      <BlurWordTitle
        startFrame={4}
        y={58}
        fontSize={64}
        tokens={[
          { text: "Drop" },
          { text: "your" },
          { text: "URL." },
          { text: "Brand & hooks learned.", serif: true, color: COBALT },
        ]}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1800,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateY(${camY}px) scale(${camScale}) rotateX(${camRotX}deg) rotateY(${camRotY}deg)`,
            transformOrigin: "50% 42%",
          }}
        >
          {/* Floating URL Command Pill */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 235,
              width: 860,
              height: 84,
              transform: `translate(-50%, -50%) scale(${
                clickedAnalyze && frame < 66 ? 0.97 : 1
              })`,
              borderRadius: 999,
              background: "#FFFFFF",
              boxShadow: clickedAnalyze
                ? "0 24px 60px rgba(37,99,235,0.22), 0 0 0 3px #2563EB"
                : "0 24px 50px rgba(17,18,22,0.10), 0 0 0 1px rgba(17,18,22,0.08)",
              display: "flex",
              alignItems: "center",
              padding: "0 14px 0 28px",
              gap: 16,
              fontFamily: SANS,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: "rgba(37,99,235,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COBALT,
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              🌐
            </div>
            <div
              style={{
                flex: 1,
                fontFamily: MONO,
                fontWeight: 600,
                fontSize: 25,
                color: INK,
                letterSpacing: -0.4,
              }}
            >
              {urlText.slice(0, typedCount)}
              {frame < 58 && frame % 12 < 6 && (
                <span style={{ color: COBALT, fontWeight: 900 }}>|</span>
              )}
            </div>
            <div
              style={{
                height: 58,
                padding: "0 28px",
                borderRadius: 999,
                background: clickedAnalyze
                  ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 10px 24px rgba(37,99,235,0.3)",
              }}
            >
              <span>{clickedAnalyze ? `Learned ${learnPct}%` : "Analyze Brand"}</span>
              <span>✦</span>
            </div>
          </div>

          {/* Fastlane-style Dot-Matrix Progress Strip */}
          {clickedAnalyze && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 302,
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontFamily: MONO,
                fontSize: 16,
                fontWeight: 700,
                color: "rgba(17,18,22,0.65)",
              }}
            >
              <span style={{ color: AMBER }}>::</span>
              <span>
                Extracting product claims, tone of voice & winning vertical hooks
              </span>
              <span style={{ color: COBALT }}>{learnPct}%</span>
            </div>
          )}

          {/* 3 Holographic Brand & Avatar Cards Fanning Out with EchoTrail */}
          {cardsSpawn && (
            <EchoTrail
              frame={frame}
              samples={4}
              stepFrames={0.55}
              trailOpacity={frame < 102 ? 0.22 : 0}
              renderAt={(sf, isGhost) => {
                const cRel = sf - 68;
                const p0 = spring({
                  frame: cRel,
                  fps,
                  config: { damping: 14, stiffness: 160, mass: 0.65 },
                });
                const p1 = spring({
                  frame: cRel - 5,
                  fps,
                  config: { damping: 14, stiffness: 160, mass: 0.65 },
                });
                const p2 = spring({
                  frame: cRel - 10,
                  fps,
                  config: { damping: 14, stiffness: 160, mass: 0.65 },
                });

                return (
                  <div style={{ position: "absolute", inset: 0 }}>
                    {/* Card 1 (Left): Brand DNA & Tone of Voice */}
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 645,
                        width: 450,
                        height: 500,
                        transform: `translate(-50%, -50%) translate3d(${
                          -515 * p0
                        }px, ${(1 - p0) * -180}px, 0) rotate(${-6 * p0}deg) scale(${
                          0.6 + 0.4 * p0
                        })`,
                        opacity: Math.min(1, p0 * 1.4),
                        borderRadius: 32,
                        background: "#FFFFFF",
                        boxShadow:
                          "0 30px 70px rgba(17,18,22,0.12), 0 0 0 1px rgba(17,18,22,0.07)",
                        padding: 28,
                        fontFamily: SANS,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 18,
                          }}
                        >
                          <span
                            style={{
                              padding: "6px 14px",
                              borderRadius: 999,
                              background: "rgba(249,115,22,0.12)",
                              color: AMBER,
                              fontWeight: 800,
                              fontSize: 14,
                            }}
                          >
                            ✦ BRAND DNA LEARNED
                          </span>
                          <span
                            style={{
                              fontFamily: MONO,
                              fontSize: 13,
                              fontWeight: 700,
                              color: EMERALD,
                            }}
                          >
                            READY
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 30,
                            fontWeight: 800,
                            color: INK,
                            letterSpacing: -0.8,
                            marginBottom: 14,
                          }}
                        >
                          Tone & Hook Angles
                        </div>
                        {[
                          "Clinical proof · Zero hype",
                          "Problem-first 3s visual hook",
                          "Founder & Skincare Routine POV",
                        ].map((item) => (
                          <div
                            key={item}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "11px 14px",
                              borderRadius: 14,
                              background: "#F6F5F0",
                              marginBottom: 10,
                              fontSize: 18,
                              fontWeight: 700,
                              color: INK,
                            }}
                          >
                            <span style={{ color: COBALT }}>●</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          padding: "14px 18px",
                          borderRadius: 18,
                          background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                          color: COBALT,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        124 customer pain points indexed →
                      </div>
                    </div>

                    {/* Card 2 (Center Hero): Winning Viral Reference Matched */}
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 635,
                        width: 470,
                        height: 530,
                        transform: `translate(-50%, -50%) translate3d(0px, ${
                          (1 - p1) * -160
                        }px, 0) scale(${0.65 + 0.35 * p1})`,
                        opacity: Math.min(1, p1 * 1.4),
                        borderRadius: 34,
                        background: INK,
                        color: "#FFFFFF",
                        boxShadow:
                          "0 36px 80px rgba(37,99,235,0.24), 0 0 0 2px rgba(37,99,235,0.5)",
                        padding: 22,
                        fontFamily: SANS,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            background: LIME,
                            color: INK,
                            fontWeight: 900,
                            fontSize: 14,
                          }}
                        >
                          🔥 WINNING HOOK MATCHED
                        </span>
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 15,
                            fontWeight: 700,
                            color: LIME,
                          }}
                        >
                          1.8M VIEWS
                        </span>
                      </div>

                      <div
                        style={{
                          position: "relative",
                          height: 365,
                          borderRadius: 22,
                          overflow: "hidden",
                          background: "#181920",
                        }}
                      >
                        {!isGhost ? (
                          <OffthreadVideo
                            src={SRC("hook-explore-video.mp4")}
                            muted
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <Img
                            src={SRC("hook-influencer-face.png")}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        )}
                        <div
                          style={{
                            position: "absolute",
                            left: 14,
                            bottom: 14,
                            right: 14,
                            padding: "10px 14px",
                            borderRadius: 14,
                            background: "rgba(8,9,12,0.82)",
                            backdropFilter: "blur(8px)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 15,
                            fontWeight: 700,
                          }}
                        >
                          <span>Pacing & camera motion locked</span>
                          <span style={{ color: "#4ADE80" }}>✓ Saved</span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 16,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.75)",
                        }}
                      >
                        <span>Hook retention: 68%</span>
                        <span style={{ color: LIME }}>Ready to clone →</span>
                      </div>
                    </div>

                    {/* Card 3 (Right): Your Key AI Avatars */}
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 645,
                        width: 450,
                        height: 500,
                        transform: `translate(-50%, -50%) translate3d(${
                          515 * p2
                        }px, ${(1 - p2) * -180}px, 0) rotate(${6 * p2}deg) scale(${
                          0.6 + 0.4 * p2
                        })`,
                        opacity: Math.min(1, p2 * 1.4),
                        borderRadius: 32,
                        background: "#FFFFFF",
                        boxShadow:
                          "0 30px 70px rgba(17,18,22,0.12), 0 0 0 1px rgba(17,18,22,0.07)",
                        padding: 28,
                        fontFamily: SANS,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                          }}
                        >
                          <span
                            style={{
                              padding: "6px 14px",
                              borderRadius: 999,
                              background: "rgba(16,185,129,0.14)",
                              color: "#059669",
                              fontWeight: 800,
                              fontSize: 14,
                            }}
                          >
                            ✦ KEY AI AVATARS
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "rgba(17,18,22,0.45)" }}>
                            3 CAST
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 30,
                            fontWeight: 800,
                            color: INK,
                            letterSpacing: -0.8,
                            marginBottom: 16,
                          }}
                        >
                          Matched Creator Roster
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                          {[
                            { name: "Zayd · 25", src: AICHAR("aichar-final-outcome.png") },
                            { name: "Maya · 24", src: AICHAR("eth-latina.png") },
                            { name: "Chloe · 27", src: AICHAR("eth-east-asian.png") },
                          ].map((av) => (
                            <div
                              key={av.name}
                              style={{
                                borderRadius: 18,
                                overflow: "hidden",
                                background: "#141519",
                                height: 230,
                                position: "relative",
                              }}
                            >
                              <Img
                                src={av.src}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  left: 8,
                                  right: 8,
                                  bottom: 8,
                                  padding: "4px 8px",
                                  borderRadius: 8,
                                  background: "rgba(0,0,0,0.72)",
                                  color: "#FFF",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  textAlign: "center",
                                }}
                              >
                                {av.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "14px 18px",
                          borderRadius: 18,
                          background: "#F4F3EE",
                          color: INK,
                          fontWeight: 700,
                          fontSize: 16,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Custom AI Character Studio</span>
                        <span style={{ color: COBALT }}>Open →</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>

      <Sculpted3DCursor
        x={cursorX}
        y={cursorY}
        opacity={interpolate(frame, [10, 18, 95, 110], [0, 1, 1, 0], CLAMP)}
        clicking={frame >= 56 && frame <= 64}
      />
    </AbsoluteFill>
  );
};

/* ======================================================================== */
/* ACT III (390–660 | 0:13–0:22): AI CHARACTER STUDIO → 4K PORTRAIT FAN     */
/* ======================================================================== */

interface StudioRow {
  title: string;
  count: number;
  accent: string;
  picked: string;
  selectedIdx: 0 | 1 | 2;
  clickLocal: number;
  items: readonly { label: string; src: string }[];
}

const STUDIO_ROWS: readonly StudioRow[] = [
  {
    title: "Character type",
    count: 3,
    accent: "#FF6B3D",
    picked: "Extreme",
    selectedIdx: 1,
    clickLocal: 26,
    items: [
      { label: "Average", src: AICHAR("char-average.png") },
      { label: "Extreme", src: AICHAR("char-extreme.png") },
      { label: "Bold", src: AICHAR("char-bold.png") },
    ],
  },
  {
    title: "Scene & lighting",
    count: 20,
    accent: "#38BDF8",
    picked: "Studio Wall",
    selectedIdx: 2,
    clickLocal: 66,
    items: [
      { label: "Workspace", src: AICHAR("bg-workspace.png") },
      { label: "Cream Room", src: AICHAR("bg-cream-room.png") },
      { label: "Studio Wall", src: AICHAR("bg-normal-wall.png") },
    ],
  },
  {
    title: "Heritage & hair",
    count: 23,
    accent: "#A855F7",
    picked: "Middle Eastern · Curls",
    selectedIdx: 1,
    clickLocal: 106,
    items: [
      { label: "East Asian", src: AICHAR("eth-east-asian.png") },
      { label: "Middle Eastern", src: AICHAR("eth-middle-eastern.png") },
      { label: "Voluminous Curls", src: AICHAR("hair-voluminous-curls.png") },
    ],
  },
];

const Act3CharacterStudio: React.FC = () => {
  const frame = useCurrentFrame(); // 0..270 local
  const { fps } = useVideoConfig();

  const generateClick = 148;
  const revealStart = 166;
  const rowH = 340;
  const rowGap = 20;

  // Continuous camera scroll across the 3 rows, then Generate button
  const scrollY =
    frame < 36
      ? 0
      : frame < 56
        ? interpolate(frame, [36, 56], [0, rowH + rowGap], { ...CLAMP, easing: easeInOut })
        : frame < 78
          ? rowH + rowGap
          : frame < 98
            ? interpolate(frame, [78, 98], [rowH + rowGap, (rowH + rowGap) * 2], {
                ...CLAMP,
                easing: easeInOut,
              })
            : (rowH + rowGap) * 2;

  const prevScrollY =
    frame < 37
      ? 0
      : frame < 57
        ? interpolate(frame - 1, [36, 56], [0, rowH + rowGap], { ...CLAMP, easing: easeInOut })
        : frame < 79
          ? rowH + rowGap
          : frame < 99
            ? interpolate(frame - 1, [78, 98], [rowH + rowGap, (rowH + rowGap) * 2], {
                ...CLAMP,
                easing: easeInOut,
              })
            : (rowH + rowGap) * 2;

  const scrollVel = Math.abs(scrollY - prevScrollY);
  const vBlur = Math.min(8, scrollVel * 0.18);

  const cursorX = interpolate(
    frame,
    [8, 26, 48, 66, 88, 106, 134, generateClick, 165],
    [480, 30, 260, 295, 180, 35, 120, 80, 420],
    { ...CLAMP, easing: easeInOut }
  );
  const cursorY = interpolate(
    frame,
    [8, 26, 48, 66, 88, 106, 134, generateClick, 165],
    [320, 20, 90, 25, 110, 25, 345, 335, 420],
    { ...CLAMP, easing: easeInOut }
  );

  const isClicking =
    (frame >= 24 && frame <= 32) ||
    (frame >= 64 && frame <= 72) ||
    (frame >= 104 && frame <= 112) ||
    (frame >= generateClick && frame <= generateClick + 10);

  return (
    <AbsoluteFill>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="vmStudioScrollBlur" x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation={`0 ${vBlur.toFixed(2)}`} />
        </filter>
      </svg>

      {frame < revealStart ? (
        <>
          <BlurWordTitle
            startFrame={2}
            y={46}
            fontSize={62}
            darkTheme
            tokens={[
              { text: "Design" },
              { text: "custom" },
              { text: "AI" },
              { text: "creators.", serif: true, color: LIME },
            ]}
            subline="Every facial trait, room lighting, and outfit under your control."
          />

          {/* Left accumulated recipe stack */}
          <div
            style={{
              position: "absolute",
              left: 78,
              top: 390,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontFamily: SANS,
              zIndex: 50,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              PICKED TRAITS
            </div>
            {[
              { label: "Extreme", at: 30 },
              { label: "Studio Wall · Male 25", at: 70 },
              { label: "Middle Eastern · Curls", at: 110 },
              { label: "Crew Tee · 4K Studio", at: 122 },
            ].map((chip) => {
              if (frame < chip.at) return null;
              const p = spring({
                frame: frame - chip.at,
                fps,
                config: { damping: 12, stiffness: 220, mass: 0.5 },
              });
              return (
                <div
                  key={chip.label}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 999,
                    background: LIME,
                    color: INK,
                    fontWeight: 800,
                    fontSize: 21,
                    transform: `translateX(${(1 - p) * -28}px) scale(${0.75 + 0.25 * p})`,
                    boxShadow: "0 10px 28px rgba(255,230,0,0.22)",
                  }}
                >
                  ✓ {chip.label}
                </div>
              );
            })}
          </div>

          {/* Center Continuous Selector Panel Viewport */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 195,
              width: 860,
              height: 590,
              transform: "translateX(-50%)",
              overflow: "hidden",
              borderRadius: 34,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 90 - scrollY,
                width: 860,
                filter: vBlur > 0.4 ? "url(#vmStudioScrollBlur)" : "none",
              }}
            >
              {STUDIO_ROWS.map((row, ri) => {
                const picked = frame >= row.clickLocal;
                return (
                  <div
                    key={row.title}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: ri * (rowH + rowGap),
                      width: 860,
                      height: rowH,
                      borderRadius: 28,
                      background: "linear-gradient(180deg, #16181E 0%, #101217 100%)",
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 24px 50px rgba(0,0,0,0.5)",
                      padding: 20,
                      fontFamily: SANS,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 14,
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 4,
                          background: row.accent,
                        }}
                      />
                      <span style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9" }}>
                        {row.title}
                      </span>
                      <span style={{ fontSize: 20, color: "rgba(255,255,255,0.35)" }}>
                        · {row.count}
                      </span>
                      <div style={{ flex: 1 }} />
                      {picked && (
                        <span style={{ fontSize: 19, fontWeight: 800, color: LIME }}>
                          {row.picked} ✓
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 14,
                        height: 252,
                      }}
                    >
                      {row.items.map((it, idx) => {
                        const isSel = picked && idx === row.selectedIdx;
                        const dim = picked && idx !== row.selectedIdx ? 0.48 : 1;
                        return (
                          <div
                            key={it.label}
                            style={{
                              position: "relative",
                              borderRadius: 18,
                              overflow: "hidden",
                              background: "#1E2028",
                              opacity: dim,
                              boxShadow: isSel
                                ? `0 0 0 3px ${LIME}, 0 0 32px rgba(255,230,0,0.38)`
                                : "0 0 0 1px rgba(255,255,255,0.08)",
                              transform: isSel ? "scale(1.02)" : "scale(1)",
                            }}
                          >
                            <Img
                              src={it.src}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                objectPosition: "50% 28%",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background:
                                  "linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.82) 100%)",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                left: 14,
                                bottom: 12,
                                fontSize: 21,
                                fontWeight: 800,
                                color: isSel ? LIME : "#FFFFFF",
                              }}
                            >
                              {it.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Generate AI Influencer Bar */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 68,
              transform: `translateX(-50%) scale(${
                frame >= generateClick ? 0.95 : frame >= generateClick - 10 ? 1.04 : 1
              })`,
              padding: "20px 46px",
              borderRadius: 999,
              background:
                frame >= generateClick
                  ? LIME
                  : "linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)",
              color: frame >= generateClick ? INK : "#FFFFFF",
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 28,
              letterSpacing: -0.5,
              boxShadow:
                frame >= generateClick - 10
                  ? "0 0 50px rgba(255,230,0,0.55)"
                  : "0 20px 50px rgba(37,99,235,0.45)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              zIndex: 70,
            }}
          >
            <span>✦ Generate 4K AI Creator</span>
            <span
              style={{
                padding: "4px 14px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.22)",
                fontSize: 18,
              }}
            >
              {frame >= generateClick ? "SYNTHESIZING 100%" : "10 TRAITS LOCKED"}
            </span>
          </div>

          <Sculpted3DCursor x={cursorX} y={cursorY} clicking={isClicking} />
        </>
      ) : (
        /* Phase 3B (166..270): 4K Studio Portrait + 3-Card Creator Fan-Out */
        <EchoTrail
          frame={frame}
          samples={4}
          stepFrames={0.55}
          trailOpacity={frame < revealStart + 24 ? 0.24 : 0}
          renderAt={(sf) => {
            const rRel = sf - revealStart;
            const pop = spring({
              frame: rRel,
              fps,
              config: { damping: 14, stiffness: 170, mass: 0.65 },
            });
            return (
              <AbsoluteFill>
                {/* Left Editorial Stack (preserving our BUILD YOUR / AI INFLUENCER DNA) */}
                <div
                  style={{
                    position: "absolute",
                    left: 110,
                    top: "50%",
                    transform: `translateY(-50%) translateX(${(1 - pop) * -60}px)`,
                    opacity: Math.min(1, pop * 1.4),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 20px",
                      borderRadius: 10,
                      background: LIME,
                      color: INK,
                      fontFamily: SANS,
                      fontWeight: 900,
                      fontSize: 22,
                      letterSpacing: 1.4,
                      transform: "rotate(-1.5deg)",
                      marginBottom: 18,
                    }}
                  >
                    ZERO PHOTOSHOOTS • 100% STUDIO
                  </div>
                  <div
                    style={{
                      fontFamily: "'Arial Black', Inter, sans-serif",
                      fontWeight: 900,
                      fontSize: 94,
                      lineHeight: 0.96,
                      letterSpacing: -3,
                      color: "transparent",
                      WebkitTextStroke: "2.5px #FFFFFF",
                    }}
                  >
                    BUILD YOUR
                  </div>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontWeight: 400,
                      fontSize: 116,
                      lineHeight: 0.98,
                      letterSpacing: 1,
                      color: "#FFFFFF",
                      textShadow: "0 10px 0 #1E293B, 0 24px 50px rgba(0,0,0,0.7)",
                      marginBottom: 18,
                    }}
                  >
                    AI INFLUENCER
                  </div>
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontStyle: "italic",
                      fontSize: 48,
                      color: "#F5D08A",
                    }}
                  >
                    Consistent identity across every reel & carousel.
                  </div>
                </div>

                {/* Right 3-Card 4K Creator Fan */}
                {[
                  {
                    src: AICHAR("eth-latina.png"),
                    name: "Sofia · Skincare",
                    dx: -175,
                    dy: 28,
                    rot: -9,
                    scale: 0.84,
                    z: 1,
                  },
                  {
                    src: AICHAR("eth-east-asian.png"),
                    name: "Min · Tech Founder",
                    dx: 185,
                    dy: 32,
                    rot: 9,
                    scale: 0.84,
                    z: 2,
                  },
                  {
                    src: AICHAR("aichar-final-outcome.png"),
                    name: "Zayd · 4K Studio Master",
                    dx: 0,
                    dy: -10,
                    rot: 0,
                    scale: 1,
                    z: 5,
                  },
                ].map((card) => (
                  <div
                    key={card.name}
                    style={{
                      position: "absolute",
                      right: 210,
                      top: "51%",
                      width: 430,
                      height: 590,
                      zIndex: card.z,
                      borderRadius: 32,
                      overflow: "hidden",
                      background: "#14161D",
                      boxShadow:
                        card.z === 5
                          ? `0 36px 90px rgba(0,0,0,0.75), 0 0 0 3px ${LIME}`
                          : "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.15)",
                      transform: `translate(0, -50%) translate3d(${card.dx * pop}px, ${
                        card.dy * pop
                      }px, 0) rotate(${card.rot * pop}deg) scale(${card.scale * (0.7 + 0.3 * pop)})`,
                    }}
                  >
                    <Img
                      src={card.src}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 18,
                        right: 18,
                        bottom: 18,
                        padding: "12px 16px",
                        borderRadius: 16,
                        background: "rgba(8,9,12,0.82)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: SANS,
                        color: "#FFF",
                        fontWeight: 800,
                        fontSize: 18,
                      }}
                    >
                      <span>{card.name}</span>
                      <span style={{ color: LIME }}>4K READY</span>
                    </div>
                  </div>
                ))}
              </AbsoluteFill>
            );
          }}
        />
      )}
    </AbsoluteFill>
  );
};

/* ======================================================================== */
/* ACT IV (660–1080 | 0:22–0:36): 4 VIRAL FORMATS SHOWCASE                  */
/* ======================================================================== */

/* Beat 4A (0..120 local): Side-by-Side Viral Hook Remix (UseFastlane 41s) */
const Beat4AHookRemix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.65 },
  });

  return (
    <AbsoluteFill>
      <BlurWordTitle
        startFrame={2}
        y={52}
        fontSize={62}
        tokens={[
          { text: "1." },
          { text: "Clone" },
          { text: "winning" },
          { text: "hooks", serif: true, color: COBALT },
          { text: "with" },
          { text: "your" },
          { text: "AI" },
          { text: "face." },
        ]}
        subline="Side-by-side motion & timing preservation — zero manual prompting."
      />

      <EchoTrail
        frame={frame}
        samples={4}
        stepFrames={0.55}
        trailOpacity={frame < 24 ? 0.22 : 0}
        renderAt={(sf, isGhost) => {
          const sp = spring({
            frame: sf,
            fps,
            config: { damping: 14, stiffness: 160, mass: 0.65 },
          });
          return (
            <div style={{ position: "absolute", inset: 0 }}>
              {/* Left Card: Viral Competitor Reference */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 610,
                  width: 430,
                  height: 680,
                  transform: `translate(-50%, -50%) translateX(${-370 * sp}px) rotate(${
                    -2.5 * sp
                  }deg) scale(${0.75 + 0.25 * sp})`,
                  borderRadius: 34,
                  overflow: "hidden",
                  background: "#14151A",
                  boxShadow: "0 30px 70px rgba(17,18,22,0.16), 0 0 0 1px rgba(17,18,22,0.1)",
                }}
              >
                {!isGhost ? (
                  <OffthreadVideo
                    src={SRC("hook-explore-video.mp4")}
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Img
                    src={SRC("hook-influencer-face.png")}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    left: 18,
                    top: 18,
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "rgba(17,18,22,0.82)",
                    color: "#FFF",
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 16,
                  }}
                >
                  ● Viral Reference · 2.4M views
                </div>
              </div>

              {/* Right Card: Your Vidmake AI Remix */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 610,
                  width: 430,
                  height: 680,
                  transform: `translate(-50%, -50%) translateX(${370 * sp}px) rotate(${
                    2.5 * sp
                  }deg) scale(${0.75 + 0.25 * sp})`,
                  borderRadius: 34,
                  overflow: "hidden",
                  background: "#14151A",
                  boxShadow: `0 34px 80px rgba(37,99,235,0.28), 0 0 0 4px ${COBALT}`,
                }}
              >
                {!isGhost ? (
                  <OffthreadVideo
                    src={SRC("hook-recreated-video.mp4")}
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Img
                    src={SRC("hook-influencer-face.png")}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    left: 18,
                    top: 18,
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: COBALT,
                    color: "#FFF",
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 16,
                  }}
                >
                  ✦ Your Vidmake Remix · 1080p
                </div>
              </div>
            </div>
          );
        }}
      />

      {/* Center Callout Comparison Badges (UseFastlane 41s style) */}
      {[
        { label: "← Exact camera pacing & gesture →", y: 505, delay: 14 },
        { label: "← Swapped to your AI creator →", y: 590, delay: 20 },
        { label: "← Ready to publish in 42 seconds →", y: 675, delay: 26 },
      ].map((badge) => {
        const bp = spring({
          frame: frame - badge.delay,
          fps,
          config: { damping: 13, stiffness: 210, mass: 0.5 },
        });
        return (
          <div
            key={badge.label}
            style={{
              position: "absolute",
              left: "50%",
              top: badge.y,
              transform: `translate(-50%, -50%) scale(${bp})`,
              opacity: Math.min(1, bp * 1.4),
              padding: "12px 24px",
              borderRadius: 999,
              background: "#FFFFFF",
              color: INK,
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 19,
              boxShadow: "0 16px 36px rgba(17,18,22,0.16), 0 0 0 1px rgba(17,18,22,0.08)",
              zIndex: 40,
            }}
          >
            {badge.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* Beat 4B (120..240 local): Talking Head + Product Demo in Dutch-Angle Studio */
const Beat4BTalkingHeadDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });
  const playheadX = interpolate(frame, [0, 118], [0, 620], CLAMP);

  return (
    <AbsoluteFill>
      <BlurWordTitle
        startFrame={2}
        y={46}
        fontSize={62}
        darkTheme
        tokens={[
          { text: "2." },
          { text: "Talking" },
          { text: "Head" },
          { text: "+" },
          { text: "Live Product Demo.", serif: true, color: LIME },
        ]}
        subline="AI creator pitch on top, synchronized SaaS or app walkthrough below."
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1800,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 605,
            width: 1480,
            height: 670,
            transform: `translate(-50%, -50%) rotateX(${8 * enter}deg) rotateY(${
              -6 * enter
            }deg) rotateZ(${-1.5 * enter}deg) scale(${0.86 + 0.14 * enter})`,
            display: "flex",
            gap: 34,
            alignItems: "center",
          }}
        >
          {/* Left: Split-Screen Talking Head + Demo Phone */}
          <div
            style={{
              width: 430,
              height: 670,
              borderRadius: 38,
              padding: 10,
              background: "linear-gradient(180deg, #334155 0%, #0F172A 100%)",
              boxShadow: "0 36px 90px rgba(0,0,0,0.7), 0 0 0 2px rgba(255,255,255,0.14)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                flex: 1,
                borderRadius: "28px 28px 12px 12px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <OffthreadVideo
                src={SRC("talking-head-source.mp4")}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 14,
                  transform: "translateX(-50%)",
                  padding: "6px 18px",
                  borderRadius: 10,
                  background: LIME,
                  color: INK,
                  fontFamily: DISPLAY,
                  fontSize: 24,
                  letterSpacing: 0.8,
                  whiteSpace: "nowrap",
                }}
              >
                SHIP 10X FASTER
              </div>
            </div>
            <div
              style={{
                flex: 1,
                borderRadius: "12px 12px 28px 28px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <OffthreadVideo
                src={SRC("product-demo-source.mp4")}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          </div>

          {/* Right: Remotion-inspired Dark Timeline & Script Inspector */}
          <div
            style={{
              flex: 1,
              height: 620,
              borderRadius: 32,
              background: "linear-gradient(180deg, #13161F 0%, #0D0F16 100%)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.09)",
              padding: 32,
              fontFamily: SANS,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 22,
                }}
              >
                <span
                  style={{
                    padding: "6px 16px",
                    borderRadius: 999,
                    background: "rgba(37,99,235,0.2)",
                    color: "#60A5FA",
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                >
                  ● AUTO-SYNCED TIMELINE
                </span>
                <span style={{ fontFamily: MONO, fontSize: 16, color: "rgba(255,255,255,0.5)" }}>
                  00:0{(frame / 30).toFixed(2)} / 00:15.00
                </span>
              </div>

              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 20,
                  background: "#1A1E2B",
                  marginBottom: 24,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#F8FAFC",
                  lineHeight: 1.4,
                }}
              >
                “Stop spending 14 hours editing product demos.{" "}
                <span style={{ background: LIME, color: INK, padding: "2px 10px", borderRadius: 8 }}>
                  Vidmake pairs your AI creator
                </span>{" "}
                with your live screen recording automatically.”
              </div>
            </div>

            {/* Multi-Track Timeline with Scrubbing Playhead */}
            <div style={{ position: "relative", paddingTop: 14 }}>
              {[
                { name: "Track 1 · AI Creator Lip-Sync (4K)", color: "#2563EB" },
                { name: "Track 2 · Product Demo Screen Capture", color: "#10B981" },
                { name: "Track 3 · Kinetic Word Captions + Voiceover", color: "#F97316" },
              ].map((tr) => (
                <div
                  key={tr.name}
                  style={{
                    height: 62,
                    borderRadius: 14,
                    background: tr.color,
                    marginBottom: 12,
                    padding: "0 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    fontSize: 18,
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.3)",
                  }}
                >
                  <span>{tr.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 14, opacity: 0.85 }}>LOCKED</span>
                </div>
              ))}

              {/* Red/Lime Playhead Line */}
              <div
                style={{
                  position: "absolute",
                  left: 140 + playheadX,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: LIME,
                  boxShadow: "0 0 16px #FFE600",
                }}
              >
                <div
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 4,
                    background: LIME,
                    transform: "translate(-6px, -4px) rotate(45deg)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* Beat 4C & 4D (240..420 local): 3D Phone Reel Ejector + 6-Slide Carousel Fan */
const Beat4CPhoneEjectAndCarousel: React.FC = () => {
  const frame = useCurrentFrame(); // 0..180 local
  const { fps } = useVideoConfig();

  const isCarouselPhase = frame >= 90;

  return (
    <AbsoluteFill>
      {!isCarouselPhase ? (
        <>
          <BlurWordTitle
            startFrame={2}
            y={52}
            fontSize={62}
            tokens={[
              { text: "3." },
              { text: "Wall-of-Text" },
              { text: "Reels," },
              { text: "ejected in batches.", serif: true, color: AMBER },
            ]}
            subline="Swap any creator face and rewrite the viral story overlay in one click."
          />

          {/* UseFastlane 63s-inspired 3D Phone Frame on Left Ejecting 3 Live Reels */}
          <EchoTrail
            frame={frame}
            samples={5}
            stepFrames={0.6}
            trailOpacity={frame < 34 ? 0.25 : 0}
            renderAt={(sf, isGhost) => {
              const p = spring({
                frame: sf - 4,
                fps,
                config: { damping: 14, stiffness: 160, mass: 0.65 },
              });

              return (
                <div style={{ position: "absolute", inset: 0 }}>
                  {/* 3D Phone Frame on Left */}
                  <div
                    style={{
                      position: "absolute",
                      left: 160,
                      top: 245,
                      width: 340,
                      height: 670,
                      borderRadius: 44,
                      padding: 12,
                      background: "#111216",
                      boxShadow:
                        "-24px 36px 70px rgba(17,18,22,0.22), 0 0 0 2px rgba(17,18,22,0.15)",
                      transform: `perspective(1400px) rotateY(18deg) rotateZ(-2deg) scale(${
                        0.85 + 0.15 * p
                      })`,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 34,
                        background: "#FFFFFF",
                        padding: 20,
                        fontFamily: SANS,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 20, color: INK }}>
                          @lumina.daily ✓
                        </div>
                        <div style={{ fontSize: 14, color: "rgba(17,18,22,0.55)", marginTop: 4 }}>
                          AI Organic Creator Account · 48.2K followers
                        </div>
                        <div
                          style={{
                            marginTop: 18,
                            height: 360,
                            borderRadius: 22,
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          <Img
                            src={SRC("wot-reference-face.png")}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "12px 16px",
                          borderRadius: 14,
                          background: INK,
                          color: "#FFF",
                          fontWeight: 800,
                          fontSize: 15,
                          textAlign: "center",
                        }}
                      >
                        3 Variations Ejected →
                      </div>
                    </div>
                  </div>

                  {/* 3 Live Ejected Wall-of-Text Reels peeling out of the phone */}
                  {[
                    {
                      title: "Hook #1 · Founder Story",
                      video: SRC("wot-result-video.mp4"),
                      x: 610,
                      y: 265,
                      rot: -4,
                      delay: 6,
                    },
                    {
                      title: "Hook #2 · Morning Routine",
                      video: SRC("wot-hero-1.mp4"),
                      x: 1005,
                      y: 245,
                      rot: 0,
                      delay: 11,
                    },
                    {
                      title: "Hook #3 · Unpopular Opinion",
                      video: SRC("wot-hero-2.mp4"),
                      x: 1400,
                      y: 265,
                      rot: 4,
                      delay: 16,
                    },
                  ].map((reel) => {
                    const rp = spring({
                      frame: sf - reel.delay,
                      fps,
                      config: { damping: 13, stiffness: 165, mass: 0.65 },
                    });
                    const rx = interpolate(rp, [0, 1], [220, reel.x]);
                    const ry = interpolate(rp, [0, 1], [300, reel.y]);
                    return (
                      <div
                        key={reel.title}
                        style={{
                          position: "absolute",
                          left: rx,
                          top: ry,
                          width: 345,
                          height: 620,
                          borderRadius: 30,
                          overflow: "hidden",
                          background: "#14151A",
                          boxShadow:
                            "0 30px 65px rgba(17,18,22,0.20), 0 0 0 2px rgba(255,255,255,0.8)",
                          transform: `rotate(${reel.rot * rp}deg) scale(${0.55 + 0.45 * rp})`,
                          opacity: Math.min(1, rp * 1.35),
                        }}
                      >
                        {!isGhost ? (
                          <OffthreadVideo
                            src={reel.video}
                            muted
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <Img
                            src={SRC("wot-reference-face.png")}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        )}
                        <div
                          style={{
                            position: "absolute",
                            left: 14,
                            right: 14,
                            bottom: 14,
                            padding: "10px 14px",
                            borderRadius: 14,
                            background: "rgba(17,18,22,0.84)",
                            color: "#FFF",
                            fontFamily: SANS,
                            fontWeight: 800,
                            fontSize: 16,
                          }}
                        >
                          {reel.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
        </>
      ) : (
        /* Beat 4D (90..180 local): 6-Slide Viral Photo Carousel Fan-Out */
        <>
          <BlurWordTitle
            startFrame={92}
            y={52}
            fontSize={62}
            tokens={[
              { text: "4." },
              { text: "6-Slide" },
              { text: "Viral" },
              { text: "Carousels", serif: true, color: COBALT },
              { text: "for" },
              { text: "TikTok & IG." },
            ]}
            subline="Consistent creator face and story captions across every swipeable slide."
          />

          <EchoTrail
            frame={frame}
            samples={4}
            stepFrames={0.55}
            trailOpacity={frame < 116 ? 0.22 : 0}
            renderAt={(sf) => {
              const cFrame = sf - 92;
              return (
                <div style={{ position: "absolute", inset: 0 }}>
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const sp = spring({
                      frame: cFrame - i * 2.2,
                      fps,
                      config: { damping: 14, stiffness: 170, mass: 0.6 },
                    });
                    const offset = i - 2.5;
                    const x = offset * 265 * sp;
                    const y = Math.abs(offset) * 24 * sp + 625;
                    const rot = offset * 4.2 * sp;
                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: y,
                          width: 315,
                          height: 540,
                          borderRadius: 28,
                          overflow: "hidden",
                          background: "#181920",
                          boxShadow:
                            "0 28px 60px rgba(17,18,22,0.18), 0 0 0 2px rgba(255,255,255,0.85)",
                          transform: `translate(-50%, -50%) translateX(${x}px) rotate(${rot}deg) scale(${
                            0.6 + 0.4 * sp
                          })`,
                          opacity: Math.min(1, sp * 1.4),
                        }}
                      >
                        <Img
                          src={SRC(`slideshow-result-${i}.jpg`)}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: 14,
                            top: 14,
                            padding: "5px 12px",
                            borderRadius: 999,
                            background: "rgba(17,18,22,0.8)",
                            color: "#FFF",
                            fontFamily: SANS,
                            fontWeight: 800,
                            fontSize: 14,
                          }}
                        >
                          Slide 0{i + 1} / 06
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

/* ======================================================================== */
/* ACT V (1080–1260 | 0:36–0:42): 24-HOUR AUTOPILOT SOCIAL SCHEDULING       */
/* ======================================================================== */

const Act5AutopilotSchedule: React.FC = () => {
  const frame = useCurrentFrame(); // 0..180 local
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 160, mass: 0.7 },
  });
  const clickedSchedule = frame >= 66;
  const cursorX = interpolate(frame, [10, 58, 66, 110], [520, 385, 375, 620], {
    ...CLAMP,
    easing: easeOut,
  });
  const cursorY = interpolate(frame, [10, 58, 66, 110], [340, -172, -176, 260], {
    ...CLAMP,
    easing: easeOut,
  });

  const days = [
    { day: "MON · 09:30", fmt: "Hook Video", img: SRC("hook-influencer-face.png"), plat: "TikTok" },
    {
      day: "TUE · 14:00",
      fmt: "Talking Head",
      img: SRC("talking-head-start.png"),
      plat: "IG Reels",
    },
    {
      day: "WED · 18:15",
      fmt: "Wall of Text",
      img: SRC("wot-reference-face.png"),
      plat: "YouTube Shorts",
    },
    {
      day: "THU · 11:00",
      fmt: "6-Slide Carousel",
      img: SRC("slideshow-result-0.jpg"),
      plat: "TikTok",
    },
    {
      day: "FRI · 16:45",
      fmt: "AI Creator Reel",
      img: AICHAR("aichar-final-outcome.png"),
      plat: "IG Reels",
    },
  ];

  return (
    <AbsoluteFill>
      <BlurWordTitle
        startFrame={2}
        y={50}
        fontSize={64}
        tokens={[
          { text: "Scheduled" },
          { text: "to" },
          { text: "TikTok, IG & Shorts", serif: true, color: COBALT },
          { text: "on" },
          { text: "autopilot." },
        ]}
        subline="Interactive 24-hour scheduling across every connected creator channel."
      />

      {/* Main Autopilot Schedule Card */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 605,
          width: 1540,
          height: 660,
          transform: `translate(-50%, -50%) scale(${0.88 + 0.12 * enter})`,
          borderRadius: 36,
          background: "#FFFFFF",
          boxShadow: "0 36px 90px rgba(17,18,22,0.12), 0 0 0 1px rgba(17,18,22,0.07)",
          padding: 34,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Top Bar: 24h Picker + Connected Channels + Publish Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                padding: "12px 20px",
                borderRadius: 16,
                background: INK,
                color: "#FFFFFF",
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 18,
                whiteSpace: "nowrap",
              }}
            >
              🕒 24h Queue · 09:30 · 14:00 · 18:15
            </div>
            {["TikTok Connected", "IG Reels Connected", "YouTube Shorts Connected"].map(
              (ch) => (
                <div
                  key={ch}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: "#F3F4F6",
                    color: INK,
                    fontWeight: 700,
                    fontSize: 16,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: EMERALD }}>●</span>
                  <span>{ch}</span>
                </div>
              )
            )}
          </div>

          <div
            style={{
              padding: "14px 28px",
              borderRadius: 999,
              background: clickedSchedule
                ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                : "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 19,
              whiteSpace: "nowrap",
              boxShadow: "0 12px 30px rgba(37,99,235,0.28)",
              transform: `scale(${clickedSchedule && frame < 74 ? 0.94 : 1})`,
            }}
          >
            {clickedSchedule ? "✓ 21 Reels Queued This Week" : "Schedule All 21 Reels ✦"}
          </div>
        </div>

        {/* 5-Column Weekly Calendar Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 18,
            height: 480,
          }}
        >
          {days.map((d, i) => {
            const p = spring({
              frame: frame - 14 - i * 4,
              fps,
              config: { damping: 14, stiffness: 180, mass: 0.6 },
            });
            const locked = frame >= 68 + i * 4;
            return (
              <div
                key={d.day}
                style={{
                  borderRadius: 24,
                  overflow: "hidden",
                  position: "relative",
                  background: "#14151A",
                  transform: `translateY(${(1 - p) * 40}px) scale(${0.85 + 0.15 * p})`,
                  opacity: Math.min(1, p * 1.4),
                  boxShadow: locked
                    ? `0 20px 45px rgba(16,185,129,0.22), 0 0 0 3px ${EMERALD}`
                    : "0 16px 36px rgba(17,18,22,0.12)",
                }}
              >
                <Img
                  src={d.img}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.85) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 14,
                    right: 14,
                    top: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontFamily: MONO,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#FFF",
                  }}
                >
                  <span>{d.day}</span>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: locked ? EMERALD : "rgba(255,255,255,0.2)",
                      color: "#FFF",
                    }}
                  >
                    {locked ? "QUEUED ✓" : d.plat}
                  </span>
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: 16,
                    bottom: 16,
                    color: "#FFF",
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{d.fmt}</div>
                  <div style={{ fontSize: 14, opacity: 0.78 }}>{d.plat} Auto-Post</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sculpted3DCursor x={cursorX} y={cursorY} clicking={frame >= 64 && frame <= 72} />
    </AbsoluteFill>
  );
};

/* ======================================================================== */
/* ACT VI (1260–1440 | 0:42–0:48): 3-LINE MANIFESTO & VIDMAKE.IO FINALE     */
/* ======================================================================== */

const Act6ManifestoAndFinale: React.FC = () => {
  const frame = useCurrentFrame(); // 0..180 local
  const { fps } = useVideoConfig();

  const isLockupPhase = frame >= 68;
  const lockupRel = frame - 68;
  const lockupIn = spring({
    frame: lockupRel,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });

  const cursorX = interpolate(frame, [95, 134, 142], [520, 140, 130], {
    ...CLAMP,
    easing: easeOut,
  });
  const cursorY = interpolate(frame, [95, 134, 142], [380, 195, 190], {
    ...CLAMP,
    easing: easeOut,
  });
  const ctaClicked = frame >= 136;

  return (
    <AbsoluteFill>
      {!isLockupPhase ? (
        /* Phase 6A (0..68 local): Terminus-style 3-Line Stacked Manifesto */
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 18,
          }}
        >
          {[
            { num: "100%", rest: "Proven Viral Hooks.", color: COBALT, delay: 2 },
            { num: "Zero", rest: "Photoshoots or Shipping.", color: AMBER, delay: 14 },
            { num: "24/7", rest: "Organic & Paid Autopilot.", color: "#059669", delay: 26 },
          ].map((line) => {
            const p = spring({
              frame: frame - line.delay,
              fps,
              config: { damping: 15, stiffness: 180, mass: 0.65 },
            });
            const blur = interpolate(frame - line.delay, [0, 10], [16, 0], CLAMP);
            return (
              <div
                key={line.rest}
                style={{
                  fontFamily: SANS,
                  fontSize: 82,
                  fontWeight: 900,
                  letterSpacing: -3.2,
                  lineHeight: 1.06,
                  color: INK,
                  transform: `translateY(${(1 - p) * 32}px) scale(${0.92 + 0.08 * p})`,
                  opacity: Math.min(1, p * 1.4),
                  filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: 94,
                    color: line.color,
                    marginRight: 18,
                  }}
                >
                  {line.num}
                </span>
                <span>{line.rest}</span>
              </div>
            );
          })}
        </AbsoluteFill>
      ) : (
        /* Phase 6B (68..180 local): Grand Dark Obsidian Finale Lockup + Orbiting Reels */
        <AbsoluteFill>
          {/* Framing Halo of 6 Floating Vertical Cards Around the Edge */}
          {[
            { src: AICHAR("aichar-final-outcome.png"), x: -730, y: -210, rot: -8 },
            { src: SRC("hook-influencer-face.png"), x: 730, y: -210, rot: 8 },
            { src: SRC("talking-head-start.png"), x: -760, y: 210, rot: 6 },
            { src: SRC("slideshow-result-0.jpg"), x: 760, y: 210, rot: -6 },
          ].map((c, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 220,
                height: 350,
                borderRadius: 24,
                overflow: "hidden",
                opacity: 0.42 * lockupIn,
                boxShadow: "0 24px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.14)",
                transform: `translate(-50%, -50%) translate3d(${c.x * lockupIn}px, ${
                  c.y * lockupIn
                }px, 0) rotate(${c.rot}deg)`,
              }}
            >
              <Img src={c.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}

          {/* Center Hero Brand Lockup */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) scale(${0.86 + 0.14 * lockupIn})`,
              opacity: Math.min(1, lockupIn * 1.4),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
            <VidmakeLogoMark size={92} dark />

            <div
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 76,
                letterSpacing: -2.8,
                lineHeight: 1.04,
                color: "#FFFFFF",
                textAlign: "center",
                maxWidth: 1120,
              }}
            >
              Your entire UGC growth engine.{" "}
              <span
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: 88,
                  color: LIME,
                }}
              >
                In one studio.
              </span>
            </div>

            <div
              style={{
                fontFamily: SANS,
                fontSize: 26,
                fontWeight: 500,
                color: "rgba(255,255,255,0.65)",
                marginBottom: 8,
              }}
            >
              {BRAND_TAGLINE}
            </div>

            {/* Glowing CTA Button */}
            <div
              style={{
                padding: "22px 54px",
                borderRadius: 999,
                background: ctaClicked
                  ? LIME
                  : "linear-gradient(135deg, #2563EB 0%, #4F46E5 55%, #F97316 100%)",
                color: ctaClicked ? INK : "#FFFFFF",
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 30,
                letterSpacing: -0.6,
                boxShadow: ctaClicked
                  ? "0 0 70px rgba(255,230,0,0.65)"
                  : "0 24px 60px rgba(37,99,235,0.48)",
                transform: `scale(${ctaClicked ? 1.05 : 1})`,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span>Start Creating at {BRAND_DOMAIN}</span>
              <span>→</span>
            </div>
          </div>

          <Sculpted3DCursor
            x={cursorX}
            y={cursorY}
            opacity={interpolate(frame, [95, 108], [0, 1], CLAMP)}
            clicking={frame >= 134 && frame <= 144}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/* ======================================================================== */
/* MASTER COMPOSITION: <VidmakeLaunchPromo>                                  */
/* ======================================================================== */

export const VidmakeLaunchPromo: React.FC = () => {
  const frame = useCurrentFrame();

  // Dark Studio stages: Act III (390..660), Beat 4B (780..900), and Finale Lockup (1328..1440)
  const isDarkStage =
    (frame >= 390 && frame < 660) ||
    (frame >= 780 && frame < 900) ||
    frame >= 1328;

  const auraColor =
    frame < 180
      ? "rgba(249,115,22,0.16)"
      : frame < 390
        ? "rgba(37,99,235,0.16)"
        : frame < 660
          ? "rgba(255,230,0,0.12)"
          : frame < 1080
            ? "rgba(249,115,22,0.15)"
            : frame < 1260
              ? "rgba(16,185,129,0.15)"
              : "rgba(37,99,235,0.22)";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: isDarkStage ? OBSIDIAN : IVORY,
        overflow: "hidden",
      }}
    >
      <style>
        {`
          @font-face {
            font-family: 'Instrument Serif';
            font-style: italic;
            font-weight: 400;
            src: url('${staticFile("fonts/instrument-serif-latin-400-italic.woff2")}') format('woff2');
          }
          @font-face {
            font-family: 'Anton';
            font-style: normal;
            font-weight: 400;
            src: url('${staticFile("fonts/anton-latin-400-normal.woff2")}') format('woff2');
          }
        `}
      </style>

      {/* Center Radial Color Aura (UseFastlane signature) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 52% 54% at 50% 54%, ${auraColor} 0%, rgba(0,0,0,0) 72%)`,
          pointerEvents: "none",
        }}
      />

      {/* Subtle Studio Grid & Tactile Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: isDarkStage
            ? "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)"
            : "radial-gradient(rgba(17,18,22,0.055) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          pointerEvents: "none",
        }}
      />

      {/* Act I: 0..180 (0:00..0:06) */}
      <Sequence from={0} durationInFrames={180}>
        <Act1BrokenToBrand />
      </Sequence>

      {/* Act II: 180..390 (0:06..0:13) */}
      <Sequence from={180} durationInFrames={210}>
        <Act2BrandIntelligence />
      </Sequence>

      {/* Act III: 390..660 (0:13..0:22) */}
      <Sequence from={390} durationInFrames={270}>
        <Act3CharacterStudio />
      </Sequence>

      {/* Act IV-A: 660..780 (0:22..0:26) — Hook Video Remix */}
      <Sequence from={660} durationInFrames={120}>
        <Beat4AHookRemix />
      </Sequence>

      {/* Act IV-B: 780..900 (0:26..0:30) — Talking Head + Product Demo */}
      <Sequence from={780} durationInFrames={120}>
        <Beat4BTalkingHeadDemo />
      </Sequence>

      {/* Act IV-C & D: 900..1080 (0:30..0:36) — 3D Phone Eject + 6-Slide Carousel */}
      <Sequence from={900} durationInFrames={180}>
        <Beat4CPhoneEjectAndCarousel />
      </Sequence>

      {/* Act V: 1080..1260 (0:36..0:42) — Autopilot Social Scheduling */}
      <Sequence from={1080} durationInFrames={180}>
        <Act5AutopilotSchedule />
      </Sequence>

      {/* Act VI: 1260..1440 (0:42..0:48) — 3-Line Manifesto & Finale Lockup */}
      <Sequence from={1260} durationInFrames={180}>
        <Act6ManifestoAndFinale />
      </Sequence>
    </AbsoluteFill>
  );
};
