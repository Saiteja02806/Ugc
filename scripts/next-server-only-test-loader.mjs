import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const serverOnlyModule = new URL(
  "../node_modules/next/dist/compiled/server-only/empty.js",
  import.meta.url,
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: serverOnlyModule };
    }
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (specifier.startsWith("@/")) {
      const candidates = [
        new URL(`../${specifier.slice(2)}`, import.meta.url),
        new URL(`../${specifier.slice(2)}.ts`, import.meta.url),
        new URL(`../${specifier.slice(2)}.tsx`, import.meta.url),
      ];
      for (const candidate of candidates) {
        if (existsSync(fileURLToPath(candidate))) {
          return { shortCircuit: true, url: candidate.href };
        }
      }
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.match(/\.[cm]?[jt]sx?$/u) &&
      context.parentURL?.startsWith("file:")
    ) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return { shortCircuit: true, url: candidate.href };
      }
    }

    return nextResolve(specifier, context);
  },
});
