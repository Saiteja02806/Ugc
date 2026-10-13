// NodeNext worker sources deliberately name emitted .js imports. Resolve their
// TypeScript peers when a web contract test loads those sources before emit.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".js") && (specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const emitted = new URL(specifier, context.parentURL);
      const source = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (source.pathname.includes("/worker/src/") && !existsSync(fileURLToPath(emitted)) && existsSync(fileURLToPath(source))) {
        return { shortCircuit: true, url: source.href };
      }
    }
    return nextResolve(specifier, context);
  },
});
