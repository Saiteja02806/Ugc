export async function confirmToolResult(invoke, args) {
  const first = await invoke(args);
  const preview = first?.structuredContent;
  if (!first?.isError && preview?.confirmation_required === true && typeof preview.confirm_token === "string") {
    return invoke({ ...args, confirm_token: preview.confirm_token });
  }
  return first;
}
