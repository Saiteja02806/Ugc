import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("reference preview has custom playback and no native download menu, and seeks/mutes the same media", () => {
  let cursor = 0; const state = [], player = { currentTime: 0, muted: false }, exported = {};
  const jsx = (type, props) => ({ type, props });
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/reference-video-player.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: exported, require(name) {
    if (name === "react") return { useRef: () => ({ current: player }), useState: value => { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], next => { state[i] = next; }]; } };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    return { ClipPreviewControls: "ClipPreviewControls" };
  } });
  const render = () => { cursor = 0; return exported.ReferenceVideoPlayer({ title: "Reference", url: "/reference.mp4" }); };
  let tree = render(); const video = tree.props.children[0];
  assert.equal(video.props.controls, undefined);
  assert.equal(video.props.controlsList, "nodownload noremoteplayback");
  assert.equal(video.props.disablePictureInPicture, true); assert.equal(video.props.disableRemotePlayback, true);
  let prevented = false; video.props.onContextMenu({ preventDefault() { prevented = true; } }); assert.equal(prevented, true);
  video.props.onLoadedMetadata({ currentTarget: { duration: 6.7 } }); tree = render();
  const controls = tree.props.children[1]; assert.equal(controls.props.endMs, 6700);
  controls.props.onSeek(3300); assert.equal(player.currentTime, 3.3);
  controls.props.onMute(true); assert.equal(player.muted, true);
  video.props.onError(); tree = render(); assert.equal(tree.props.children[2].props.role, "alert");
});
