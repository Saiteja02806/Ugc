/**
 * Worker mirror of the approved Hook inline-symbol contract. It intentionally
 * maps the two legacy Unicode characters to named symbols before SVG output,
 * so the Linux worker never needs an emoji font.
 */
export const HOOK_INLINE_SYMBOLS = ["cross", "check"] as const;

export type HookInlineSymbol = (typeof HOOK_INLINE_SYMBOLS)[number];

export type HookInlineToken =
  | { kind: "text"; value: string }
  | { kind: "symbol"; name: HookInlineSymbol }
  | { kind: "unsupported"; value: string };

const SYMBOL_BY_CHARACTER: Record<string, HookInlineSymbol> = {
  "❌": "cross",
  "✅": "check",
};

const APPROVED_SYMBOL_CHARACTERS = new Set(
  Object.keys(SYMBOL_BY_CHARACTER),
);

export function tokenizeHookInlineSymbols(value: string): HookInlineToken[] {
  const tokens: HookInlineToken[] = [];
  let text = "";

  const flushText = () => {
    if (text) {
      tokens.push({ kind: "text", value: text });
      text = "";
    }
  };

  for (const character of Array.from(value)) {
    const symbol = SYMBOL_BY_CHARACTER[character];

    if (symbol) {
      flushText();
      tokens.push({ kind: "symbol", name: symbol });
      continue;
    }

    if (/\p{Extended_Pictographic}/u.test(character)) {
      flushText();
      tokens.push({ kind: "unsupported", value: character });
      continue;
    }

    text += character;
  }

  flushText();
  return tokens;
}

export function hasHookInlineSymbols(value: string) {
  return tokenizeHookInlineSymbols(value).some(
    (token) => token.kind === "symbol" || token.kind === "unsupported",
  );
}

export function getHookInlineSymbolNames(value: string) {
  return tokenizeHookInlineSymbols(value).flatMap((token) =>
    token.kind === "symbol" ? [token.name] : [],
  );
}

export function hasUnsupportedHookEmoji(value: string) {
  return Array.from(value).some(
    (character) =>
      /\p{Extended_Pictographic}/u.test(character) &&
      !APPROVED_SYMBOL_CHARACTERS.has(character),
  );
}

/**
 * The geometry matches Lucide's CircleCheck and CircleX source icons. Keeping
 * these paths bundled lets Sharp render the same real icon asset as the React
 * preview without an OS-provided emoji font.
 */
export function buildHookInlineSymbolSvg(params: {
  name: HookInlineSymbol;
  size: number;
  x: number;
  y: number;
}) {
  const color = params.name === "check" ? "#86efac" : "#fda4af";
  const strokeWidth = Math.max(1.8, params.size * 0.115);
  const scale = params.size / 24;
  const common = [
    'fill="none"',
    `stroke="${color}"`,
    `stroke-width="${strokeWidth}"`,
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
  ].join(" ");
  const shape =
    params.name === "check"
      ? '<circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />'
      : '<circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />';

  return `<g data-hook-inline-symbol="${params.name}" transform="translate(${params.x} ${params.y}) scale(${scale})" ${common}>${shape}</g>`;
}
