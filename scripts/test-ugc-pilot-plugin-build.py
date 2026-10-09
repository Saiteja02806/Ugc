"""Exercise real ZIP builds in an isolated directory within the workspace."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("plugin_builder", ROOT / "scripts/build-ugc-pilot-plugin.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PluginBuildTests(unittest.TestCase):
    def setUp(self):
        (ROOT / ".tmp").mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="plugin-build-test-", dir=ROOT / ".tmp")
        self.destination = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def build(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return builder.build(self.destination)

    def test_archive_is_complete_deterministic_and_preserves_old_release(self):
        old = self.destination / "ugc-pilot-0.1.1.zip"
        old.write_bytes(b"existing-release-sentinel")
        archive = self.build()
        before = archive.read_bytes()
        self.assertEqual(self.build().read_bytes(), before)
        self.assertEqual(old.read_bytes(), b"existing-release-sentinel")
        with zipfile.ZipFile(archive) as package:
            self.assertIsNone(package.testzip())
            self.assertEqual(sorted(package.namelist()), sorted("ugc-pilot/" + name for name in builder.FILES))
            self.assertEqual(len([name for name in package.namelist() if name.endswith("/SKILL.md")]), 8)
            for name in builder.FILES:
                self.assertEqual(package.read("ugc-pilot/" + name), (builder.SOURCE / name).read_bytes())
            versions = [json.loads(package.read("ugc-pilot/" + name))["version"] for name in ["plugin.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json"]]
            self.assertEqual(versions, ["0.1.2"] * 3)
        self.assertIn(hashlib.sha256(before).hexdigest(), archive.with_suffix(".zip.sha256").read_text())
        self.assertTrue((self.destination / "ugc-pilot-0.1.2-setup.md").exists())
        self.assertFalse((self.destination / "ugc-pilot-setup.md").exists())

    def test_existing_version_is_never_replaced_with_different_bytes(self):
        archive = self.build()
        archive.write_bytes(b"different-existing-bytes")
        with self.assertRaisesRegex(ValueError, "Refusing to replace"):
            self.build()
        self.assertEqual(archive.read_bytes(), b"different-existing-bytes")

    def test_output_cannot_escape_workspace(self):
        with self.assertRaisesRegex(ValueError, "inside this workspace"):
            builder.build(ROOT.parent / "outside-plugin-test")


if __name__ == "__main__":
    unittest.main()
