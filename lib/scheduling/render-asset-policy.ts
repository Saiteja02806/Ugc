export function hasMeaningfulDraftEdits(value: unknown) {
  const draft = getDraftRecord(value);

  if (!draft) {
    return false;
  }

  const trimStartSeconds = getNumberFromValue(draft.trimStartSeconds);
  const trimEndSeconds = getNumberFromValue(draft.trimEndSeconds);

  return (
    (trimStartSeconds ?? 0) > 0 ||
    trimEndSeconds !== null ||
    getTextOverlayCount(draft.textOverlays) > 0
  );
}

export function isOpeningRenderCurrent(params: {
  draftSources: unknown[];
  outputUpdatedAt: string;
}) {
  const editedDrafts = params.draftSources
    .map(getDraftRecord)
    .filter(
      (draft): draft is Record<string, unknown> =>
        Boolean(draft && hasMeaningfulDraftEdits(draft)),
    );

  if (editedDrafts.length === 0) {
    return true;
  }

  const outputTimestamp = getTimestamp(params.outputUpdatedAt);

  return (
    outputTimestamp !== null &&
    editedDrafts.every((draft) => {
      const draftTimestamp = getTimestamp(getString(draft.updatedAt));

      return draftTimestamp !== null && outputTimestamp >= draftTimestamp;
    })
  );
}

export function isDemoRenderCurrent(params: {
  latestRenderId: string | null;
  outputSourceRecordId: string | null;
}) {
  return Boolean(
    params.latestRenderId &&
      params.outputSourceRecordId === params.latestRenderId,
  );
}

function getDraftRecord(value: unknown) {
  const record = getRecord(value);
  const nestedDraft = getRecord(record?.draft);

  return nestedDraft ?? record;
}

function getTextOverlayCount(value: unknown) {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.filter((overlay) => {
    const record = getRecord(overlay);

    return typeof record?.text === "string" && record.text.trim().length > 0;
  }).length;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumberFromValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function getTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}
