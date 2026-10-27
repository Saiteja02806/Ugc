#!/usr/bin/env python3
"""UGCPilot read-only Codex preflight. Does not modify repository or claim files were reviewed by agent."""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

EXCLUDES = {
    '.chrome-carousel-upgrade-check', '.codex', '.codex-artifacts',
    '.codex-audits', '.git', '.next', '.playwright-mcp', '.release-worktrees',
    '.tmp', '.tools', '.turbo', '.venv', 'artifacts', 'build',
    'coverage', 'dist', 'edit-screen-audit', 'hatch-pet-runs',
    'landing_page', 'local-run-logs', 'node_modules', 'onboarding-flow-audit',
    'out', 'output', 'outputs', 'tmp', 'tmp-logs', 'venv',
}

def find_explore(root: Path):
    hits=[]
    for current, directories, files in os.walk(root, followlinks=False):
        directories[:] = [name for name in directories if name not in EXCLUDES]
        base=Path(current)
        for name in files:
            if not name.lower().endswith('.md'):
                continue
            normalized=re.sub(r'[ _-]+','',name).lower()
            if normalized == 'explorecontext.md':
                hits.append(base/name)
    return sorted(hits)

def read_info(path: Path):
    try:
        body=path.read_text(encoding='utf-8')
        return f'{path} [READABLE {len(body.splitlines())} lines, {len(body)} chars]'
    except Exception as exc:
        return f'{path} [UNREADABLE: {exc}]'

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--repo',default='.', help='Repository root')
    ap.add_argument('--task',default='',help='Current change request (for routing hints)')
    args=ap.parse_args()
    root=Path(args.repo).resolve()
    if not root.exists():
        print('ERROR: root does not exist:',root); return 2
    print('UGCPILOT PREFLIGHT (READ-ONLY)')
    print('Repo:',root)
    missing=[]
    paths=find_explore(root)
    if not paths:
        missing.append('REAL explore context.md not found')
        print('BLOCKER: REAL explore context.md not located; DO NOT fabricate a replacement.')
    else:
        print('Explore context candidates:')
        for p in paths: print(' -',read_info(p))
        if len(paths)>1: print('CAUTION: multiple context candidates; identify authoritative one before editing.')
    for rel in ['AGENTS.md','docs/ai-context/clear.md','docs/ai-context/nonnegotiables.md']:
        p=root/rel
        if not p.is_file():
            print('BLOCKER: missing:',rel); missing.append(rel)
        else: print('Required:',read_info(p))
    ledger=root/'docs/ai-context/clear.md'
    if ledger.is_file():
        body=ledger.read_text(encoding='utf-8')
        incident_ids=list(dict.fromkeys(re.findall(r'UGC-(?:UI|VID|SCH|OPS)-\d{3}', body)))
        print('Known incident IDs:',', '.join(incident_ids) or '(none)')
    q=args.task.lower()
    skillnames=['ugc-context-memory','ugc-immutable-contracts','ugc-regression-gate']
    if any(w in q for w in ['ui','component','frame preview','picker','button','layout','responsive','choose photos','change button','screen','tab']): skillnames+=['ugc-ui-clarity']
    if any(w in q for w in ['reference video','frame by frame','shot','video analysis','video reference']): skillnames+=['ugc-frame-analysis']
    if any(w in q for w in ['starting frame','middle frame','face','influencer','identity','frame selection']): skillnames+=['ugc-starting-frame']
    if any(w in q for w in ['prompt','recreate','generation','motion','video']): skillnames+=['ugc-video-prompt']
    if any(w in q for w in ['schedule','time','timezone','publish','post','instagram','tiktok']): skillnames+=['ugc-scheduling']
    print('Suggested full SKILL.md reads (routing hint, not automatic execution):')
    for name in dict.fromkeys(skillnames):
        path=root/'.agents'/'skills'/name/'SKILL.md'
        print(' -', str(path), 'OK' if path.is_file() else 'MISSING')
        if not path.is_file(): missing.append(f'skill: {name}')
    cp=subprocess.run(['git','status','--short'],cwd=root,capture_output=True,text=True,check=False)
    if cp.returncode==0:
        print('Git status:'); print(cp.stdout[:4000] or ' (clean)')
    else: print('Git status: not available (not a git repo or git missing)')
    print('IMPORTANT: Agent must itself READ the full context and skill documents; path existence is not sufficient.')
    if missing:
        print('FAIL: prerequisite(s) missing:', '; '.join(missing))
        return 2
    print('PASS: prerequisites discoverable/readable. No code changes performed.')
    return 0

if __name__=='__main__': sys.exit(main())
