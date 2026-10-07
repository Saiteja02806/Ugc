import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import "./next-server-only-test-loader.mjs";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.startsWith("file:") && /^(\.\/|\.\.\/).+\.js$/.test(specifier)) {
    const candidate = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return { shortCircuit: true, url: candidate.href };
  }
  return nextResolve(specifier, context);
} });
