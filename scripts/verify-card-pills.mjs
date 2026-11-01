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
  console.log("Launching browser to verify Normal Wall without black background...");
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
  console.log("Waiting for customizer dock...");
  await page.waitForSelector("[class*='customizerDock']", { timeout: 90000 });
  await page.waitForTimeout(3000);

  const sections = await page.$$("[class*='accordionSection']");
  if (sections.length > 1) {
    const bgCards = await sections[1].$$("[class*='traitCard']");
    console.log(`Found ${bgCards.length} background cards.`);
    if (bgCards.length >= 5) {
      console.log("Clicking 5th background card ('Normal Wall')...");
      await bgCards[4].click();
      await page.waitForTimeout(1000);

      // Capture close-up of Section 1 with Normal Wall selected
      await sections[1].screenshot({ path: path.join(artifactDir, "23-normal-wall-no-blackness.png") });
      console.log("Captured 23-normal-wall-no-blackness.png");
    }
  }

  // Also take full dock screenshot
  const dock = await page.$("[class*='customizerDock']");
  if (dock) {
    await dock.screenshot({ path: path.join(artifactDir, "24-full-dock-normal-wall.png") });
    console.log("Captured 24-full-dock-normal-wall.png");
  }

  await browser.close();
  console.log("All done!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
