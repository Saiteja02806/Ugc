const REFERENCE_BATCH_SIZE = 12;

/** Round a batch up so pagination never leaves an unfinished grid row. */
export function alignReferenceLimit(limit: number, columns: number) {
  const count = Math.max(1, Math.floor(columns));
  return Math.ceil(limit / count) * count;
}

export function referenceBatchSize(columns: number) {
  return alignReferenceLimit(REFERENCE_BATCH_SIZE, columns);
}
