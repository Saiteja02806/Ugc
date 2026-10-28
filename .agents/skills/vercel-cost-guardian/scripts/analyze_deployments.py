#!/usr/bin/env python3
"""Summarize exported Vercel deployment data without network or secrets.

Accept Vercel-like `{"result":{"deployments":{"deployments":[...]}}}` or
normalized array. Never derive billable CPU minutes from wall-clock duration.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path


def unwrap(data):
    if isinstance(data, list):
        return data
    if not isinstance(data, dict):
        raise ValueError('Expected object or list')
    for key in ('result', 'deployments'):
        if key in data:
            candidate = data[key]
            if isinstance(candidate, (list, dict)):
                return unwrap(candidate)
    raise ValueError('Could not find deployment records; expected a list or object with result/deployments keys')


def value(obj, *keys):
    for key in keys:
        if key in obj and obj[key] is not None:
            return obj[key]
    return None


def numeric(item, *fields):
    x = value(item, *fields)
    if isinstance(x, (float, int)) and not isinstance(x, bool) and x >= 0:
        return float(x)
    return None


def normalize(obj):
    meta = obj.get('meta') or {}
    if not isinstance(meta, dict):
        meta = {}
    project = value(obj, 'project', 'name', 'projectName', 'projectId')
    if isinstance(project, dict):
        project = value(project, 'name', 'id')
    sha = value(obj, 'sha', 'gitSha', 'commitSha') or value(meta, 'githubCommitSha', 'gitlabCommitSha', 'bitbucketCommitSha')
    # Only explicit authoritative fields count. Do NOT substitute 'duration' or timestamps.
    cpu = numeric(obj, 'cpuMinutes', 'buildCpuMinutes', 'billableCpuMinutes', 'cpuMinutesUsage')
    duration = numeric(obj, 'billableDurationMinutes')
    created = value(obj, 'created', 'createdAt', 'timestamp')
    if isinstance(created, (int, float)):
        if created > 1e11:
            created = created / 1000.0
        created = datetime.fromtimestamp(created, tz=timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    return {'project': str(project or 'UNKNOWN'), 'sha': str(sha or 'UNKNOWN'),
            'target': str(value(obj, 'target', 'environment') or 'preview/unknown'),
            'state': str(value(obj, 'state', 'readyState', 'status') or 'UNKNOWN').upper(),
            'cpu': cpu, 'duration': duration, 'created': str(created or 'UNKNOWN'),
            'url': str(value(obj, 'inspectorUrl', 'url', 'id') or 'UNKNOWN')}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input', type=Path, required=True, help='JSON deployment export')
    ap.add_argument('--out', type=Path, help='Markdown output path, defaults to stdout')
    ap.add_argument('--usd-per-cpu-minute', type=float, default=None,
                    help='Optional **verified** rate; never guess or use stale pricing.')
    args = ap.parse_args()
    if args.usd_per_cpu_minute is not None and args.usd_per_cpu_minute < 0:
        ap.error('Rate must be nonnegative')
    try:
        rows = [normalize(x) for x in unwrap(json.loads(args.input.read_text(encoding='utf-8')))
                if isinstance(x, dict)]
    except (OSError, ValueError, json.JSONDecodeError, OverflowError) as exc:
        ap.error(f'Cannot read deployment records: {exc}')
    if not rows:
        ap.error('No deployment records found')

    by_project = defaultdict(list)
    by_sha = defaultdict(set)
    repeated = defaultdict(list)
    for r in rows:
        by_project[r['project']].append(r)
        if r['sha'] != 'UNKNOWN':
            by_sha[r['sha']].add(r['project'])
            repeated[(r['project'], r['sha'], r['target'])].append(r)

    cpu_known = sum(r['cpu'] is not None for r in rows)
    total_cpu = sum(r['cpu'] for r in rows if r['cpu'] is not None)
    states = Counter(r['state'] for r in rows)
    lines = [
        '# Vercel Deployment History Audit', '',
        f'- Records provided: **{len(rows)}** (may be a partial/paginated export).',
        f'- Date range in records: {min(r["created"] for r in rows)} through {max(r["created"] for r in rows)} (format is source-dependent).',
        f'- States: {", ".join(f"{k}={v}" for k, v in sorted(states.items()))}.',
        f'- Explicit CPU-minute readings: **{cpu_known}/{len(rows)}**.',
        '- No live API connection, project-domain verification, or billing record reconciliation performed.', '',
        '## By project', '',
        '| Project | Deployments | READY | ERROR | CANCELED | Known CPU minutes | Missing CPU data |',
        '|---|---:|---:|---:|---:|---:|---:|'
    ]
    for project, rs in sorted(by_project.items(), key=lambda x: -len(x[1])):
        nums = [r['cpu'] for r in rs if r['cpu'] is not None]
        known_cpu = f'{sum(nums):.2f}' if nums else 'UNKNOWN'
        lines.append(f'| {project.replace("|", "/")} | {len(rs)} | {sum(r["state"]=="READY" for r in rs)} | '
                     f'{sum(r["state"]=="ERROR" for r in rs)} | {sum(r["state"]=="CANCELED" for r in rs)} | '
                     f'{known_cpu} | {len(rs)-len(nums)} |')
    lines += ['', '## Signals', '']
    signals = 0
    for sha, projects in sorted(by_sha.items(), key=lambda x: -len(x[1])):
        if len(projects) >= 2:
            signals += 1
            lines.append(f'- **Cross-project fanout:** `{sha[:12]}` triggered {len(projects)} projects: '
                         f'{", ".join(sorted(projects))}. Confirm project roles and dependency graph before calling this waste.')
    for (project, sha, target), group in sorted(repeated.items(), key=lambda x: -len(x[1])):
        if len(group) >= 2:
            signals += 1
            lines.append(f'- **Multiple deployments of same project/SHA/target:** {project}, `{sha[:12]}`, '
                         f'{target}: {len(group)} records. Check redeploys, cancels and triggers.')
    for project, group in by_project.items():
        errors = [r for r in group if r['state'] == 'ERROR']
        if len(errors) >= 3:
            signals += 1
            lines.append(f'- **Repeated failures:** {project} has {len(errors)} ERROR builds within supplied records. '
                         f'Inspect first failing step and domain/dependency use.')
    if not signals:
        lines.append('No deployment-frequency patterns met this script’s thresholds; real account-side issues may still exist.')

    lines += ['', '## Cost evidence', '']
    if cpu_known == len(rows):
        lines.append(f'- All exported deployments have explicit reported CPU minutes, totaling **{total_cpu:.2f} CPU minutes**.')
    elif cpu_known:
        lines.append(f'- Known subtotal: **{total_cpu:.2f} CPU minutes** from {cpu_known} deployments. '
                     'The missing records prevent a complete total.')
    else:
        lines.append('- **UNKNOWN:** Export omitted explicit billable CPU-minute metrics. '
                     'Inspect deployments in Vercel or fetch authorized billing details; do not extrapolate from wall-clock time.')
    if args.usd_per_cpu_minute is not None and cpu_known == len(rows):
        lines.append(f'- Illustrative estimate using USER-VERIFIED rate ${args.usd_per_cpu_minute:.6f}/CPU-minute: '
                     f'**${total_cpu * args.usd_per_cpu_minute:.2f}** (not a statement of invoice charges or included credits).')
    elif args.usd_per_cpu_minute is not None:
        lines.append('- Dollars UNKNOWN because the export omits some or all CPU-minute readings.')
    else:
        lines.append('- Dollars UNKNOWN: no verified CPU-minute rate or actual billed costs were supplied.')
    lines += ['', '## Next actions', '- Reconcile records with Vercel dashboard Build Diagnostics and Billing usage by project.',
              '- Check project domains, root folders, branch mappings and machine types.',
              '- Identify unnecessary deployment triggers and measure the CPU minutes for confirmed redundant builds.',
              '- Do not change production settings or remove projects without approval and rollback plan.', '']
    report = '\n'.join(lines)
    if args.out:
        args.out.write_text(report, encoding='utf-8')
        print(f'Wrote {args.out}')
    else:
        print(report)


if __name__ == '__main__':
    main()
