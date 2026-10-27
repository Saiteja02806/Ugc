#!/usr/bin/env python3
"""Extract source-video frames and contact sheets for evidence-based temporal review.

Requires ffmpeg, ffprobe and Pillow. Frame timestamps in sampled mode are NOMINAL
sample times; inspect original PTS near critical gestures for frame-accurate anchoring.
"""
import argparse
import csv
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path


def call(cmd, return_stderr=False):
    res=subprocess.run(cmd,capture_output=True,text=True)
    if res.returncode!=0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{res.stderr[-2000:]}")
    return res.stderr if return_stderr else res.stdout


def probe(video):
    raw=call(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)])
    return json.loads(raw)


def fps_number(rate):
    try:
        n,d=[float(x) for x in rate.split('/')]
        return n/d if d else None
    except Exception:return None


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('video',type=Path)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--every',type=float,default=0.25,help='Nominal seconds between sampled frames (default 0.25)')
    p.add_argument('--native-fps',action='store_true',help='Extract every decoded frame (may be very large)')
    p.add_argument('--max-frames',type=int,default=1800,help='Safety ceiling (estimate and actual)')
    p.add_argument('--sheet-cols',type=int,default=5)
    a=p.parse_args()
    if not a.video.is_file():p.error('Input video is missing')
    if a.every<=0 or a.max_frames<1 or a.sheet_cols<1:p.error('invalid sampling params')
    for program in ('ffmpeg','ffprobe'):
        if not shutil.which(program):p.error(program+' is required')
    try: from PIL import Image,ImageDraw
    except ImportError:p.error('Pillow is required')
    data=probe(a.video)
    video_stream=next((x for x in data.get('streams',[]) if x.get('codec_type')=='video'),None)
    if not video_stream:p.error('no video stream')
    fps=fps_number(video_stream.get('avg_frame_rate','')) or fps_number(video_stream.get('r_frame_rate',''))
    dur=float(data['format'].get('duration') or video_stream.get('duration') or 0)
    if dur<=0:p.error('could not get positive duration')
    interval=(1/fps) if a.native_fps and fps else a.every
    expected=math.ceil(dur/interval)+2
    if expected>a.max_frames:
        p.error(f'Estimated {expected} frames > max {a.max_frames}; increase --max-frames deliberately or sample less often')
    out=a.out.resolve()
    out.mkdir(parents=True,exist_ok=True)
    frames=out/'frames'; frames.mkdir(exist_ok=True)
    if list(frames.glob('frame_*.jpg')):
        p.error('Output frames directory already contains extracted frames. Choose a new --out.')
    if a.native_fps:
        vf='showinfo,scale=640:-2'
    else:
        vf=f'fps={1.0/a.every:.12g},showinfo,scale=640:-2'
    cmd=['ffmpeg','-hide_banner','-loglevel','info','-i',str(a.video),'-an','-vf',vf,
         '-fps_mode','vfr','-q:v','3',str(frames/'frame_%06d.jpg')]
    ffmpeg_log=call(cmd, return_stderr=True)
    pts_by_index={}
    for match in re.finditer(r'showinfo[^\n]*?\bn:\s*(\d+)[^\n]*?\bpts_time:\s*([\d.eE+\-]+)', ffmpeg_log):
        pts_by_index[int(match.group(1))]=float(match.group(2))
    files=sorted(frames.glob('frame_*.jpg'))
    if len(files)>a.max_frames:
        p.error('Actual frame count exceeded ceiling; delete output and rerun with larger sampling interval')
    metadata={'source':str(a.video.resolve()),'duration_sec':dur,'source_fps_approx':fps,
              'sample_interval_nominal_sec':interval,'native_fps_extraction':a.native_fps,
              'frame_count':len(files),'source_resolution':[video_stream.get('width'),video_stream.get('height')],
              'timestamp_warning':'showinfo PTS are actual output-frame PTS; sampled fps filter may snap/copy source frames. Confirm original input packet/frame PTS near the chosen anchor before frame-accurate prompt design.'}
    (out/'source_metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    manifest=[]
    with (out/'observations.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.writer(f)
        w.writerow(['frame','nominal_source_t_sec','output_pts_time_sec','camera/framing','face/head/gaze','hand/body/action','expression','occlusion','overlay_text','certainty','reviewer_notes'])
        for i,frame in enumerate(files):
            t=round(i*interval,5)
            pts=pts_by_index.get(i)
            manifest.append({'frame_file':str(frame.relative_to(out)),'nominal_source_t_sec':t,'output_pts_time_sec':pts})
            w.writerow([str(frame.relative_to(out)),f'{t:.5f}',f'{pts:.5f}' if pts is not None else '','','','','','','','',''])
    (out/'frame_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    thumb_width,thumb_height=220,175
    cols=a.sheet_cols
    rows_per_sheet=6
    per_sheet=cols*rows_per_sheet
    for page_index in range(math.ceil(len(files)/per_sheet)):
        part=files[page_index*per_sheet:(page_index+1)*per_sheet]
        sheet=Image.new('RGB',(cols*thumb_width,math.ceil(len(part)/cols)*thumb_height),'#f2f2f2')
        d=ImageDraw.Draw(sheet)
        for k,fp in enumerate(part):
            with Image.open(fp) as im:
                im.thumbnail((thumb_width-8,thumb_height-28))
                xx=(k%cols)*thumb_width+(thumb_width-im.width)//2
                yy=(k//cols)*thumb_height+4
                sheet.paste(im,(xx,yy))
            idx=page_index*per_sheet+k
            d.text(((k%cols)*thumb_width+6,(k//cols)*thumb_height+thumb_height-19),f'#{idx} ~{idx*interval:.2f}s',fill='#111111')
        sheet.save(out/f'contact_sheet_{page_index+1:03d}.jpg',quality=87)
    print(f'Extracted {len(files)} frames; review sheets saved in: {out}')
    print(f'Frame output PTS recorded for {len(pts_by_index)}/{len(files)} frames in manifest (if available).')
    print('IMPORTANT: Sampled output PTS may not equal original source frame PTS; no visual analysis has been performed.')
    print('Fill observations.csv after visually reviewing frames, and confirm source timestamps on original clip before generation.')
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except RuntimeError as exc:print('ERROR:',exc,file=sys.stderr);sys.exit(1)
