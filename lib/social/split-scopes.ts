export function splitScopes(value: unknown): string[] {
  const values =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.filter(
            (item): item is string => typeof item === "string",
          )
        : [];

  return [
    ...new Set(
      values
        .flatMap((item) => item.split(/[\s,]+/))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
