/**
 * The Hook renderer treats approved visual symbols as named inline tokens
 * instead of relying on an operating-system emoji font. The raw text remains
 * available for legacy records and semantic validation, while every visual
 * surface can render the same deterministic icon.
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
      // Never send a platform-dependent missing glyph to the video or preview.
      tokens.push({ kind: "unsupported", value: character });
      continue;
    }

    text += character;
  }

  flushText();
  return tokens;
}

export function hasUnsupportedHookEmoji(value: string) {
  return Array.from(value).some(
    (character) =>
      /\p{Extended_Pictographic}/u.test(character) &&
      !APPROVED_SYMBOL_CHARACTERS.has(character),
  );
}

export function isApprovedHookSymbolCharacter(value: string) {
  return APPROVED_SYMBOL_CHARACTERS.has(value);
}
