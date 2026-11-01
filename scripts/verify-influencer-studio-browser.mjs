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

const outDir = path.resolve(".tmp/influencer-studio-verification");
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log("Launching browser to verify Influencer Studio...");
  const tempUserDataDir = path.join(process.env.TEMP || "C:\\temp", "pw-temp-profile-" + Date.now());
  const context = await playwright.chromium.launchPersistentContext(tempUserDataDir, {
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    viewport: { width: 1440, height: 900 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const page = context.pages()[0] || (await context.newPage());

  console.log("Navigating to http://127.0.0.1:3000/explore/build-character?preview=1 ...");
  await page.goto("http://127.0.0.1:3000/explore/build-character?preview=1", {
    waitUntil: "commit",
    timeout: 90000,
  });
  console.log("Navigation committed. Waiting for customizer dock...");
  await page.waitForSelector("[class*='customizerDock']", { timeout: 90000 });

  console.log("Page loaded. Verifying elements...");

  // 1. Verify Left Dock & 14 categories
  const dock = await page.$("[class*='customizerDock']");
  console.log("Dock found:", Boolean(dock));

  // Screenshot 1: Initial state (Active selection cards + Fan deck on canvas)
  await page.screenshot({ path: path.join(outDir, "01-initial-studio-state.png") });
  console.log("Captured 01-initial-studio-state.png");

  // 2. Check Active Selection Card (App Primary Orange + Gradient + Label)
  const selectedCard = await page.$("[class*='traitCardSelected']");
  if (selectedCard) {
    const borderColor = await selectedCard.evaluate(
      (el) => window.getComputedStyle(el).borderColor
    );
    console.log("Selected card border color (should be app primary orange):", borderColor);

    const labelEl = await selectedCard.$("[class*='cardSelectedText']");
    const labelText = labelEl ? await labelEl.evaluate((el) => el.textContent.trim()) : "none";
    console.log("Selected card label (should be Average):", labelText);
  }

  // 3. Verify Top Upload Banner exists
  const topUploadBanner = await page.$("[class*='topUploadBanner']");
  console.log("Top Upload Banner found:", Boolean(topUploadBanner));
  if (topUploadBanner) {
    const bannerTitle = await topUploadBanner.$eval(
      "[class*='topUploadTitle']",
      (el) => el.textContent
    );
    console.log("Top Upload Banner title:", bannerTitle);
    const optionalBadge = await topUploadBanner.$eval(
      "[class*='topUploadOptionalBadge']",
      (el) => el.textContent
    );
    console.log("Top Upload Banner optional badge:", optionalBadge);
  }

  // 4. Verify Character Type cards: only the selected card (Average) shows a tag, no white pills
  const charTypeButtons = await page.$$("button[title='Average'], button[title='Bold'], button[title='Extreme']");
  console.log("Found Character Type preset cards:", charTypeButtons.length);

  // 5. Verify Generate button has no stars
  const generateBtn = await page.$("button[class*='generateButton']");
  if (generateBtn) {
    const btnText = await generateBtn.evaluate((el) => el.textContent.trim());
    console.log("Generate button text (no stars):", btnText);
    const hasStarSvg = await generateBtn.$("svg");
    console.log("Generate button has star svg:", Boolean(hasStarSvg));
  }

  // 6. Capture close-up of Top Upload Banner and Character Type Section
  const topBannerEl = await page.$("[class*='topUploadBanner']");
  if (topBannerEl) {
    await topBannerEl.screenshot({ path: path.join(outDir, "02-top-upload-banner.png") });
    console.log("Captured 02-top-upload-banner.png");
  }

  const charTypeBtn = await page.$("button:has-text('Character Type')");
  if (charTypeBtn) {
    const charTypeSection = await charTypeBtn.evaluateHandle((el) =>
      el.closest("[class*='accordionSection']")
    );
    if (charTypeSection) {
      await charTypeSection
        .asElement()
        .screenshot({ path: path.join(outDir, "02-character-type-upload-section.png") });
      console.log("Captured 02-character-type-upload-section.png");
    }
  }

  // 3. Check Picked settings pills & Reset All
  const pillsBefore = await page.$$eval("[class*='pickedPill']", (els) =>
    els.map((e) => e.textContent.trim())
  );
  console.log("Initial picked pills count:", pillsBefore.length);
  console.log("Sample pills:", pillsBefore.slice(0, 5));

  // 4. Click the Dice (Randomize / Shuffle) Button
  console.log("Clicking the 🎲 Dice button...");
  const diceBtn = await page.$("button[title*='Randomize']");
  if (diceBtn) {
    await diceBtn.evaluate((el) => el.click());
    await page.waitForTimeout(500);

    const pillsAfterDice = await page.$$eval("[class*='pickedPill']", (els) =>
      els.map((e) => e.textContent.trim())
    );
    console.log("Pills after 🎲 Dice shuffle:", pillsAfterDice.slice(0, 5));

    await page.screenshot({ path: path.join(outDir, "02-after-dice-randomize.png") });
    console.log("Captured 02-after-dice-randomize.png");
  }

  // 5. Test Reset All
  console.log("Testing Reset All...");
  const resetBtn = await page.$("button:has-text('Reset all')");
  if (resetBtn) {
    await resetBtn.evaluate((el) => el.click());
    await page.waitForTimeout(300);

    const pillsAfterReset = await page.$$eval("[class*='pickedPill']", (els) =>
      els.map((e) => e.textContent.trim())
    );
    console.log("Pills after Reset All:", pillsAfterReset.slice(0, 5));
  }

  // 6. Test Card Selection (Click on another card, e.g. Indian)
  console.log("Testing individual card click (e.g. Indian ethnicity)...");
  const indianCard = await page.$("button[title*='Indian']");
  if (indianCard) {
    await indianCard.evaluate((el) => el.click());
    await page.waitForTimeout(300);

    const updatedPills = await page.$$eval("[class*='pickedPill']", (els) =>
      els.map((e) => e.textContent.trim())
    );
    console.log("Pills after clicking Indian:", updatedPills.slice(0, 5));

    await page.screenshot({ path: path.join(outDir, "03-card-selected-indian.png") });
    console.log("Captured 03-card-selected-indian.png");
  }

  // 7. Scroll through Left Dock & capture scrolled view
  const scrollContainer = await page.$("[class*='accordionScroll']");
  if (scrollContainer) {
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 500;
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, "04-dock-scrolled.png") });
    console.log("Captured 04-dock-scrolled.png");
    
    // Scroll back to top
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);
  }

  // 8. Capture close-up of Ethnicity category matching the user's screenshot
  const ethnicityBtn = await page.$("button:has-text('Ethnicity')");
  if (ethnicityBtn) {
    const parentSection = await ethnicityBtn.evaluateHandle((el) => el.closest("[class*='accordionSection']"));
    if (parentSection) {
      await parentSection.asElement().screenshot({ path: path.join(outDir, "05-ethnicity-section-closeup.png") });
      console.log("Captured 05-ethnicity-section-closeup.png");
    }
  }

  // 9. Capture close-up of Bottom Action Bar (Generate button without stars, Dice, Batch size)
  const bottomDock = await page.$("[class*='dockBottomAction']");
  if (bottomDock) {
    await bottomDock.screenshot({ path: path.join(outDir, "06-dock-bottom-generate-button.png") });
    console.log("Captured 06-dock-bottom-generate-button.png");
  }

  await context.close();
  console.log("All browser verifications finished successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
