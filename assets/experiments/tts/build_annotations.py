from pathlib import Path
import subprocess,json,hashlib
out=Path('/tmp/tts-hallucinations');out.mkdir(exist_ok=True)
specs=[
 {'trajectory':0,'labels':[{'text':'Blue blocks: 2 → 1','first_frame':14,'last_frame':16,'y':118}], 'boxes':[{'x':192,'y':20,'w':29,'h':32,'first_frame':14,'last_frame':16}]},
 {'trajectory':1,'labels':[{'text':'Blue blocks: 2 → 3','first_frame':14,'last_frame':16,'y':118}], 'boxes':[{'x':128,'y':22,'w':21,'h':25,'first_frame':14,'last_frame':14},{'x':140,'y':44,'w':20,'h':25,'first_frame':15,'last_frame':15},{'x':195,'y':27,'w':25,'h':29,'first_frame':14,'last_frame':16},{'x':221,'y':11,'w':25,'h':30,'first_frame':14,'last_frame':16}]},
 {'trajectory':2,'labels':[{'text':'Blue blocks: 2 → 1','first_frame':1,'last_frame':16,'y':108},{'text':'Yellow blocks: 2 → 3','first_frame':1,'last_frame':16,'y':130}], 'boxes':[{'x':155,'y':10,'w':30,'h':31,'first_frame':1,'last_frame':16},{'x':176,'y':18,'w':61,'h':38,'first_frame':1,'last_frame':1},{'x':145,'y':30,'w':38,'h':38,'first_frame':2,'last_frame':2},{'x':154,'y':30,'w':33,'h':48,'first_frame':3,'last_frame':16}]}
]
for spec in specs:
 traj=spec['trajectory'];filters=[]
 for box in spec['boxes']:
  for color,thickness in [('white',3),('0x8c1515',1)]:
   filters.append(f"drawbox=x={box['x']}:y={box['y']}:w={box['w']}:h={box['h']}:color={color}:t={thickness}:enable='between(n,{box['first_frame']},{box['last_frame']})'")
 for i,label in enumerate(spec['labels']):
  text=out/f'traj{traj}_label{i}.txt';text.write_text(label['text'])
  filters.append(f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile={text}:expansion=none:fontsize=11:fontcolor=0x8c1515:x=14:y={label['y']}:box=1:boxcolor=white@0.94:boxborderw=4:enable='between(n,{label['first_frame']},{label['last_frame']})'")
 source=Path(f'/tmp/bad_{traj}.mp4');target=out/f'bad_{traj}_annotated.mp4'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-vf',','.join(filters),'-an','-c:v','libx264','-crf','17','-preset','slow','-threads','2','-vsync','0','-movflags','+faststart',str(target)],check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=nb_frames,r_frame_rate,width,height','-show_entries','format=duration','-of','json',str(target)]))
 assert probe['streams'][0]['nb_frames']=='17';assert probe['streams'][0]['r_frame_rate']=='4/1';assert abs(float(probe['format']['duration'])-4.25)<.01
 spec.update({'source':f'videos/tts/bad_{traj}.mp4','output':f'assets/experiments/tts/bad_{traj}_annotated.mp4','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'fps':4,'frame_count':17,'duration_seconds':4.25})
 print('Annotated trajectory',traj,flush=True)
(out/'annotations.json').write_text(json.dumps({'style':'White-underlaid Stanford-red boxes and timed block-count labels. Display derivatives; original videos remain unchanged.','frame_numbering':'Zero-based; frame 0 is the conditioning observation.','records':specs},ensure_ascii=False,indent=2)+'\n')
