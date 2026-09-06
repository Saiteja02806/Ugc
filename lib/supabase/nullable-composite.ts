/** PostgREST can encode a SQL NULL composite as an object of null fields. */
export function normalizeNullableComposite<T extends object>(
  value: T | null | undefined,
): T | null {
  if (value == null) return null;
  const fields = Object.values(value);
  return fields.length > 0 && fields.every((field) => field === null)
    ? null
    : value;
}
