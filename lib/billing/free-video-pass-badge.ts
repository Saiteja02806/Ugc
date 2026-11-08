export function freeVideoPassShowsRemainingGeneration(
  pass: { available?: boolean; status?: string | null } | null | undefined,
  isActive?: boolean,
): boolean {
  if (isActive) return false;
  if (!pass) return false;
  if (
    pass.status === "used" ||
    pass.status === "revoked" ||
    pass.status === "unclaimed"
  ) {
    return false;
  }
  if (pass.status === "available" || pass.status === "reserved") return true;
  return pass.available === true;
}
