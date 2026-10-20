export const TRY_UGCPILOT_BROWSER_SESSION_KEY = "ugcpilot.try-demo.session.v1";

const SESSION_VERSION = 1;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CARDS = 120;
const MAX_RECENT_HOOKS = 32;

export type TryUgcPilotWallOfTextPost = {
  id: string;
  topic: string;
  hook: string;
  wallOfText: string;
};

export type TryUgcPilotBusinessContext = {
  brand: string;
  url: string;
  title: string;
  description: string;
  markdown: string;
};

export type TryUgcPilotBrowserSession = {
  savedAt: number;
  url: string;
  cards: TryUgcPilotWallOfTextPost[];
  businessContext: TryUgcPilotBusinessContext | null;
  nextPostNumber: number;
  recentHooks: string[];
  swipedCount: number;
  generatedCount: number;
  postedCount: number;
  skippedCount: number;
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function readWholeNumber(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000
    ? value
    : null;
}

function readTimestamp(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function readPost(value: unknown): TryUgcPilotWallOfTextPost | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id, 200);
  const topic = readString(value.topic, 400);
  const hook = readString(value.hook, 800);
  const wallOfText = readString(value.wallOfText, 8_000);

  return id !== null && topic !== null && hook !== null && wallOfText !== null
    ? { id, topic, hook, wallOfText }
    : null;
}

function readBusinessContext(value: unknown): TryUgcPilotBusinessContext | null {
  if (!isRecord(value)) return null;

  const brand = readString(value.brand, 400);
  const url = readString(value.url, 2_048);
  const title = readString(value.title, 1_000);
  const description = readString(value.description, 8_000);
  const markdown = readString(value.markdown, 100_000);

  return brand !== null && url !== null && title !== null && description !== null && markdown !== null
    ? { brand, url, title, description, markdown }
    : null;
}

/**
 * Parses only the small, non-sensitive Try demo workspace snapshot. Invalid,
 * expired, or future-schema data is ignored rather than rendered.
 */
export function parseTryUgcPilotBrowserSession(
  raw: string | null,
  now = Date.now(),
): TryUgcPilotBrowserSession | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SESSION_VERSION) return null;

    const savedAt = readTimestamp(parsed.savedAt);
    const url = readString(parsed.url, 2_048);
    const nextPostNumber = readWholeNumber(parsed.nextPostNumber);
    const swipedCount = readWholeNumber(parsed.swipedCount);
    const generatedCount = readWholeNumber(parsed.generatedCount);
    const postedCount = readWholeNumber(parsed.postedCount);
    const skippedCount = readWholeNumber(parsed.skippedCount);
    const notice = readString(parsed.notice, 600);

    if (
      savedAt === null ||
      savedAt < now - SESSION_MAX_AGE_MS ||
      savedAt > now + 5 * 60 * 1000 ||
      url === null ||
      nextPostNumber === null ||
      swipedCount === null ||
      generatedCount === null ||
      postedCount === null ||
      skippedCount === null ||
      notice === null ||
      !Array.isArray(parsed.cards) ||
      parsed.cards.length > MAX_CARDS ||
      !Array.isArray(parsed.recentHooks) ||
      parsed.recentHooks.length > MAX_RECENT_HOOKS
    ) {
      return null;
    }

    const cards = parsed.cards.map(readPost);
    const recentHooks = parsed.recentHooks.map((hook) => readString(hook, 800));
    const businessContext = parsed.businessContext === null
      ? null
      : readBusinessContext(parsed.businessContext);

    if (
      cards.some((card) => card === null) ||
      recentHooks.some((hook) => hook === null) ||
      (parsed.businessContext !== null && businessContext === null)
    ) {
      return null;
    }

    return {
      savedAt,
      url,
      cards: cards as TryUgcPilotWallOfTextPost[],
      businessContext,
      nextPostNumber,
      recentHooks: recentHooks as string[],
      swipedCount,
      generatedCount,
      postedCount,
      skippedCount,
      notice,
    };
  } catch {
    return null;
  }
}

export function serializeTryUgcPilotBrowserSession(
  session: Omit<TryUgcPilotBrowserSession, "savedAt">,
  now = Date.now(),
) {
  return JSON.stringify({ version: SESSION_VERSION, savedAt: now, ...session });
}
