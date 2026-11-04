// Run worker tests against current TypeScript sources without creating build output.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith("file:") && /\.js$/.test(specifier)) {
      const target = new URL(specifier, context.parentURL);
      target.pathname = target.pathname.replace("/worker/dist/", "/worker/src/").replace(/\.js$/, ".ts");
      if (target.pathname.includes("/worker/src/") && existsSync(fileURLToPath(target))) {
        return { shortCircuit: true, url: target.href };
      }
    }
    return nextResolve(specifier, context);
  },
});
