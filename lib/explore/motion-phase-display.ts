/** Shorten generated phase markers without changing user prose or source metadata. */
export function formatGeneratedMotionPhases(text: string): string {
  const pattern = /PHASE \[(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)\]/g;
  const matches = [...text.matchAll(pattern)];
  if (!matches.length) return text;
  const boundaries = [Number(matches[0][1]), ...matches.map(match => Number(match[2]))];
  if (matches.length > 100 || boundaries[0] !== 0 || boundaries.at(-1) !== 1 ||
    matches.some((match, index) => Math.abs(Number(match[1]) - boundaries[index]) > 1e-6 || boundaries[index + 1] <= boundaries[index])) return text;
  // Reserve at least one hundredth for each remaining beat so short phases
  // remain ordered rather than becoming zero-length after rounding.
  const rounded = [0];
  for (let i = 1; i < boundaries.length - 1; i++) {
    rounded.push(Math.min(100 - (matches.length - i), Math.max(rounded[i - 1] + 1, Math.round(boundaries[i] * 100))));
  }
  rounded.push(100);
  let index = 0;
  return text.replace(pattern, () => `PHASE [${rounded[index++] / 100}–${rounded[index] / 100}]`);
}

/** Format timing labels in old prompts while leaving ordinary numbers and URLs alone. */
export function formatMotionPromptTimes(text: string): string {
  const phases = formatGeneratedMotionPhases(text);
  const number = (value: string) => String(Number(Number(value).toFixed(2)));
  return phases
    .replace(/(?<![\d./])(\d+\.\d{3,})(?=\s*(?:s\b|sec(?:ond)?s?\b|-seconds?\b))/gi, number)
    .replace(/(?<![\d./])(\d+\.\d{3,})(?=\s*[–-]\s*\d+(?:\.\d+)?\s*(?:s\b|sec(?:ond)?s?\b))/gi, number);
}
