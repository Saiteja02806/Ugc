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
  console.log("=== Launching Playwright to test Generate Workflow ===");
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

  await page.waitForSelector("[class*='customizerDock']", { timeout: 30000 });
  console.log("Customizer dock loaded.");

  // 1. Verify Generate button
  const generateBtn = await page.$("button[class*='generateButton']");
  if (!generateBtn) throw new Error("Generate button not found!");
  const btnText = await generateBtn.evaluate((el) => el.textContent.trim());
  console.log("Generate button initial text:", btnText);

  // 2. Click Generate (1)
  console.log("Clicking Generate (1)...");
  await generateBtn.click();

  // 3. Check for generating pulse state
  await page.waitForTimeout(300);
  const generatingEl = await page.$("[class*='generatingState']");
  console.log("Generating synthesis pulse state visible:", Boolean(generatingEl));
  if (generatingEl) {
    const generatingText = await generatingEl.evaluate((el) => el.textContent.trim());
    console.log("Generating text:", generatingText.slice(0, 100));
    await page.screenshot({ path: path.join(outDir, "07-synthesizing-pulse-state.png") });
    console.log("Captured 07-synthesizing-pulse-state.png");
  }

  // 4. Wait for generation to complete and candidate card to render
  console.log("Waiting for candidate result card on canvas...");
  await page.waitForSelector("[class*='candidateResultCard']", { timeout: 15000 });
  console.log("Candidate result card rendered on center canvas!");

  // Capture canvas state with generated candidate
  await page.screenshot({ path: path.join(outDir, "08-generated-candidate-on-canvas.png") });
  console.log("Captured 08-generated-candidate-on-canvas.png");

  // 5. Test hover actions overlay on the generated image
  const candidateCard = await page.$("[class*='candidateResultCard']");
  if (candidateCard) {
    console.log("Hovering on generated candidate card...");
    await candidateCard.hover();
    await page.waitForTimeout(300);

    // Verify action buttons
    const saveBtn = await candidateCard.$("button:has-text('Save to My Influencers')");
    console.log("Save button found:", Boolean(saveBtn));
    const animateBtn = await candidateCard.$("a:has-text('Animate with Motion')");
    if (animateBtn) throw new Error("Animate with Motion should stay removed from the character studio.");

    await page.screenshot({ path: path.join(outDir, "09-candidate-hover-actions.png") });
    console.log("Captured 09-candidate-hover-actions.png");

    // Click "Save to My Influencers"
    if (saveBtn) {
      console.log("Clicking 'Save to My Influencers'...");
      await saveBtn.click();
      await page.waitForTimeout(300);

      const savedBtn = await candidateCard.$("button:has-text('Saved to Influencers')");
      console.log("Button updated to 'Saved to Influencers':", Boolean(savedBtn));
    }
  }

  await context.close();
  console.log("=== Generation workflow verified successfully! ===");
}

run().catch((err) => {
  console.error("Workflow verification failed:", err);
  process.exit(1);
});
