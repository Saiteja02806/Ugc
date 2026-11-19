import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("face swap initializes and reconciles its selected face before display", () => {
  const slots = [];
  let cursor = 0, changed = false;
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], next => { if (slots[index] !== next) changed = true; slots[index] = next; }];
      },
      useRef: () => ({ current: null }),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@tanstack/react-query": { useQuery: () => ({}), useInfiniteQuery: () => ({}) },
    "@/lib/characters/history": { mergeCharacterHistoryPages: () => [] },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("components/generation/face-swap-dialog.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => imports[name] ?? new Proxy({}, { get: (_, key) => key }) });
  const a = { id: "a", url: "/a.jpg" }, b = { id: "b", url: "/b.jpg" };
  const props = { open: true, activeInfluencer: a, targetAsset: null };
  function render() {
    let tree, attempts = 0;
    do {
      assert.ok(attempts++ < 5, "state reconciliation settles");
      cursor = 0; changed = false;
      tree = exports.FaceSwapDialog(props);
    } while (changed);
    return tree;
  }
  render();
  assert.equal(slots[0].id, "a", "initially open dialog selects active face");
  props.activeInfluencer = b;
  render();
  assert.equal(slots[0].id, "b");
  props.open = false;
  render();
  props.activeInfluencer = a;
  render();
  assert.equal(slots[0].id, "b", "closed dialog waits for next open");
  props.open = true;
  render();
  assert.equal(slots[0].id, "a");
});
