"""Exercise real ZIP builds in an isolated directory within the workspace."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import subprocess
import wave
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
            self.assertEqual(len([name for name in package.namelist() if name.endswith("/SKILL.md")]), 14)
            for name in builder.FILES:
                self.assertEqual(package.read("ugc-pilot/" + name), (builder.SOURCE / name).read_bytes().replace(b"\r\n", b"\n") if Path(name).suffix in {".md", ".json", ".mjs"} else (builder.SOURCE / name).read_bytes())
                if Path(name).suffix in {".md", ".json", ".mjs"}:
                    self.assertNotIn(b"\r\n", package.read("ugc-pilot/" + name))
            versions = [json.loads(package.read("ugc-pilot/" + name))["version"] for name in ["plugin.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json"]]
            self.assertEqual(versions, ["0.1.12"] * 3)
        self.assertIn(hashlib.sha256(before).hexdigest(), archive.with_suffix(".zip.sha256").read_text())
        self.assertTrue((self.destination / "ugc-pilot-0.1.12-setup.md").exists())
        self.assertFalse((self.destination / "ugc-pilot-setup.md").exists())
        guide = (self.destination / "ugc-pilot-0.1.12-setup.md").read_text(encoding="utf-8")
        self.assertNotIn("](skills/", guide)
        self.assertIn("skills/edit-ugc-draft/SKILL.md", guide)
        for skill in ["manage-ugc-groups", "manage-ugc-library", "remix-ugc-reference", "manage-ugc-account"]:
            self.assertIn(f"skills/{skill}/SKILL.md", guide)
        self.assertIn("[client setup](#client-setup)", guide)
        self.assertIn(".agents/plugins/marketplace.json", guide)

    def test_reviewed_public_archive_matches_current_canonical_source(self):
        archive = ROOT / "public/downloads/ugc-pilot-0.1.12.zip"
        with zipfile.ZipFile(archive) as package:
            self.assertIsNone(package.testzip())
            self.assertEqual(sorted(package.namelist()), sorted("ugc-pilot/" + name for name in builder.FILES))
            for name in builder.FILES:
                self.assertEqual(package.read("ugc-pilot/" + name), builder.package_bytes(name))
        self.assertEqual(archive.with_suffix(".zip.sha256").read_text().strip(), hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name)

    def test_packaged_audio_helper_executes_and_preserves_recovery_identity(self):
        archive = self.build()
        helper = self.destination / "transfer-audio.mjs"
        with zipfile.ZipFile(archive) as package:
            helper.write_bytes(package.read("ugc-pilot/skills/manage-ugc-media/scripts/transfer-audio.mjs"))
        audio = self.destination / "recording.wav"
        with wave.open(str(audio), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(16000)
            output.writeframes(bytes(32000))
        receipt = self.destination / "audio-receipt.json"
        prepared = subprocess.run(["node", str(helper), "prepare", str(audio), str(receipt), "exact"], capture_output=True, text=True, check=True)
        intent = json.loads(prepared.stdout)
        self.assertEqual(intent["create_audio_upload"]["sha256"], hashlib.sha256(audio.read_bytes()).hexdigest())
        self.assertEqual(intent["create_audio_upload"]["file_size_bytes"], audio.stat().st_size)
        before = receipt.read_bytes()
        recovered = subprocess.run(["node", str(helper), "recover", str(receipt)], capture_output=True, text=True, check=True)
        recovery = json.loads(recovered.stdout)
        self.assertEqual(recovery["request_id"], intent["request_id"])
        self.assertEqual(recovery["create_audio_upload"], intent["create_audio_upload"])
        duplicate = subprocess.run(["node", str(helper), "prepare", str(audio), str(receipt), "exact"], capture_output=True, text=True)
        self.assertNotEqual(duplicate.returncode, 0)
        self.assertEqual(receipt.read_bytes(), before)
        self.assertNotIn(b"https://", before)
        self.assertEqual(recovery["stage"], "prepared")

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
