import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const outputDir = path.join(workspaceRoot, ".tmp", "carousel-renderer-phase9");

const {
  CAROUSEL_RENDERER_VERSION,
  inspectCarouselSlideLayout,
  renderCarouselSlide,
} = await import(
  "../worker/dist/lib/carousel-render-slide.js",
);
const {
  CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
  renderCarouselStructure2SlideFromBuffer,
} = await import(
  "../worker/dist/lib/carousel-structure-2-render-slide.js",
);

await mkdir(outputDir, { recursive: true });

const cases = [
  {
    background: "exact-bubble-containment-regression",
    backgroundKind: "dark-night-desk",
    format: "4:5",
    slide: {
      body:
        "Bring the scattered steps into one clearer workflow so the next action is easier to find before the launch slows down.",
      ctaText: null,
      headline: "Plan your day smarter with AI insights and reminders.",
      imageDirection: "Object-only workstation with open central text space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 4,
      slideType: "solution",
      subtext:
        "Bring the scattered steps into one clearer workflow so the next action is easier to find before the launch slows down.",
      textMode: "headline_body",
      textPosition: "center",
    },
  },
  {
    background: "headline-body",
    backgroundKind: "organized-desk",
    format: "4:5",
    slide: {
      body:
        "This legacy support copy must never create a second Slide 1 text layer.",
      ctaText: null,
      headline: "Why routines break before they stick",
      imageDirection: "Object-only organized desk with open center space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 1,
      slideType: "problem",
      subtext:
        "This legacy support copy must never create a second Slide 1 text layer.",
      textMode: "single_statement",
      textPosition: "center",
    },
  },
  {
    background: "body-only",
    backgroundKind: "dark-night-desk",
    format: "4:5",
    slide: {
      body:
        "Small tracking shortcuts add up, blur the real pattern, and make it harder to trust your next decision.",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only evening desk with lamp and open middle space.",
      listItems: [],
      layoutPreset: "caption-cluster",
      slideNumber: 2,
      slideType: "problem",
      subtext:
        "Small tracking shortcuts add up, blur the real pattern, and make it harder to trust your next decision.",
      textMode: "body_only",
      textPosition: "center",
    },
  },
  {
    background: "reference-production-copy",
    backgroundKind: "organized-desk",
    format: "4:5",
    slide: {
      body:
        "Separate tools hide the next action when deadlines and approvals start moving.",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only organized desk with open center space.",
      listItems: [],
      layoutPreset: "bottom-message",
      slideNumber: 2,
      slideType: "problem",
      subtext:
        "Separate tools hide the next action when deadlines and approvals start moving.",
      textMode: "body_only",
      textPosition: "bottom",
    },
  },
  {
    background: "question-list",
    backgroundKind: "spreadsheet-chaos",
    format: "1:1",
    slide: {
      body: null,
      ctaText: null,
      headline: "you can only fix 2:",
      imageDirection: "Object-only messy spreadsheet printouts with clear center space.",
      listItems: [
        "late-night snacking",
        "forgetting to log meals",
          "guessing portions",
          "eating out every weekend",
        ],
      layoutPreset: "interactive-list",
      slideNumber: 3,
      slideType: "problem",
      subtext: null,
      textMode: "question_list",
      textPosition: "center",
    },
  },
  {
    background: "single-statement",
    backgroundKind: "clean-still-life",
    format: "1:1",
    slide: {
      body:
        "tracking should feel lighter than the life around it, so the routine still works when meals, plans, and timing change.",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only clean still life with large open text-safe space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 4,
      slideType: "benefit",
      subtext:
        "tracking should feel lighter than the life around it, so the routine still works when meals, plans, and timing change.",
      textMode: "single_statement",
      textPosition: "center",
    },
  },
  {
    background: "final-takeaway",
    backgroundKind: "clean-still-life",
    format: "1:1",
    slide: {
      body:
        "make the system fit the week you actually live, then use the pattern to make better choices without restarting every Monday",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only clean still life with large open text-safe space.",
      listItems: [],
      layoutPreset: "bottom-message",
      slideNumber: 6,
      slideType: "cta",
      subtext:
        "make the system fit the week you actually live, then use the pattern to make better choices without restarting every Monday",
      textMode: "single_statement",
      textPosition: "center",
    },
  },
];

const outputs = [];
const diagnostics = [];

