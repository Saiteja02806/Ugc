import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const DEFAULT_ARIAL_BOLD_FONT_PATH = "C:\\Windows\\Fonts\\arialbd.ttf";
const INTER_FONT_PATH = "lib/trending/fonts/inter-variable.ttf";
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const OUTLINE_WIDTH = 4;
const INLINE_PADDING = 15;
const FONT_SIZES = [52, 50, 48, 46, 44];
const lineMeasureCache = new Map();

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const arialBoldFontPath = path.resolve(
  String(args["font-file"] || DEFAULT_ARIAL_BOLD_FONT_PATH),
);

if (!existsSync(arialBoldFontPath)) {
  throw new Error(`Arial Bold font was not found: ${arialBoldFontPath}`);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase credentials are unavailable.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from("wall_text_creatives")
  .select("id,status,text_content,layout")
  .eq("status", "preview_ready")
  .order("created_at", { ascending: false })
  .limit(1_000);

if (error) {
  throw new Error(`Could not load Wall-of-text creatives: ${error.message}`);
}

const rows = (data ?? []).flatMap((row) => {
  const candidate = getSimulationCandidate(row);
  return candidate ? [candidate] : [];
});

const results = [];
for (const row of rows) {
  const current = await reflowForTypography({
    family: "inter",
    maximumHeight: row.maximumHeight,
    maximumWidth: row.maximumWidth,
    text: row.sourceText,
  });
  const proposed = await reflowForTypography({
    family: "arial-bold",
    maximumHeight: row.maximumHeight,
    maximumWidth: row.maximumWidth,
    text: row.sourceText,
  });

  results.push({
    current,
    id: row.id,
    maximumWidth: row.maximumWidth,
    proposed,
  });
}

const currentSuccessful = results.filter((result) => result.current !== null);
const currentRejected = results.filter((result) => result.current === null);
const proposedSuccessful = results.filter((result) => result.proposed !== null);
const proposedRejected = results.filter((result) => result.proposed === null);
const changed = results.filter((result) => {
  if (!result.current || !result.proposed) return false;
  return (
    result.proposed.fontSize !== result.current.fontSize ||
    result.proposed.lines.join("|") !== result.current.lines.join("|")
  );
});
const fontSizeDrops = results.filter(
  (result) =>
    result.current &&
    result.proposed &&
    result.proposed.fontSize < result.current.fontSize,
);
const currentUtilization = currentSuccessful.map(
  (result) => Math.max(...result.current.widths) / result.maximumWidth,
);
const proposedUtilization = proposedSuccessful.map(
  (result) =>
    Math.max(...result.proposed.widths) / result.maximumWidth,
);

const report = {
      simulatedAt: new Date().toISOString(),
      corpus: {
        fetchedPreviewReadyRows: data?.length ?? 0,
        simulatedRows: results.length,
      },
      current: {
        font: "Inter Regular",
        fontWeight: 400,
        fitCount: currentSuccessful.length,
        rejectedCount: currentRejected.length,
        fontSizeDistribution: distribution(
          currentSuccessful.map((result) => result.current.fontSize),
        ),
        maximumLineUtilizationPercent: summarizePercentages(currentUtilization),
      },
      proposed: {
        font: "Arial Bold",
        fontWeight: 500,
        fitCount: proposedSuccessful.length,
        rejectedCount: proposedRejected.length,
        fontSizeDistribution: distribution(
          proposedSuccessful.map((result) => result.proposed.fontSize),
        ),
        maximumLineUtilizationPercent: summarizePercentages(proposedUtilization),
        changedLayoutCount: changed.length,
        fontSizeReductionCount: fontSizeDrops.length,
      },
      comparison: {
        newlyRejectedCreativeIds: proposedRejected
          .filter((result) => result.current !== null)
          .map((result) => result.id),
      },
    };
const reportDirectory = path.resolve(".tmp/wall-text-typography-simulation");
const reportPath = path.join(reportDirectory, "latest.json");
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ report, reportPath }, null, 2));

function getSimulationCandidate(row) {
  const textContent = row.text_content;
  const finalLayout = textContent?.finalLayout;
  const textBox = finalLayout?.textBox ?? row.layout?.textBox;
  const sourceText =
    textContent?.sourceContent?.kind === "text"
      ? textContent.sourceContent.text
      : textContent?.fullText;
  const currentLines = Array.isArray(finalLayout?.blocks)
    ? finalLayout.blocks.flatMap((block) =>
        Array.isArray(block?.lines) ? block.lines : [],
      )
    : [];
  const currentFontSize = Number(finalLayout?.fontSizePx);

  if (
    typeof sourceText !== "string" ||
    !sourceText.trim() ||
    !textBox ||
    !Number.isFinite(Number(textBox.width)) ||
    !Number.isFinite(Number(textBox.height)) ||
    currentLines.length === 0 ||
    !Number.isFinite(currentFontSize)
  ) {
    return null;
  }

  return {
    currentFontSize,
    currentLines: currentLines.map(String),
    id: row.id,
    maximumHeight: Math.round(Number(textBox.height) * VIDEO_HEIGHT),
    maximumWidth:
      Math.round(Number(textBox.width) * VIDEO_WIDTH) - INLINE_PADDING * 2,
    sourceText: sourceText.replace(/\s+/gu, " ").trim(),
  };
}

