/** Call only under the workflow's Web Lock, after matching a confirmed receipt.
 * Preserve recovery evidence before opening a fresh, explicit scheduling intent.
 * Unconfirmed requests must never use this path.
 */
export function archiveConfirmedSchedule(
  storage: Pick<Storage, "setItem" | "removeItem">,
  key: string,
  requestId: string,
  receipt: unknown,
) {
  storage.setItem(`${key}:confirmed:${encodeURIComponent(requestId)}`, JSON.stringify(receipt));
  storage.removeItem(key);
}
