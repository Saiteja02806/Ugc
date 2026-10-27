#!/usr/bin/env python3
"""Validate skill frontmatter, required files, and expected skill names without external deps."""
import argparse
import re
import sys
from pathlib import Path

EXPECTED={
 'ugc-context-memory','ugc-ui-clarity','ugc-immutable-contracts','ugc-frame-analysis',
 'ugc-starting-frame','ugc-video-prompt','ugc-scheduling','ugc-regression-gate'
}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--root',default='.')
    args=p.parse_args()
    root=Path(args.root)
    errors=[]
    skill_dir=root/'.agents'/'skills'
    present=set()
    for path in sorted(skill_dir.glob('*/SKILL.md')):
        present.add(path.parent.name)
        text=path.read_text(encoding='utf-8')
        m=re.match(r'^---\n(.*?)\n---\n',text,re.S)
        if not m:
            errors.append(f'{path}: missing YAML frontmatter')
            continue
        front=m.group(1)
        nm=re.search(r'^name:\s*(.+)$',front,re.M)
        desc=re.search(r'^description:\s*(.+)$',front,re.M)
        if not nm or nm.group(1).strip() != path.parent.name:
            errors.append(f'{path}: name must match parent directory')
        if not desc or len(desc.group(1).strip()) < 45:
            errors.append(f'{path}: missing/unclear trigger description')
        if len(text) < 900:
            errors.append(f'{path}: suspiciously short')
        print('Skill:', path.parent.name, 'OK' if not any(str(path) in x for x in errors) else 'INVALID')
    for name in sorted(EXPECTED-present): errors.append('Missing skill: '+name)
    for name in sorted(present-EXPECTED): print('Additional installed skill:', name)
    for rel in ['AGENTS.md','README.md','docs/ai-context/clear.md', 'docs/ai-context/nonnegotiables.md',
                'docs/ai-context/scheduling-contract.md','docs/ai-context/ui-baseline-and-states.md']:
        if not (root/rel).is_file():errors.append('Missing contract/document: '+rel)
    for err in errors: print('ERROR:',err)
    print(f'{len(present)} skills found; {len(errors)} validation error(s).')
    return 1 if errors else 0

if __name__=='__main__': sys.exit(main())
