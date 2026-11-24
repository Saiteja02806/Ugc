export const hookPatterns = [
  { id: "situation", label: "Situation" },
  { id: "contrast", label: "Contrast" },
  { id: "demo", label: "Show the action" },
  { id: "question", label: "Question" },
] as const;

export type HookPatternId = (typeof hookPatterns)[number]["id"];

const maxLength = 120;

export function cleanHookField(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function generateHookLines(input: { task: string; product: string; pattern: string }): { lines: string[]; error: string | null } {
  const task = cleanHookField(input.task);
  const product = cleanHookField(input.product);
  const pattern = hookPatterns.some((item) => item.id === input.pattern) ? input.pattern as HookPatternId : null;
  if (!task) return { lines: [], error: "Describe the task the app helps with." };
  if (!pattern) return { lines: [], error: "Choose a hook pattern." };
  const subject = product || "the app";
  const lines = templates[pattern](subject, task);
  return { lines, error: null };
}

const templates: Record<HookPatternId, (product: string, task: string) => string[]> = {
  situation: (product, task) => [
    `I opened ${product} to ${task}, and the first screen was the step I actually needed.`,
    `Halfway through trying to ${task}, I stopped switching apps and finished it in ${product}.`,
    `The moment I had to ${task} again, I started in ${product} instead of my notes.`,
  ],
  contrast: (product, task) => [
    `I used to ${task} in three different places. ${product} keeps that step in one screen.`,
    `Before ${product}, ${task} meant starting over. This time the last step was still there.`,
    `The old way to ${task} was a checklist. In ${product} the next action is already on screen.`,
  ],
  demo: (product, task) => [
    `Watch the screen: this is the exact tap I use in ${product} when I need to ${task}.`,
    `Here is ${product} doing one job, ${task}, from the first tap to the result.`,
    `No intro. This is the screen in ${product} that I open to ${task}.`,
  ],
  question: (product, task) => [
    `Do you still ${task} outside the app? This is the screen in ${product} I use instead.`,
    `What if ${task} started on the screen you already have open in ${product}?`,
    `Which step of ${task} do you keep redoing? ${product} keeps that step in front of me.`,
  ],
};
