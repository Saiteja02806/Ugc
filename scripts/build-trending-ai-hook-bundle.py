"""Build the frozen Trending collection; verify every MP4 against its catalogue hash."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'lib/trending/ai-hook-bundle.json').read_text())
output = ROOT / '.tmp' / manifest['id']
output.mkdir(parents=True, exist_ok=True)


def fetch_video(item):
    filename = f"{item['id']}.mp4"
    target = output / filename
    if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
        with urllib.request.urlopen(item['videoUrl'], timeout=90) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError(f"Hash mismatch: {item['id']}")
        target.write_bytes(data)
    return target


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    files = list(pool.map(fetch_video, manifest['videos']))

archive = output / f"{manifest['id']}.zip"
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as bundle:
    bundle.writestr('catalogue.json', json.dumps(manifest, indent=2))
    bundle.writestr('README.txt',
                    f"{manifest['title']}\n{len(files)} silent AI hook clips from the Trending catalogue.\n"
                    "Match each MP4 filename to its id in catalogue.json for its title and duration.\n"
                    "These are opening clips; add your own text, music and demo in your editor.\n")
    for source in files:
        bundle.write(source, f'videos/{source.name}')

with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert len([name for name in bundle.namelist() if name.endswith('.mp4')]) == len(manifest['videos'])
print(json.dumps({'archive': str(archive), 'videos': len(files), 'bytes': archive.stat().st_size,
                  'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}))
