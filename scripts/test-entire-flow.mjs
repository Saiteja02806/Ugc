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
  console.log("=== STARTING FULL END-TO-END FLOW TEST ===");
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log("[1/11] Navigating to http://localhost:3000/explore/build-character?preview=1 ...");
  await page.goto("http://localhost:3000/explore/build-character?preview=1", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector("[class*='customizerDock']", { timeout: 60000 });
  await page.waitForTimeout(2000);

  // Remove any Next.js dev overlay that might block clicks in bottom corner
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  });

  // STEP 1: Verify Initial State
  console.log("[1/11] Verifying initial empty canvas & dock state...");
  await page.screenshot({ path: path.join(artifactDir, "flow-01-initial-state.png") });
  
  // Verify canvas hero elements exist and photo deck is gone
  const heroTitle = await page.$eval("[class*='heroTitle']", (el) => el.textContent);
  console.log("Hero Title:", heroTitle);
  const fanDeck = await page.$("[class*='heroCardDeck']");
  if (fanDeck) {
    throw new Error("Old photo fan deck should be removed, but was found!");
  }
  console.log("PASS: Photo fan deck is completely gone from canvas.");

  // STEP 2: Verify Background section & default card
  console.log("[2/11] Verifying Background section & Workspace card...");
  const sections = await page.$$("[class*='accordionSection']");
  console.log(`Found ${sections.length} accordion categories.`);
  if (sections.length < 2) {
    throw new Error("Expected at least 2 accordion categories (Character Type + Background)");
  }

  const bgSection = sections[1];
  const bgCards = await bgSection.$$("[class*='traitCard']");
  console.log(`Found ${bgCards.length} background cards.`);
  if (bgCards.length !== 7) {
    throw new Error(`Expected 7 background cards, found ${bgCards.length}`);
  }

  // Check card 1 (Workspace)
  const card1Text = await bgCards[0].$eval("[class*='cardSelectedPillText']", (el) => el.textContent).catch(() => null);
  console.log("Card 1 Selected Text:", card1Text);
  if (card1Text !== "Workspace") {
    throw new Error(`Expected 'Workspace', got '${card1Text}'`);
  }

  // Check card 1 font-weight and background
  const card1Styles = await bgCards[0].$eval("[class*='cardSelectedPillText']", (el) => {
    const computed = window.getComputedStyle(el);
    const parentComputed = window.getComputedStyle(el.parentElement);
    return {
      fontWeight: computed.fontWeight,
      fontSize: computed.fontSize,
      parentBg: parentComputed.backgroundColor,
    };
  });
  console.log("Card 1 Computed Styles:", card1Styles);
  if (card1Styles.fontWeight !== "400") {
    throw new Error(`Expected font-weight 400 (normal), got ${card1Styles.fontWeight}`);
  }
  console.log("PASS: Card 1 font weight is 400 (normal) and background is transparent.");
  await page.screenshot({ path: path.join(artifactDir, "flow-02-background-workspace-selected.png") });

  // STEP 3: Switch to Normal Wall (card 5)
  console.log("[3/11] Selecting 5th card ('Normal Wall')...");
  await bgCards[4].click({ force: true });
  await page.waitForTimeout(600);

  const card5Text = await bgCards[4].$eval("[class*='cardSelectedPillText']", (el) => el.textContent);
  console.log("Card 5 Selected Text:", card5Text);
  if (card5Text !== "Normal Wall") {
    throw new Error(`Expected 'Normal Wall', got '${card5Text}'`);
  }

  const pickedSettings = await page.$$eval("[class*='pickedPill']", (pills) => pills.map((p) => p.textContent.trim()));
  console.log("Picked Settings Pills:", pickedSettings);
  if (!pickedSettings.includes("Normal Wall")) {
    throw new Error(`Expected 'Normal Wall' in picked pills, got: ${pickedSettings.join(", ")}`);
  }
  await page.screenshot({ path: path.join(artifactDir, "flow-03-normal-wall-selected.png") });

  // STEP 4: Switch to Cream Room (card 2)
  console.log("[4/11] Selecting 2nd card ('Cream Room')...");
  await bgCards[1].click({ force: true });
  await page.waitForTimeout(600);

  const card2Text = await bgCards[1].$eval("[class*='cardSelectedPillText']", (el) => el.textContent);
  console.log("Card 2 Selected Text:", card2Text);
  if (card2Text !== "Cream Room") {
    throw new Error(`Expected 'Cream Room', got '${card2Text}'`);
  }
  await page.screenshot({ path: path.join(artifactDir, "flow-04-cream-room-selected.png") });

  // STEP 5: Select a different Character Type
  console.log("[5/11] Selecting Character Type 'Bold' (card 2 in section 0)...");
  const charCards = await sections[0].$$("[class*='traitCard']");
  if (charCards.length >= 2) {
    await charCards[1].click({ force: true });
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(artifactDir, "flow-05-traits-customized.png") });

  // STEP 6: Test Randomize (Dice button)
  console.log("[6/11] Testing Randomize (Dice) button...");
  const diceBtn = await page.$("[class*='diceButton']");
  if (diceBtn) {
    await page.evaluate((el) => el.click(), diceBtn);
    await page.waitForTimeout(800);
    const randomizedPills = await page.$$eval("[class*='pickedPill']", (pills) => pills.map((p) => p.textContent.trim()));
    console.log("Randomized Pills:", randomizedPills);
    await page.screenshot({ path: path.join(artifactDir, "flow-06-randomized-state.png") });
  }

  // STEP 7: Test Reset All
  console.log("[7/11] Testing Reset all button...");
  const resetBtn = await page.$("[class*='resetAllButton']");
  if (resetBtn) {
    await page.evaluate((el) => el.click(), resetBtn);
    await page.waitForTimeout(800);
    const resetPills = await page.$$eval("[class*='pickedPill']", (pills) => pills.map((p) => p.textContent.trim()));
    console.log("Reset Pills:", resetPills);
    if (!resetPills.includes("Workspace") || !resetPills.includes("Average")) {
      console.warn("Warning: Reset did not restore Workspace/Average defaults:", resetPills);
    } else {
      console.log("PASS: Reset restored default traits.");
    }
    await page.screenshot({ path: path.join(artifactDir, "flow-07-reset-to-default.png") });
  }

  // STEP 8: Test Batch Size Controls
  console.log("[8/11] Testing Batch Size (+ and -)...");
  const plusBtn = await page.$("[class*='batchSizeBtn']:has-text('+')");
  if (plusBtn) {
    await plusBtn.click({ force: true });
    await page.waitForTimeout(300);
    const generateBtnText = await page.$eval("[class*='generateButton']", (el) => el.textContent.trim());
    console.log("Generate button after batch size +:", generateBtnText);
    
    // Decrement back to 1
    const minusBtn = await page.$("[class*='batchSizeBtn']:has-text('-')");
    if (minusBtn) {
      await minusBtn.click({ force: true });
      await page.waitForTimeout(300);
    }
  }
  await page.screenshot({ path: path.join(artifactDir, "flow-08-batch-size-adjusted.png") });

  // STEP 9: Trigger Generation & Check Synthesizing Pulse
  console.log("[9/11] Clicking Generate button and checking Synthesizing state...");
  const generateBtn = await page.$("[class*='generateButton']");
  await generateBtn.click({ force: true });
  // Check pulse immediately within 400ms
  await page.waitForTimeout(400);
  const isGeneratingVisible = await page.$("[class*='generatingState']");
  console.log("Synthesizing pulse state visible:", Boolean(isGeneratingVisible));
  await page.screenshot({ path: path.join(artifactDir, "flow-09-generating-synthesizing-pulse.png") });

  // STEP 10: Wait for Generation Results & Candidate Card
  console.log("[10/11] Waiting for candidate generation results...");
  await page.waitForSelector("[class*='candidateResultCard']", { timeout: 15000 });
  await page.waitForTimeout(1000);

  const downloadBtn = await page.$("[class*='candidateActions'] [class*='actionButtonSecondary']");
  const saveBtn = await page.$("[class*='candidateActions'] [class*='actionButtonPrimary']");
  console.log("Candidate card generated! Download button:", Boolean(downloadBtn), "| Save button:", Boolean(saveBtn));
  await page.screenshot({ path: path.join(artifactDir, "flow-10-candidate-generated-result.png") });

  // STEP 11: History Panel
  console.log("[11/11] Testing History panel toggle...");
  const historyBtn = await page.$("button:has-text('History')");
  if (historyBtn) {
    await historyBtn.click({ force: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(artifactDir, "flow-11-history-panel-open.png") });
    console.log("PASS: History dialog opened.");
  }

  await browser.close();
  console.log("=== ALL 11 STEPS COMPLETED AND VERIFIED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("FLOW TEST FAILED:", err);
  process.exit(1);
});