async function reflowForTypography(params) {
  const words = params.text.split(/\s+/u).filter(Boolean);
  const idealLineCount = clamp(Math.round(words.length / 4.5), 5, 8);
  const lineCounts = [
    ...new Set([
      idealLineCount,
      idealLineCount - 1,
      idealLineCount + 1,
      5,
      6,
      7,
      8,
    ]),
  ].filter(
    (lineCount) =>
      lineCount >= 5 && lineCount <= 8 && words.length >= lineCount * 2,
  );

  for (const lineCount of lineCounts) {
    for (const fontSize of FONT_SIZES) {
      const partition = await partitionMeasuredLines({
        family: params.family,
        fontSize,
        lineCount,
        maximumWidth: params.maximumWidth,
        words,
      });
      if (!partition) continue;

      const height = partition.lines.length * fontSize * 1.1;
      if (height <= params.maximumHeight) {
        return { ...partition, fontSize, height };
      }
    }
  }

  return null;
}

async function partitionMeasuredLines(params) {
  const widthCache = new Map();
  const memo = new Map();

  const measure = async (start, end) => {
    const key = `${start}:${end}`;
    const cached = widthCache.get(key);
    if (cached !== undefined) return cached;
    const width =
      (await measureLine({
        family: params.family,
        line: params.words.slice(start, end).join(" "),
        size: params.fontSize,
      })) +
      OUTLINE_WIDTH * 2;
    widthCache.set(key, width);
    return width;
  };

  const solve = async (start, remaining) => {
    const key = `${start}:${remaining}`;
    if (memo.has(key)) return memo.get(key);
    if (params.words.length - start < remaining) return null;

    if (remaining === 1) {
      const width = await measure(start, params.words.length);
      const result =
        width >= params.maximumWidth
          ? null
          : {
              lines: [params.words.slice(start).join(" ")],
              score: Math.pow(width / params.maximumWidth - 0.72, 2) * 0.35,
            };
      memo.set(key, result);
      return result;
    }

    let best = null;
    const maximumEnd = params.words.length - (remaining - 1);
    for (let end = start + 1; end <= maximumEnd; end += 1) {
      const width = await measure(start, end);
      if (width >= params.maximumWidth) break;

      const rest = await solve(end, remaining - 1);
      if (!rest) continue;

      const fill = width / params.maximumWidth;
      const unsafeBreak = endsWithLayoutBreakWord(params.words[end - 1])
        ? 0.45
        : 0;
      const score = Math.pow(fill - 0.86, 2) + unsafeBreak + rest.score;
      if (!best || score < best.score) {
        best = {
          lines: [params.words.slice(start, end).join(" "), ...rest.lines],
          score,
        };
      }
    }

    memo.set(key, best);
    return best;
  };

  const result = await solve(0, params.lineCount);
  if (!result) return null;

  const widths = await Promise.all(
    result.lines.map(async (line) =>
      (await measureLine({
        family: params.family,
        line,
        size: params.fontSize,
      })) +
      OUTLINE_WIDTH * 2,
    ),
  );
  const internalWidths = widths.slice(0, -1);
  const widestInternalWidth = Math.max(...internalWidths, 0);
  if (internalWidths.some((width) => width < widestInternalWidth * 0.55)) {
    return null;
  }

  return { ...result, widths };
}

async function measureLine({ family, line, size }) {
  const cacheKey = `${family}:${size}:${line}`;
  const cached = lineMeasureCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const font =
    family === "inter"
      ? { file: INTER_FONT_PATH, name: "Inter Regular" }
      : { file: arialBoldFontPath, name: "Arial Bold" };
  const metadata = await sharp({
    text: {
      dpi: 72,
      font: `${font.name} ${size}`,
      fontfile: font.file,
      rgba: true,
      text: escapePangoMarkup(line),
      wrap: "none",
    },
  }).metadata();
  const width = metadata.width ?? 0;
  if (!width) throw new Error(`Could not measure Wall text: "${line}"`);
  lineMeasureCache.set(cacheKey, width);
  return width;
}

function endsWithLayoutBreakWord(value) {
  return new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "from",
    "if",
    "in",
    "of",
    "on",
    "or",
    "so",
    "than",
    "that",
    "the",
    "to",
    "with",
  ]).has(value.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, ""));
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function distribution(values) {
  return Object.fromEntries(
    [...new Set(values)]
      .sort((left, right) => left - right)
      .map((value) => [value, values.filter((entry) => entry === value).length]),
  );
}

function summarizePercentages(values) {
  if (values.length === 0) {
    return { average: null, highest: null };
  }

  return {
    average: Number(
      ((values.reduce((total, value) => total + value, 0) / values.length) * 100).toFixed(1),
    ),
    highest: Number((Math.max(...values) * 100).toFixed(1)),
  };
}

function escapePangoMarkup(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match || process.env[match[1]]) continue;
    const raw = match[2].trim();
    process.env[match[1]] =
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      throw new Error(`Unexpected argument: ${value}`);
    }
    const name = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[name] = true;
      continue;
    }
    parsed[name] = next;
    index += 1;
  }
  return parsed;
}
