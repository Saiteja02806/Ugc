import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "components/analytics/instagram-analytics-workspace.tsx",
  "components/generation/reference-image-attachment.tsx",
  "components/layout/app-shell.tsx",
  "components/layout/app-sidebar.tsx",
  "components/trending/trending-mode-selector.tsx",
  "components/trending/trending-workspace.tsx",
  "components/video/video-generation-workspace.tsx",
  "components/workspace/ugc-chat-workspace.tsx",
];

const replacements = [
  ["bg-[#191919]/95", "bg-sidebar/95"],
  ["hover:bg-[#EA7654]", "hover:bg-primary-hover"],
  ["bg-[#2A2020]", "bg-error/10"],
  ["bg-[#1F1F1F]", "bg-background"],
  ["bg-[#191919]", "bg-sidebar"],
  ["bg-[#F5F3F0]", "bg-foreground"],
  ["bg-[#292929]", "bg-card"],
  ["bg-[#242424]", "bg-card-muted"],
  ["bg-[#303030]", "bg-surface-subtle"],
  ["bg-[#E16540]", "bg-primary"],
  ["bg-[#3A2721]", "bg-selected"],
  ["bg-[#494949]", "bg-border-strong"],
  ["bg-[#E15A5A]", "bg-error"],
  ["text-[#1F1F1F]", "text-primary-foreground"],
  ["text-[#F5F3F0]", "text-foreground"],
  ["text-[#B9B5AF]", "text-muted"],
  ["text-[#8D8984]", "text-muted-subtle"],
  ["text-[#686662]", "text-muted-subtle"],
  ["text-[#E16540]", "text-primary"],
  ["text-[#E15A5A]", "text-error"],
  ["text-[#46B879]", "text-success"],
  ["border-[#383838]", "border-border"],
  ["border-[#744231]", "border-primary/50"],
  ["border-[#E15A5A]", "border-error"],
  ["ring-offset-[#1F1F1F]", "ring-offset-background"],
  ["ring-offset-[#191919]", "ring-offset-sidebar"],
  ["ring-offset-[#292929]", "ring-offset-card"],
  ["ring-[#383838]", "ring-border"],
  ["ring-[#E16540]", "ring-focus"],
  ["ring-[#E15A5A]", "ring-error"],
];

let replacementCount = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let updated = original;

  for (const [from, to] of replacements) {
    const occurrences = updated.split(from).length - 1;
    if (occurrences > 0) {
      replacementCount += occurrences;
      updated = updated.split(from).join(to);
    }
  }

  if (updated !== original) {
    writeFileSync(file, updated, "utf8");
  }
}

if (replacementCount !== 127) {
  throw new Error(
    `Expected to restore 127 theme-token class references, restored ${replacementCount}.`,
  );
}

console.log(`Restored ${replacementCount} theme-token class references.`);