for (const item of cases) {
  const layoutDiagnostics = await inspectCarouselSlideLayout({
    format: item.format,
    slide: item.slide,
  });

  const isCover = item.slide.slideNumber === 1;
  const hasHeadlineTreatment =
    !isCover &&
    Boolean(item.slide.headline) &&
    item.slide.textMode !== "body_only" &&
    item.slide.textMode !== "single_statement";
  const expectedStrategy = isCover
    ? "plain-white-text"
    : hasHeadlineTreatment
      ? "heading-white-svg-background"
      : "plain-white-text-with-outline";
  const expectedWhiteBackgroundGroups = hasHeadlineTreatment ? 1 : 0;

  if (
    layoutDiagnostics.bubbleShapeStrategy !== expectedStrategy ||
    layoutDiagnostics.whiteBackgroundGroupCount !== expectedWhiteBackgroundGroups ||
    !layoutDiagnostics.fontFamily.includes("Inter Tight") ||
    layoutDiagnostics.maxTextWidth <= 0
  ) {
    throw new Error(
      `Centered Inter Tight layout audit failed for ${item.background}.`,
    );
  }

  const background = await createBackground(item.backgroundKind);
  const rendered = await renderCarouselSlide({
    assetUrl: `data:image/jpeg;base64,${background.toString("base64")}`,
    format: item.format,
    slide: item.slide,
    textStyle: "highlight",
  });
  const outputPath = path.join(outputDir, `${item.background}.webp`);

  await writeFile(outputPath, rendered);
  outputs.push(outputPath);
  diagnostics.push({ case: item.background, ...layoutDiagnostics });
}

await writeContactSheet(outputs, path.join(outputDir, "contact-sheet.webp"));

const legacyCoverCase = cases.find((item) => item.background === "headline-body");
if (!legacyCoverCase) throw new Error("Missing legacy Slide 1 audit case.");
const legacyCoverBackground = await createBackground(legacyCoverCase.backgroundKind);
const legacyCoverWithSupport = await renderCarouselSlide({
  assetUrl: `data:image/jpeg;base64,${legacyCoverBackground.toString("base64")}`,
  format: legacyCoverCase.format,
  slide: legacyCoverCase.slide,
  textStyle: "highlight",
});
const legacyCoverWithoutSupport = await renderCarouselSlide({
  assetUrl: `data:image/jpeg;base64,${legacyCoverBackground.toString("base64")}`,
  format: legacyCoverCase.format,
  slide: {
    ...legacyCoverCase.slide,
    body: null,
    subtext: null,
  },
  textStyle: "highlight",
});
const [legacyCoverPixels, singleHookPixels] = await Promise.all([
  sharp(legacyCoverWithSupport).raw().toBuffer(),
  sharp(legacyCoverWithoutSupport).raw().toBuffer(),
]);
if (!legacyCoverPixels.equals(singleHookPixels)) {
  throw new Error("Legacy Slide 1 support copy changed the rendered single-hook cover.");
}

const structure1ContractOutputs = await renderStructure1ContractCarousel();
const structure2ContractOutputs = await renderStructure2ContractCarousel();
await writeContactSheet(
  structure1ContractOutputs,
  path.join(outputDir, "structure1-contract-contact-sheet.webp"),
);
await writeContactSheet(
  structure2ContractOutputs,
  path.join(outputDir, "structure2-contract-contact-sheet.webp"),
);

console.log(
  JSON.stringify(
    {
      outputDir,
      outputs,
      diagnostics,
      contactSheet: path.join(outputDir, "contact-sheet.webp"),
      rendererVersion: CAROUSEL_RENDERER_VERSION,
      singleHookLegacySupportIgnored: true,
      structure1ContractContactSheet: path.join(
        outputDir,
        "structure1-contract-contact-sheet.webp",
      ),
      structure1ContractOutputs,
      structure2ContractContactSheet: path.join(
        outputDir,
        "structure2-contract-contact-sheet.webp",
      ),
      structure2ContractOutputs,
      structure2RendererVersion: CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
    },
    null,
    2,
  ),
);

