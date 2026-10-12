"""Build a deterministic, allowlisted private plugin ZIP without credentials."""
from pathlib import Path
import argparse
import hashlib
import io
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "plugins" / "ugc-pilot"
FILES = json.loads((ROOT / "scripts/ugc-pilot-package-files.json").read_text(encoding="utf-8"))


def package_bytes(relative):
    data = (SOURCE / relative).read_bytes()
    # Match Git text blobs across Windows CRLF and Unix LF checkouts.
    return data.replace(b"\r\n", b"\n") if Path(relative).suffix in {".md", ".json", ".mjs"} else data


def build(destination=None):
    subprocess.run(["node", str(ROOT / "scripts/validate-ugc-pilot-plugin.mjs")], cwd=ROOT, check=True)
    manifest = json.loads((SOURCE / "plugin.json").read_text(encoding="utf-8"))
    destination = (Path(destination) if destination else ROOT / ".tmp" / "plugin-packages").resolve()
    if not destination.is_relative_to(ROOT.resolve()):
        raise ValueError("Package output must stay inside this workspace")
    archive = destination / f"ugc-pilot-{manifest['version']}.zip"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for relative in sorted(FILES):
            source = SOURCE / relative
            if source.is_symlink() or not source.resolve().is_relative_to(SOURCE.resolve()):
                raise ValueError(f"Invalid package path: {relative}")
            entry = zipfile.ZipInfo(f"ugc-pilot/{relative}", date_time=(2026, 10, 7, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            output.writestr(entry, package_bytes(relative))
    archive_bytes = buffer.getvalue()
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as check:
        assert check.testzip() is None, "ZIP CRC failure"
        assert sorted(check.namelist()) == sorted(f"ugc-pilot/{relative}" for relative in FILES)
        for relative in FILES:
            assert check.read(f"ugc-pilot/{relative}") == package_bytes(relative)
    digest = hashlib.sha256(archive_bytes).hexdigest()
    readme = (SOURCE / "README.md").read_text(encoding="utf-8")
    standalone = readme.replace(
        "[client setup](skills/connect-ugc-pilot/references/client-setup.md)",
        "[client setup](#client-setup)",
    )
    # A downloaded standalone guide cannot resolve the extracted bundle's links.
    for relative in [
        "skills/manage-ugc-media/references/local-transfer.md",
        "skills/edit-ugc-draft/SKILL.md",
        "skills/manage-ugc-media/references/audio-workflow.md",
    ]:
        standalone = standalone.replace(f"[local transfer helper]({relative})", f"local transfer helper (`{relative}` in the extracted bundle)").replace(f"[Edit workflow]({relative})", f"Edit workflow (`{relative}` in the extracted bundle)").replace(f"[audio workflow]({relative})", f"audio workflow (`{relative}` in the extracted bundle)")
    standalone += "\n\n---\n\n" + (SOURCE / "skills/connect-ugc-pilot/references/client-setup.md").read_text(encoding="utf-8")
    outputs = {
        archive: archive_bytes,
        archive.with_suffix(".zip.sha256"): f"{digest}  {archive.name}\n".encode("ascii"),
        destination / f"ugc-pilot-{manifest['version']}-setup.md": standalone.replace("\r\n", "\n").encode("utf-8"),
    }
    # Preflight all outputs. A version must never silently overwrite different bytes.
    for target, data in outputs.items():
        if target.is_symlink() or (target.exists() and target.read_bytes() != data):
            raise ValueError(f"Refusing to replace existing release artifact: {target}")
    destination.mkdir(parents=True, exist_ok=True)
    for target, data in outputs.items():
        if not target.exists():
            with target.open("xb") as output:
                output.write(data)
    print(json.dumps({"archive": str(archive), "sha256": digest, "entries": len(FILES), "bytes": archive.stat().st_size}))
    return archive


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", help="Workspace directory; defaults to .tmp/plugin-packages for local review")
    build(parser.parse_args().output_dir)
