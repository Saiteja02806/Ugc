#!/usr/bin/env python3
"""Heuristic, read-only static audit of Vercel-related build cost risks.

Does not run build/install, call APIs, reveal secret values, or edit source.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

SKIP_DIRS = {'.git', 'node_modules', '.next', '.turbo', '.vercel', 'dist', 'build',
             'coverage', '.cache', 'vendor', '.venv', 'venv', 'out', '.output'}
SOURCE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
MAX_BYTES = 200_000


def find_files(root):
    try:
        cp = subprocess.run(['git', '-C', str(root), 'ls-files', '-z'],
                            capture_output=True, check=True, timeout=12)
        tracked = [root / p.decode('utf-8', errors='replace')
                   for p in cp.stdout.split(b'\0') if p]
        return [p for p in tracked if p.is_file() and not SKIP_DIRS.intersection(p.relative_to(root).parts)]
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        files = []
        for base, dirs, names in __import__('os').walk(root):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.env')]
            for name in names:
                p = Path(base) / name
                if p.is_file():
                    files.append(p)
        return files


def read_text(p):
    try:
        if p.stat().st_size > MAX_BYTES:
            return None
        return p.read_text(encoding='utf-8')
    except (OSError, UnicodeError):
        return None


def location(path, root):
    return path.relative_to(root).as_posix()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--repo', type=Path, default=Path('.'))
    ap.add_argument('--out', type=Path, help='Write Markdown to this file (otherwise stdout).')
    args = ap.parse_args()
    root = args.repo.resolve()
    if not root.is_dir():
        ap.error('Repository directory does not exist')
    files = find_files(root)
    findings = []

    def add(sev, title, path, evidence, action):
        findings.append((sev, title, location(path, root), evidence, action))

    root_locks = [name for name in ('package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb')
                  if (root / name).exists()]
    if len(root_locks) > 1:
        add('P2', 'Multiple root package-manager lockfiles', root / root_locks[0],
            ', '.join(root_locks), 'Determine the one intended package manager and check build-cache keys; do not remove files automatically.')
    workspace = bool((root / 'pnpm-workspace.yaml').exists())
    pkg_root = root / 'package.json'
    if pkg_root.exists():
        try:
            root_pkg = json.loads(read_text(pkg_root) or '{}')
            workspace |= 'workspaces' in root_pkg
        except json.JSONDecodeError:
            add('P2', 'Could not parse package.json', pkg_root, 'JSON parse error', 'Fix invalid manifest after verifying source.')
    has_vercel = any(p.name == 'vercel.json' for p in files)
    has_workflow_deploy = False
    pkg_count = 0
    generated_params_paths = []

    for path in files:
        rel = location(path, root)
        if path.name.startswith('.env') or any(part in ('.secrets', 'secrets') for part in path.parts):
            continue
        if path.name == 'package.json':
            raw = read_text(path)
            if raw is None:
                continue
            try:
                pkg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            pkg_count += 1
            scripts = pkg.get('scripts') or {}
            if not isinstance(scripts, dict):
                scripts = {}
            for key in ('prebuild', 'build', 'postbuild', 'postinstall', 'prepare'):
                cmd = scripts.get(key)
                if not isinstance(cmd, str):
                    continue
                if key in ('postinstall', 'prepare') and re.search(r'playwright|puppeteer|chromium|prisma generate|curl\s|wget\s|download', cmd, re.I):
                    add('P2', 'Possibly expensive install hook', path, f'{key} invokes browser/binary/download tooling',
                        'Measure install phase; keep the hook if needed for correctness.')
                if key == 'build' and re.search(r'(?:^|\W)(?:lint|typecheck|tsc|test|e2e)(?:\W|$)', cmd, re.I):
                    add('P2', 'Build includes validation work', path, 'build script runs lint/typecheck/tests',
                        'Compare CI and Vercel logs; do not remove checks unless an equivalent required gate exists.')
                if key in ('build', 'prebuild', 'postbuild') and re.search(r'playwright|puppeteer|chromium|ffmpeg|scrap|download|fetch-data|generate-content', cmd, re.I):
                    add('P2', 'Heavy or network-dependent build script', path, f'{key} invokes large asset/content tooling',
                        'Time and isolate this step; consider separate worker/pipeline if appropriate.')
                if key == 'build' and cmd.count('next build') > 1:
                    add('P1', 'Repeated Next.js build invocation', path, 'build script contains more than one `next build`',
                        'Determine if duplicate compilation is necessary; remove only with approval/tests.')
            continue
        if path.name == 'vercel.json':
            raw = read_text(path)
            if raw is None:
                continue
            try:
                config = json.loads(raw)
            except json.JSONDecodeError:
                add('P1', 'Invalid vercel.json', path, 'Failed JSON parsing', 'Validate exact JSON and deployed Vercel configuration.')
                continue
            if 'ignoreCommand' in config:
                add('P2', 'Custom ignored build step', path, 'ignoreCommand is configured',
                    'Test exit code 0=skip vs nonzero=build; check shared dependencies, shallow commits, production hotfixes.')
            if 'installCommand' in config:
                add('INFO', 'Custom install command', path, 'installCommand override exists',
                    'Verify filtered installation and cache behavior with build logs.')
            continue
        if rel.startswith('.github/workflows/') and path.suffix in ('.yaml', '.yml'):
            raw = read_text(path)
            if raw and re.search(r'\bvercel\s+(?:(?:deploy|--prod|build|promote)\b)|\b(?:npx|pnpm|yarn)\s+vercel\s+deploy\b', raw, re.I):
                has_workflow_deploy = True
                add('P1', 'GitHub Actions deploy command', path, 'Workflow invokes Vercel deploy/build CLI',
                    'Check if native Vercel Git integration also deploys the same target; duplication is not yet confirmed.')
            if raw and re.search(r'deploy[_-]?hook', raw, re.I):
                add('P2', 'Possible deploy hook trigger', path, 'Workflow refers to deployment hook',
                    'Check whether hook and native Git integration both run for the same commit.')
            continue
        if (path.name.startswith('next.config.') or path.name == 'turbo.json'):
            raw = read_text(path)
            if raw and re.search(r'no-cache|TURBO_FORCE|VERCEL_FORCE_NO_BUILD_CACHE', raw, re.I):
                add('P1', 'Possible build cache bypass', path, 'Cache-bypass setting referenced',
                    'Verify real runtime value; disable only if intentional bypass is not needed.')
        if path.suffix in SOURCE_EXT and ('/app/' in f'/{rel}' or '/pages/' in f'/{rel}'):
            raw = read_text(path)
            if raw and 'generateStaticParams' in raw:
                generated_params_paths.append(path)

    if generated_params_paths:
        add('INFO', 'Static parameter generation candidates', generated_params_paths[0],
            f'Found generateStaticParams in {len(generated_params_paths)} source file(s)',
            'Compare prerender/route count and build logs. Presence alone is not a problem.')
    if workspace:
        add('INFO', 'Workspace detected', root / ('pnpm-workspace.yaml' if (root / 'pnpm-workspace.yaml').exists() else 'package.json'),
            'Workspace manifest found', 'Check Vercel GitHub-based Skip deployment for unaffected projects and explicit workspace dependency graph.')
    if has_workflow_deploy and has_vercel:
        add('P2', 'Potential competing deployment entry points', root / 'vercel.json',
            'Repository has Vercel config and GitHub Actions Vercel deploy',
            'Vercel Git integration is account-side; inspect project settings to verify duplication.')

    lines = [
        '# Static Vercel Repository Cost Audit', '',
        f'- Root: `{root}`', f'- Files examined: {len(files)}', f'- Package manifests: {pkg_count}',
        f'- Root lockfiles: {", ".join(root_locks) or "none found"}',
        f'- Workspace: {"detected" if workspace else "not detected"}',
        '- **Scope:** heuristics only. No Vercel account usage or actual billable CPU minutes measured.',
        '- **Safety:** read-only scan; no build/deploy commands executed.', '',
        '## Signals requiring investigation', ''
    ]
    if not findings:
        lines.append('No patterns flagged. This does **not** rule out expensive Vercel settings or cloud-side deployment fanout.')
    for i, (sev, title, path, evidence, action) in enumerate(sorted(findings, key=lambda x: {'P1': 0, 'P2': 1, 'INFO': 2}.get(x[0], 3)), 1):
        lines += [f'### {i}. {sev}: {title}',
                  f'- File: `{path}`', f'- Signal: {evidence}',
                  f'- Next step: {action}', '- Confidence: **hypothesis until deployment logs/account usage confirms it**', '']
    text = '\n'.join(lines) + '\n'
    if args.out:
        args.out.write_text(text, encoding='utf-8')
        print(f'Wrote {args.out}')
    else:
        print(text, end='')


if __name__ == '__main__':
    main()
