#!/usr/bin/env python3
"""Read-only Git diff risk screener for changes that may raise Vercel build cost.

Run in checkout with a fetched comparison branch:
  python check_pr.py --repo . --base origin/main --head HEAD
No deployments, installs or external API calls.
"""
import argparse
from pathlib import Path
import subprocess
import sys


def diff_names(repo, base, head):
    cmd = ['git', '-C', str(repo), 'diff', '--name-only', '--diff-filter=ACMR',
           f'{base}...{head}', '--']
    cp = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
    if cp.returncode:
        raise ValueError(cp.stderr.strip() or 'Git diff failed. Check base/head refs and fetch the base branch first.')
    return [x.strip() for x in cp.stdout.splitlines() if x.strip()]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--repo', type=Path, default=Path('.'))
    ap.add_argument('--base', default='origin/main', help='Trusted git base ref; default origin/main')
    ap.add_argument('--head', default='HEAD')
    ap.add_argument('--out', type=Path)
    args = ap.parse_args()
    root = args.repo.resolve()
    if not root.is_dir():
        ap.error('Repository does not exist')
    try:
        paths = diff_names(root, args.base, args.head)
    except (ValueError, subprocess.TimeoutExpired, OSError) as exc:
        ap.error(str(exc))
    findings = []
    def flag(sev, path, label, advice):
        findings.append((sev, path, label, advice))
    for path in paths:
        basename = Path(path).name
        if basename in ('package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'):
            flag('P1', path, 'Dependency graph / potential install-cache change', 'Inspect lockfile churn, install duration and workspace dependency impact.')
        elif basename == 'package.json':
            flag('P1', path, 'Build/install scripts or dependencies may have changed', 'Compare package.json diff; check install/build script and benchmark before/after.')
        elif basename in ('vercel.json', 'turbo.json', 'pnpm-workspace.yaml') or basename.startswith('next.config.'):
            flag('P1', path, 'Build configuration changed', 'Review targeted projects, build cache keys and skip-unaffected correctness.')
        elif path.startswith('.github/workflows/'):
            flag('P1', path, 'CI/deployment trigger possibly changed', 'Review whether GitHub Actions and native Git deploy the same SHA/target.')
        elif basename in ('AGENTS.md', 'nonnegotiables.md', 'clear.md'):
            flag('INFO', path, 'Engineering policy changed', 'Follow updated guardrails before proceeding.')
        elif (path.endswith(('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs')) and
              any(key in path for key in ('/app/', '/pages/', '/scripts/', '/api/'))):
            flag('P2', path, 'Potential compilation, prerender or function bundle impact',
                 'Check changed content for heavy build-time data fetching and generateStaticParams; not automatically expensive.')
    lines = [f'# Vercel Cost Guardian — PR Guard', '',
             f'- Base: `{args.base}`', f'- Head: `{args.head}`',
             f'- Changed files: {len(paths)}',
             '- **Read-only signals:** build impact is unconfirmed without real deployment metrics.', '',
             '## Signals', '']
    if not findings:
        lines.append('No obvious Vercel build-risk file patterns changed. This is not proof of zero deployment cost.')
    for sev, path, label, advice in findings:
        lines += [f'- **{sev}** `{path}` — {label}. {advice}']
    lines += ['', '## Human review gate',
              '- Check whether related projects should deploy; never disable relevant deployment triggers automatically.',
              '- Compare baseline build CPU minutes if available. Do not deploy solely to run this analysis.',
              '- Keep existing required tests and a preview route for visually sensitive changes.', '']
    text = '\n'.join(lines)
    if args.out:
        args.out.write_text(text, encoding='utf-8')
        print(f'Wrote {args.out}')
    else:
        print(text)


if __name__ == '__main__':
    main()
