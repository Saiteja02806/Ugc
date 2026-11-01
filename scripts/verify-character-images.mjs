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
  console.log("Launching browser to verify Backgrounds section...");
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
  console.log("Navigation committed. Waiting for customizer dock...");
  await page.waitForSelector("[class*='customizerDock']", { timeout: 90000 });
  await page.waitForTimeout(3000);

  // Take screenshot of the customizer dock with the new Backgrounds section
  await page.screenshot({ path: path.join(artifactDir, "15-studio-with-backgrounds-section.png") });
  console.log("Captured 15-studio-with-backgrounds-section.png");

  // Find the background accordion section and capture a closeup
  const sections = await page.$$("[class*='accordionSection']");
  console.log(`Found ${sections.length} accordion sections.`);
  if (sections.length > 1) {
    // Section 1 is Background (Section 0 is Character Type)
    await sections[1].screenshot({ path: path.join(artifactDir, "16-backgrounds-section-closeup.png") });
    console.log("Captured 16-backgrounds-section-closeup.png");
  }

  // Click on the second background card ("Cream Aesthetic Room")
  const bgCards = await sections[1].$$("[class*='traitCard']");
  if (bgCards.length > 1) {
    console.log("Clicking second background card...");
    await bgCards[1].click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, "17-after-background-card-selected.png") });
    console.log("Captured 17-after-background-card-selected.png");
  }

  await browser.close();
  console.log("All done!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
