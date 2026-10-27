#!/usr/bin/env python3
"""Fail on chronologically inconsistent continue-from-anchor generated video plans."""
import argparse
import json
import math
import sys
from pathlib import Path


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('spec',type=Path,help='JSON temporal generation plan')
    parser.add_argument('--tolerance-sec', type=float, default=0.08)
    a=parser.parse_args()
    data=json.loads(a.spec.read_text(encoding='utf-8'))
    errors=[]
    mode=data.get('mode')
    if mode not in {'continue_from_anchor','full_video_multisegment'}:
        errors.append('mode must be continue_from_anchor or full_video_multisegment')
    anchor=data.get('source_anchor_sec')
    try: anchor=float(anchor)
    except (ValueError,TypeError): errors.append('source_anchor_sec must be numeric'); anchor=0
    if anchor<0: errors.append('source_anchor_sec must be nonnegative')
    segments=data.get('segments')
    if not isinstance(segments,list) or not segments:
        errors.append('at least one segment required');segments=[]
    valid_segments=0
    for i, segment in enumerate(segments):
        events=segment.get('timeline_events',[])
        try: seg_anchor=float(segment.get('source_anchor_sec'))
        except (ValueError,TypeError): errors.append(f'segment {i}: numeric source_anchor_sec missing');continue
        if not events:
            errors.append(f'segment {i}: no timeline events');continue
        valid_segments+=1
        lastgen=-1
        for j,e in enumerate(events):
            try:
                g=float(e['generated_start_sec']);s=float(e['source_start_sec'])
            except (KeyError,ValueError,TypeError):errors.append(f'segment {i} event {j}: invalid time');continue
            if g<0 or s<0 or g<lastgen:
                errors.append(f'segment {i} event {j}: invalid/non-monotonic times')
            if not math.isclose(s,seg_anchor+g,abs_tol=a.tolerance_sec):
                errors.append(f'segment {i} event {j}: source {s:.3f} vs anchor+generated {seg_anchor+g:.3f}')
            lastgen=g
    if mode=='continue_from_anchor':
        if len(segments)!=1:errors.append('continue mode requires exactly one segment')
        elif abs(float(segments[0].get('source_anchor_sec',-100))-anchor)>a.tolerance_sec:
            errors.append('segment anchor differs from selected image anchor')
    if mode=='full_video_multisegment':
        if anchor>0 and len(segments)<2:errors.append('full-video with mid-anchor requires an early segment plus post-anchor segment')
        if segments:
            try:
                start=min(float(s.get('source_anchor_sec')) for s in segments)
                if start>a.tolerance_sec:errors.append('full video segments do not begin at source 0')
            except (ValueError,TypeError): errors.append('invalid segment anchors')
            if anchor>0 and not any(abs(float(s.get('source_anchor_sec',-100))-anchor)<=a.tolerance_sec for s in segments):
                errors.append('no post-anchor segment anchored at the selected middle frame')
    if valid_segments!=len(segments): errors.append('some segments were not valid')
    for issue in errors: print('FAIL:',issue)
    if errors:return 1
    print(f'PASS: {mode} temporal mapping for {len(segments)} segment(s). This checks TIME CONSISTENCY ONLY, not actual action/video accuracy.')
    return 0

if __name__=='__main__':sys.exit(main())
