import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";

const artifactDir = "C:\\Users\\chund\\.gemini\\antigravity\\brain\\64c5c575-0c34-43ac-92ee-e54cb7891f9c";
if (!existsSync(artifactDir)) {
  mkdirSync(artifactDir, { recursive: true });
}

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browserPath = existsSync(edgePath) ? edgePath : chromePath;

console.log("Using browser at:", browserPath);

// Start Next.js dev server on port 3333
const devServer = spawn("npx", ["next", "dev", "-p", "3333"], {
  shell: true,
  stdio: "pipe",
  env: { ...process.env, NODE_ENV: "development" }
});

devServer.stdout.on("data", (data) => console.log(`[Next] ${data}`));
devServer.stderr.on("data", (data) => console.error(`[Next ERR] ${data}`));

function waitForServer(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/e2e/onboarding-preview?step=1`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          setTimeout(check, 500);
        }
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Server startup timed out"));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    check();
  });
}

async function capture() {
  try {
    console.log("Waiting for Next.js dev server on port 3333...");
    await waitForServer(3333);
    console.log("Server is ready! Taking screenshots...");

    const targets = [
      {
        url: "http://localhost:3333/e2e/onboarding-preview?step=1",
        out: join(artifactDir, "onboarding-v4-step1-desktop.png"),
        windowSize: "1400,980"
      },
      {
        url: "http://localhost:3333/e2e/onboarding-preview?step=2",
        out: join(artifactDir, "onboarding-v4-step2-desktop.png"),
        windowSize: "1400,980"
      },
      {
        url: "http://localhost:3333/e2e/onboarding-preview?step=3",
        out: join(artifactDir, "onboarding-v4-step3-desktop-unselected.png"),
        windowSize: "1400,980"
      },
      {
        url: "http://localhost:3333/e2e/onboarding-preview?step=3-selected",
        out: join(artifactDir, "onboarding-v4-step3-desktop-selected.png"),
        windowSize: "1400,980"
      },
      {
        url: "http://localhost:3333/e2e/onboarding-preview?step=3-selected",
        out: join(artifactDir, "onboarding-v4-step3-mobile-selected.png"),
        windowSize: "400,900"
      }
    ];

    for (const target of targets) {
      console.log(`Capturing ${target.out}...`);
      const cmd = `"${browserPath}" --headless=new --disable-gpu --hide-scrollbars --window-size=${target.windowSize} --screenshot="${target.out}" "${target.url}"`;
      execSync(cmd, { stdio: "inherit" });
    }

    console.log("All screenshots captured successfully!");
  } finally {
    console.log("Shutting down dev server...");
    try {
      execSync("taskkill /pid " + devServer.pid + " /T /F");
    } catch {}
    devServer.kill("SIGKILL");
    process.exit(0);
  }
}

capture();
