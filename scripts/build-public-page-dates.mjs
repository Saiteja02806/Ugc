import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const paths = JSON.parse(fs.readFileSync(path.join(root, "lib/marketing/public-page-paths.json"), "utf8"));
const dates = {};

function sourceFile(pagePath) {
  const candidates = pagePath === "/"
    ? ["app/page.tsx", "app/page.ts"]
    : [`app${pagePath}/page.tsx`, `app${pagePath}/route.ts`, `app${pagePath}.tsx`];
  return candidates.find((candidate) => fs.existsSync(path.join(root, candidate))) ?? candidates[0];
}

for (const pagePath of paths) {
  const file = sourceFile(pagePath);
  const absolute = path.join(root, file);
  let iso = "";
  if (fs.existsSync(absolute)) {
    const source = fs.readFileSync(absolute, "utf8");
    const published = source.match(/const datePublished = "(\d{4}-\d{2}-\d{2})"/);
    if (published) iso = published[1];
  }
  if (!iso && fs.existsSync(absolute)) {
    try {
      iso = execSync(`git log -1 --format=%cs -- ${file}`, { cwd: root, encoding: "utf8" }).trim();
    } catch {
      iso = "";
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error(`No publish date or git date for ${pagePath} (${file})`);
  }
  dates[pagePath] = iso;
}

const out = path.join(root, "lib/marketing/public-page-dates.json");
fs.writeFileSync(out, `${JSON.stringify(dates, null, 2)}\n`);
console.log(`Wrote ${Object.keys(dates).length} dates to ${path.relative(root, out)}`);
