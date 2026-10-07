"""Build a deterministic, allowlisted private plugin ZIP without credentials."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "plugins" / "ugc-pilot"
FILES = (
    ".claude-plugin/plugin.json", ".codex-plugin/plugin.json", ".mcp.json",
    "README.md", "assets/logo.png", "evaluation-cases.json", "mcp.json", "plugin.json",
    "skills/connect-ugc-pilot/SKILL.md",
    "skills/connect-ugc-pilot/references/client-setup.md",
    "skills/create-ugc-media/SKILL.md", "skills/manage-ugc-media/SKILL.md",
)


def build():
    subprocess.run(["node", str(ROOT / "scripts/validate-ugc-pilot-plugin.mjs")], cwd=ROOT, check=True)
    manifest = json.loads((SOURCE / "plugin.json").read_text(encoding="utf-8"))
    destination = ROOT / "public" / "downloads"
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / f"ugc-pilot-{manifest['version']}.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for relative in sorted(FILES):
            source = SOURCE / relative
            if source.is_symlink() or not source.resolve().is_relative_to(SOURCE.resolve()):
                raise ValueError(f"Invalid package path: {relative}")
            entry = zipfile.ZipInfo(f"ugc-pilot/{relative}", date_time=(2026, 10, 7, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            output.writestr(entry, source.read_bytes())
    with zipfile.ZipFile(archive) as check:
        assert check.testzip() is None, "ZIP CRC failure"
        assert sorted(check.namelist()) == sorted(f"ugc-pilot/{relative}" for relative in FILES)
        for relative in FILES:
            assert check.read(f"ugc-pilot/{relative}") == (SOURCE / relative).read_bytes()
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".zip.sha256").write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    readme = (SOURCE / "README.md").read_text(encoding="utf-8")
    standalone = readme.replace(
        "[client setup](skills/connect-ugc-pilot/references/client-setup.md)",
        "[client setup](#client-setup)",
    )
    standalone += "\n\n---\n\n" + (SOURCE / "skills/connect-ugc-pilot/references/client-setup.md").read_text(encoding="utf-8")
    (destination / "ugc-pilot-setup.md").write_text(standalone, encoding="utf-8", newline="\n")
    print(json.dumps({"archive": str(archive), "sha256": digest, "entries": len(FILES), "bytes": archive.stat().st_size}))


if __name__ == "__main__":
    build()
