"""Local importer tests; no cloud/provider calls or application builds."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("talking_prepare", Path(__file__).with_name("prepare-talking-head-references.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
TEST_TMP = Path(__file__).resolve().parents[1] / ".tmp/starting-frame-auto-20261104"


class TalkingImportTest(unittest.TestCase):
    def setup_fixture(self, root, existing_id="talking-old"):
        folder = root / "input/clip"
        folder.mkdir(parents=True)
        source = folder / "source.mp4"
        source.write_bytes(b"explicitly selected test video" * 3)
        (folder / "source.txt").write_text("https://www.tiktok.com/@fixture/video/123456789")
        context = root / "lib/explore"
        context.mkdir(parents=True)
        prior = [{"id": existing_id, "sourceSha256": "a" * 64, "preserved": True}]
        for name in ["talking-head-reference-catalog.json", "talking-head-source-manifest.json", "talking-head-frames.json"]:
            (context / name).write_text(json.dumps({"version": 1, "items": prior}))
        return source, context

    def run_prepare(self, root, source, fail=False):
        events = []
        def output(command, **kwargs):
            if command[0] == "node":
                events.append("backend preparation")
                rows = json.loads(kwargs["input"])
                self.assertEqual(rows[0]["sourceSha256"], hashlib.sha256(source.read_bytes()).hexdigest())
                if fail:
                    raise RuntimeError("backend preparation failed")
                return json.dumps([{"id": "talking-new", "width": 96, "height": 160, "sourceSha256": rows[0]["sourceSha256"], "frameSha256": "b" * 64, "frameIndex": 0, "frameTimeSeconds": 0}]).encode()
            return json.dumps({"format": {"duration": "2.0"}, "streams": []}).encode()
        def run(command, **kwargs):
            Path(command[-1]).write_bytes(b"local poster fixture")
        with patch.object(module, "ROOT", root), patch.object(module, "SOURCES", [("talking-new", "clip/source.mp4", "New clip", "Existing directions.")]), patch.object(module.subprocess, "check_output", side_effect=output), patch.object(module.subprocess, "run", side_effect=run):
            module.prepare(root / "input", {}, {"talking-new"})
        return events

    def test_failure_leaves_all_activation_manifests_unchanged(self):
        with tempfile.TemporaryDirectory(prefix="ugc-import-test-", dir=TEST_TMP) as folder:
            root = Path(folder)
            source, context = self.setup_fixture(root)
            before = {p: p.read_bytes() for p in context.glob("*.json")}
            with self.assertRaisesRegex(RuntimeError, "backend preparation failed"):
                self.run_prepare(root, source, fail=True)
            self.assertEqual(before, {p: p.read_bytes() for p in context.glob("*.json")})

    def test_success_publishes_matching_rows_and_preserves_unselected_entries(self):
        with tempfile.TemporaryDirectory(prefix="ugc-import-test-", dir=TEST_TMP) as folder:
            root = Path(folder)
            source, context = self.setup_fixture(root)
            self.assertEqual(self.run_prepare(root, source), ["backend preparation"])
            for p in context.glob("*.json"):
                items = json.loads(p.read_text())["items"]
                self.assertEqual([r["id"] for r in items], ["talking-old", "talking-new"])
                self.assertTrue(items[0]["preserved"])

    def test_changed_existing_source_is_rejected_before_overwriting_media(self):
        with tempfile.TemporaryDirectory(prefix="ugc-import-test-", dir=TEST_TMP) as folder:
            root = Path(folder)
            source, _ = self.setup_fixture(root, existing_id="talking-new")
            target = root / "public/explore/talking-head-references/v1/talking-new.mp4"
            target.parent.mkdir(parents=True)
            target.write_bytes(b"preserved historical media")
            with self.assertRaisesRegex(ValueError, "existing media will not be overwritten"):
                self.run_prepare(root, source)
            self.assertEqual(target.read_bytes(), b"preserved historical media")


if __name__ == "__main__":
    unittest.main()
