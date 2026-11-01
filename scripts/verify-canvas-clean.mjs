import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

let playwright;
try {
  playwright = await import("playwright");
} catch {
  const p = path.join(
    process.env.USERPROFILE,
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
  );
  playwright = await import(pathToFileURL(p).href);
}

const artifactDir = "C:\\Users\\chund\\.gemini\\antigravity\\brain\\caa3838b-c9f9-4522-8b1e-be2ec74989a5";

async function run() {
  console.log("Launching browser to verify clean canvas...");
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log("Navigating to http://127.0.0.1:3000/explore/build-character?preview=1 ...");
  await page.goto("http://127.0.0.1:3000/explore/build-character?preview=1", {
    waitUntil: "commit",
    timeout: 90000,
  });
  console.log("Navigation committed. Waiting for canvas...");
  await page.waitForSelector("[class*='canvasContainer']", { timeout: 90000 });
  await page.waitForTimeout(3000);

  // Take screenshot of the entire studio viewport
  await page.screenshot({ path: path.join(artifactDir, "18-clean-canvas-no-photos.png") });
  console.log("Captured 18-clean-canvas-no-photos.png");

  // Take screenshot of just the canvas
  const canvasEl = await page.$("[class*='canvasContainer']");
  if (canvasEl) {
    await canvasEl.screenshot({ path: path.join(artifactDir, "19-canvas-closeup-clean.png") });
    console.log("Captured 19-canvas-closeup-clean.png");
  }

  await browser.close();
  console.log("Verification finished successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