async function renderStructure1ContractCarousel() {
  const background = await createBackground("organized-desk");
  const slides = [
    {
      body: null,
      ctaText: null,
      headline: "Why campaign handoffs lose momentum",
      imageDirection: "Object-only organized desk with open central text space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 1,
      slideType: "hook",
      subtext: null,
      textMode: "single_statement",
      textPosition: "center",
    },
    {
      body: "Map the campaign owner, decision, and deadline in one shared place so every handoff begins with a clear accountable next step.",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only organized desk with open central text space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 2,
      slideType: "problem",
      subtext: null,
      textMode: "body_only",
      textPosition: "center",
    },
    {
      body: "Keep approval context beside the active work so reviewers can understand what changed, why it changed, and which decision still needs attention.",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only organized desk with open central text space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 3,
      slideType: "solution",
      subtext: null,
      textMode: "body_only",
      textPosition: "center",
    },
    {
      body: "Review current reporting details before moving a launch date, so campaign timing reflects new evidence instead of an outdated planning assumption.",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only organized desk with open central text space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 4,
      slideType: "benefit",
      subtext: null,
      textMode: "body_only",
      textPosition: "center",
    },
    {
      body: "Keep every choice connected to one owner and one next step so campaign reviews continue without repeated questions or missing context.",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only organized desk with open central text space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 5,
      slideType: "differentiator",
      subtext: null,
      textMode: "body_only",
      textPosition: "center",
    },
    {
      body: "Keep every next action, decision, and owner connected in one visible workflow, so campaign handoffs remain clear when priorities change.",
      ctaText: null,
      headline: null,
      imageDirection: "Object-only organized desk with open central text space.",
      listItems: [],
      layoutPreset: "middle-statement",
      slideNumber: 6,
      slideType: "cta",
      subtext: null,
      textMode: "cta_takeaway",
      textPosition: "center",
    },
  ];

  return Promise.all(
    slides.map(async (slide) => {
      let rendered;
      try {
        rendered = await renderCarouselSlide({
          assetUrl: `data:image/jpeg;base64,${background.toString("base64")}`,
          format: "4:5",
          slide,
          textStyle: "highlight",
        });
      } catch (error) {
        throw new Error(
          `Structure 1 contract Slide ${slide.slideNumber} failed to render: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const outputPath = path.join(
        outputDir,
        `structure1-contract-slide-${slide.slideNumber}.webp`,
      );
      await writeFile(outputPath, rendered);
      return outputPath;
    }),
  );
}

async function renderStructure2ContractCarousel() {
  const background = await createBackground("organized-desk");
  const stories = [
    "Why campaign handoffs lose momentum",
    "When priorities changed, I rebuilt the same launch plan repeatedly, delayed decisions, and lost the context that teammates needed to keep moving.",
    "The real problem was that our decisions, owners, and timelines lived separately, so each new change forced the team to reconstruct the handoff.",
    "Todaywise keeps the task, decision, owner, and next step connected, so changing priorities update the workflow without rebuilding the campaign plan from scratch.",
    "The work still changed, but the team could see what mattered next, who owned it, and why the decision had already been made.",
    "Keep the next decision, owner, and context visible, so a changing priority becomes one manageable handoff instead of a complete reset.",
  ];
  const roles = [
    "recognition",
    "failure_scene",
    "reframe",
    "product_turning_point",
    "proof_reflection_cta",
    "takeaway_cta",
  ];

  return Promise.all(
    stories.map(async (storyText, index) => {
      const slideNumber = index + 1;
      const rendered = await renderCarouselStructure2SlideFromBuffer({
        assetBuffer: background,
        format: "4:5",
        spec: {
          assetId: "00000000-0000-0000-0000-000000000001",
          assetUrl: "https://example.test/contract-background.webp",
          ctaText: null,
          layoutVariant:
            slideNumber === 1 || slideNumber === 4
              ? "story_pill_overlay"
              : "story_overlay_only",
          productVisualEligibility: "forbidden",
          slideNumber,
          storyFormatId: "wrong_belief",
          storyRole: roles[index],
          storyText,
          textPosition: "center",
          textTreatment: "overlay",
          visualContext: "Object-only organized desk with open central text space.",
          visualRole: slideNumber === 1 ? "hook" : "static",
        },
      });
      const outputPath = path.join(
        outputDir,
        `structure2-contract-slide-${slideNumber}.webp`,
      );
      await writeFile(outputPath, rendered.buffer);
      return outputPath;
    }),
  );
}

async function createBackground(kind) {
  const width = 1500;
  const height = 1900;
  const svg = buildBackgroundSvg(kind, width, height);

  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

async function writeContactSheet(outputs, outputPath) {
  const tileWidth = 320;
  const labelHeight = 42;
  const gap = 24;
  const columns = 3;
  const rows = Math.ceil(outputs.length / columns);
  const tileHeight = 400;
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = rows * (tileHeight + labelHeight) + (rows + 1) * gap;
  const composites = [];

  for (const [index, output] of outputs.entries()) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = gap + column * (tileWidth + gap);
    const y = gap + row * (tileHeight + labelHeight + gap);
    const label = path.basename(output, ".webp");
    const image = await sharp(output)
      .resize(tileWidth, tileHeight, { fit: "contain", background: "#f7f5f0" })
      .webp()
      .toBuffer();
    const labelSvg = Buffer.from(`
      <svg width="${tileWidth}" height="${labelHeight}" viewBox="0 0 ${tileWidth} ${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <text x="${Math.round(tileWidth / 2)}" y="28" text-anchor="middle" fill="#102136" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="760">${label}</text>
      </svg>
    `);

    composites.push({ input: image, left: x, top: y });
    composites.push({ input: labelSvg, left: x, top: y + tileHeight });
  }

  await sharp({
    create: {
      background: "#f7f5f0",
      channels: 4,
      height,
      width,
    },
  })
    .composite(composites)
    .webp({ quality: 92 })
    .toFile(outputPath);
}

function buildBackgroundSvg(kind, width, height) {
  if (kind === "dark-night-desk") {
    return svgFrame({
      background: "#191713",
      content: `
        <rect x="0" y="0" width="${width}" height="${height}" fill="#191713"/>
        <rect x="130" y="1210" width="1240" height="410" rx="34" fill="#2b2119"/>
        <circle cx="1170" cy="390" r="190" fill="#b58a55" opacity="0.72"/>
        <rect x="258" y="1295" width="520" height="265" rx="24" fill="#37322c"/>
        <rect x="820" y="1305" width="340" height="220" rx="20" fill="#12161b"/>
        <rect x="205" y="520" width="1090" height="560" rx="42" fill="#302a24" opacity="0.72"/>
        <path d="M100 1180 C 360 1040, 720 1040, 1400 1130 L 1400 1900 L 100 1900 Z" fill="#251f1a" opacity="0.9"/>
      `,
      height,
      width,
    });
  }

  if (kind === "spreadsheet-chaos") {
    return svgFrame({
      background: "#d9d2c8",
      content: `
        <rect x="0" y="0" width="${width}" height="${height}" fill="#d9d2c8"/>
        <rect x="120" y="150" width="640" height="760" rx="18" fill="#f5f2ea" transform="rotate(-9 120 150)"/>
        <rect x="760" y="230" width="570" height="700" rx="18" fill="#ece6dc" transform="rotate(8 760 230)"/>
        <rect x="215" y="1060" width="1040" height="590" rx="24" fill="#f7f5ef"/>
        <g stroke="#9aa6af" stroke-width="4" opacity="0.72">
          ${Array.from({ length: 9 }, (_, index) => `<line x1="265" y1="${1120 + index * 54}" x2="1205" y2="${1120 + index * 54}"/>`).join("")}
          ${Array.from({ length: 7 }, (_, index) => `<line x1="${320 + index * 132}" y1="1085" x2="${320 + index * 132}" y2="1610"/>`).join("")}
        </g>
        <circle cx="1140" cy="420" r="145" fill="#0f2136" opacity="0.18"/>
        <rect x="360" y="365" width="400" height="88" rx="18" fill="#1c334c" opacity="0.22"/>
      `,
      height: width,
      width,
    });
  }

  if (kind === "clean-still-life") {
    return svgFrame({
      background: "#ece5d9",
      content: `
        <rect x="0" y="0" width="${width}" height="${width}" fill="#ece5d9"/>
        <circle cx="1160" cy="280" r="175" fill="#d6c7b0"/>
        <rect x="185" y="195" width="430" height="650" rx="30" fill="#fffaf0" transform="rotate(-7 185 195)"/>
        <rect x="795" y="815" width="470" height="300" rx="38" fill="#1c242e" opacity="0.86"/>
        <rect x="270" y="1030" width="465" height="210" rx="28" fill="#c5b49b"/>
        <circle cx="500" cy="820" r="132" fill="#ffffff" opacity="0.82"/>
        <circle cx="500" cy="820" r="82" fill="#bea174" opacity="0.48"/>
      `,
      height: width,
      width,
    });
  }

  return svgFrame({
    background: "#cfa66f",
    content: `
      <rect x="0" y="0" width="${width}" height="${height}" fill="#cfa66f"/>
      <g opacity="0.32">
        ${Array.from({ length: 11 }, (_, index) => `<rect x="${index * 150}" y="0" width="14" height="${height}" fill="#74502c"/>`).join("")}
      </g>
      <rect x="740" y="180" width="560" height="760" rx="42" fill="#222831" transform="rotate(12 740 180)"/>
      <rect x="785" y="235" width="470" height="650" rx="28" fill="#d8e0df" transform="rotate(12 785 235)"/>
      <circle cx="330" cy="390" r="165" fill="#f0eee5"/>
      <circle cx="330" cy="390" r="102" fill="#b4865a"/>
      <rect x="165" y="980" width="710" height="370" rx="32" fill="#e8dac9" transform="rotate(-7 165 980)"/>
      <rect x="880" y="1160" width="355" height="220" rx="32" fill="#27333a" opacity="0.88"/>
    `,
    height,
    width,
  });
}

function svgFrame({ background, content, height, width }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"/>
    ${content}
  </svg>`;
}
