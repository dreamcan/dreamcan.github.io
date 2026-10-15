from pathlib import Path
import json,subprocess,hashlib
base=Path('/tmp/tts-hallucinations');base.mkdir(exist_ok=True)
source=Path('/tmp/bad_2.mp4');target=base/'bad_2_hold.mp4'
labels=['Blue blocks: 2 → 1','Yellow blocks: 2 → 3']
for i,text in enumerate(labels):(base/f'hold_label_{i}.txt').write_text(text)
filters=[]
for box in [dict(x=155,y=10,w=30,h=31,first=1,last=14),dict(x=176,y=18,w=61,h=38,first=1,last=7),dict(x=145,y=30,w=38,h=38,first=8,last=14)]:
 for color,t in [('white',3),('0x8c1515',1)]:filters.append(f"drawbox=x={box['x']}:y={box['y']}:w={box['w']}:h={box['h']}:color={color}:t={t}:enable='between(n,{box['first']},{box['last']})'")
for i,y in enumerate([108,130]):filters.append(f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile={base}/hold_label_{i}.txt:expansion=none:fontsize=11:fontcolor=0x8c1515:x=14:y={y}:box=1:boxcolor=white@0.94:boxborderw=4:enable='between(n,1,14)'")
complex_filter='[0:v]split=4[a][b][c][d];[a]trim=start_frame=0:end_frame=1,setpts=PTS-STARTPTS[lead];[b]trim=start_frame=1:end_frame=2,loop=loop=6:size=1:start=0,setpts=N/(4*TB)[hold1];[c]trim=start_frame=2:end_frame=3,loop=loop=6:size=1:start=0,setpts=N/(4*TB)[hold2];[d]trim=start_frame=3:end_frame=17,setpts=PTS-STARTPTS[tail];[lead][hold1][hold2][tail]concat=n=4:v=1:a=0[joined];[joined]setpts=N/(4*TB),'+','.join(filters)+'[output]'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-filter_complex',complex_filter,'-map','[output]','-an','-c:v','libx264','-crf','17','-preset','slow','-threads','2','-vsync','0','-movflags','+faststart',str(target)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=nb_frames,r_frame_rate,width,height','-show_entries','format=duration','-of','json',str(target)]));assert probe['streams'][0]['nb_frames']=='29',probe;assert abs(float(probe['format']['duration'])-7.25)<.01,probe
report={'trajectory':2,'source':'videos/tts/bad_2.mp4','output':'assets/experiments/tts/bad_2_hold.mp4','source_frame_count':17,'output_frame_count':29,'fps':4,'duration_seconds':7.25,'extra_hold_seconds':3,'holds':[{'source_frame':1,'start_seconds':.25,'end_seconds':2},{'source_frame':2,'start_seconds':2,'end_seconds':3.75}],'annotations_end_seconds':3.75,'resume_source_frame':3,'notes':'Each problem frame receives 1.5 extra seconds; annotations appear only while held, and are removed for all continuing frames. Original later frames retain original order and speed.','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(target.read_bytes()).hexdigest()};(base/'hold-traj2.json').write_text(json.dumps(report,indent=2)+'\n');print(probe,flush=True)
