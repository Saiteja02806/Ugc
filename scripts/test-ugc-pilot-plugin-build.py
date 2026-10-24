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

# Historical packages are immutable. This snapshot records the exact published
# 0.2.0 bundle rather than incorrectly comparing an old archive to a newer
# source package that has gained additional skills.
PUBLISHED_0_2_0_FILES = [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    ".mcp.json",
    "README.md",
    "assets/logo.png",
    "evaluation-cases.json",
    "mcp.json",
    "plugin.json",
    "references/creative-workflow.md",
    "skills/connect-ugc-pilot/SKILL.md",
    "skills/connect-ugc-pilot/references/client-setup.md",
    "skills/create-ugc-media/SKILL.md",
    "skills/edit-ugc-draft/SKILL.md",
    "skills/emotion-hook-director/SKILL.md",
    "skills/emotion-hook-director/references/performance-guide.md",
    "skills/emotion-hook-director/schemas/director-output.schema.json",
    "skills/finish-ugc-video/SKILL.md",
    "skills/manage-ugc-account/SKILL.md",
    "skills/manage-ugc-groups/SKILL.md",
    "skills/manage-ugc-library/SKILL.md",
    "skills/manage-ugc-media/SKILL.md",
    "skills/manage-ugc-media/references/audio-workflow.md",
    "skills/manage-ugc-media/references/local-transfer.md",
    "skills/manage-ugc-media/scripts/transfer-audio.mjs",
    "skills/manage-ugc-media/scripts/transfer-media.mjs",
    "skills/remix-ugc-reference/SKILL.md",
    "skills/ugc-hook-intelligence/SKILL.md",
    "skills/ugc-hook-intelligence/references/examples.md",
    "skills/ugc-hook-intelligence/references/hook-patterns.md",
    "skills/ugc-hook-intelligence/references/source-hook-library.md",
    "skills/ugc-hook-intelligence/schemas/hook-output.schema.json",
    "skills/ugc-native-slideshow/SKILL.md",
    "skills/ugc-native-slideshow/references/layout-guide.md",
    "skills/ugc-native-slideshow/references/output-schema.json",
    "skills/ugc-native-slideshow/references/pattern-library.md",
    "skills/wall-text-generation/SKILL.md",
    "skills/wall-text-generation/references/writing-guide.md",
    "skills/wall-text-generation/schemas/wall-copy.schema.json",
    "skills/wall-text-video-generation/SKILL.md",
    "skills/wall-text-video-generation/references/visual-guide.md",
    "skills/wall-text-video-generation/schemas/video-output.schema.json",
]


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

    def source_version(self):
        return json.loads((builder.SOURCE / "plugin.json").read_text(encoding="utf-8"))["version"]

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
            self.assertEqual(len([name for name in package.namelist() if name.endswith("/SKILL.md")]), 18)
            for name in builder.FILES:
                self.assertEqual(package.read("ugc-pilot/" + name), (builder.SOURCE / name).read_bytes().replace(b"\r\n", b"\n") if Path(name).suffix in {".md", ".json", ".mjs"} else (builder.SOURCE / name).read_bytes())
                if Path(name).suffix in {".md", ".json", ".mjs"}:
                    self.assertNotIn(b"\r\n", package.read("ugc-pilot/" + name))
            versions = [json.loads(package.read("ugc-pilot/" + name))["version"] for name in ["plugin.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json"]]
            self.assertEqual(versions, [self.source_version()] * 3)
        self.assertIn(hashlib.sha256(before).hexdigest(), archive.with_suffix(".zip.sha256").read_text())
        self.assertTrue((self.destination / f"ugc-pilot-{self.source_version()}-setup.md").exists())
        self.assertFalse((self.destination / "ugc-pilot-setup.md").exists())
        guide = (self.destination / f"ugc-pilot-{self.source_version()}-setup.md").read_text(encoding="utf-8")
        self.assertNotIn("](skills/", guide)
        self.assertIn("skills/edit-ugc-draft/SKILL.md", guide)
        for skill in ["manage-ugc-analytics", "manage-ugc-groups", "manage-ugc-library", "manage-ugc-scheduling", "remix-ugc-reference", "manage-ugc-account", "manage-ugc-business", "onboard-ugc-business"]:
            self.assertIn(f"skills/{skill}/SKILL.md", guide)
        self.assertIn("[client setup](#client-setup)", guide)
        self.assertIn(".agents/plugins/marketplace.json", guide)

    def test_existing_published_archive_is_complete_and_has_a_matching_checksum(self):
        archive = ROOT / "public/downloads/ugc-pilot-0.2.0.zip"
        with zipfile.ZipFile(archive) as package:
            self.assertIsNone(package.testzip())
            self.assertEqual(sorted(package.namelist()), sorted("ugc-pilot/" + name for name in PUBLISHED_0_2_0_FILES))
            self.assertEqual(json.loads(package.read("ugc-pilot/plugin.json"))["version"], "0.2.0")
        self.assertEqual(archive.with_suffix(".zip.sha256").read_text().strip(), hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name)

    def test_published_0_2_1_archive_remains_immutable(self):
        archive = ROOT / "public/downloads/ugc-pilot-0.2.1.zip"
        with zipfile.ZipFile(archive) as package:
            self.assertIsNone(package.testzip())
            self.assertEqual(json.loads(package.read("ugc-pilot/plugin.json"))["version"], "0.2.1")
        self.assertEqual(archive.with_suffix(".zip.sha256").read_text().strip(), hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name)

    def test_published_candidate_matches_current_canonical_source(self):
        archive = ROOT / "public" / "downloads" / f"ugc-pilot-{self.source_version()}.zip"
        with zipfile.ZipFile(archive) as package:
            self.assertIsNone(package.testzip())
            self.assertEqual(sorted(package.namelist()), sorted("ugc-pilot/" + name for name in builder.FILES))
            for name in builder.FILES:
                self.assertEqual(package.read("ugc-pilot/" + name), builder.package_bytes(name))
            self.assertEqual(json.loads(package.read("ugc-pilot/plugin.json"))["version"], self.source_version())
        self.assertEqual(archive.with_suffix(".zip.sha256").read_text().strip(), hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name)
        self.assertTrue((ROOT / "public" / "downloads" / f"ugc-pilot-{self.source_version()}-setup.md").exists())

    def test_published_0_2_0_archive_remains_immutable(self):
        archive = ROOT / "public/downloads/ugc-pilot-0.2.0.zip"
        with zipfile.ZipFile(archive) as package:
            self.assertIsNone(package.testzip())
            self.assertEqual(json.loads(package.read("ugc-pilot/plugin.json"))["version"], "0.2.0")
        self.assertEqual(archive.with_suffix(".zip.sha256").read_text().strip(), hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name)

    def test_packaged_business_logo_helper_prepares_a_durable_exact_intent(self):
        import struct
        import zlib
        archive = self.build()
        helper = self.destination / "transfer-business-logo.mjs"
        with zipfile.ZipFile(archive) as package:
            helper.write_bytes(package.read("ugc-pilot/skills/manage-ugc-media/scripts/transfer-business-logo.mjs"))
        def chunk(kind, value):
            return struct.pack(">I", len(value)) + kind + value + struct.pack(">I", zlib.crc32(kind + value) & 0xffffffff)
        image = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 128, 128, 8, 2, 0, 0, 0))
        image += chunk(b"IDAT", zlib.compress((b"\x00" + b"\x40\x70\x90" * 128) * 128)) + chunk(b"IEND", b"")
        source = self.destination / "business-logo.png"
        source.write_bytes(image)
        receipt = self.destination / "business-logo-intent.json"
        prepared = subprocess.run(["node", str(helper), "prepare", "--file", str(source), "--receipt", str(receipt)], capture_output=True, text=True, check=True)
        output = json.loads(prepared.stdout)
        saved = json.loads(receipt.read_text())
        self.assertEqual(output["create_business_logo_upload"]["sha256"], hashlib.sha256(image).hexdigest())
        self.assertEqual(saved["input"]["request_id"], output["request_id"])
        self.assertEqual(saved["input"]["file_size_bytes"], len(image))
        self.assertIsNone(saved["upload_id"])
        duplicate = subprocess.run(["node", str(helper), "prepare", "--file", str(source), "--receipt", str(receipt)], capture_output=True, text=True)
        self.assertNotEqual(duplicate.returncode, 0)
        self.assertEqual(json.loads(receipt.read_text()), saved)

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
