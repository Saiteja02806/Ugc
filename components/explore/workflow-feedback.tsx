import type { ReactNode } from "react";

/** Keep workflow feedback in its own section and out of the results overlay. */
export function WorkflowFeedback({ id, children, active = true }: { id: string; children: ReactNode; active?: boolean }) {
  return <div id={id} hidden={!active}>{children}</div>;
}
