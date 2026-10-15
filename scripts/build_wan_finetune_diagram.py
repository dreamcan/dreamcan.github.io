"""Build a native SVG of DreamCan's sparse-target Wan fine-tuning pipeline."""
from pathlib import Path
import base64
import html
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets/method/wan-finetune'
parts=['''<svg xmlns="http://www.w3.org/2000/svg" width="1450" height="630" viewBox="0 0 1450 630" role="img" aria-labelledby="wan-title wan-desc">
<title id="wan-title">Fine-tuning Wan on discrete subgoal images</title>
<desc id="wan-desc">A current observation and sparse subgoal targets are packed by repeating each target four times. A frozen causal 3D VAE maps 1 plus 4N images to N plus 1 aligned latent slots. A clean observation or accepted subgoal prefix conditions the Wan2.2-TI2V-5B DiT, while noise is added to remaining targets. Only LoRA adapters are trained, using a masked flow-matching loss on future slots. The text encoder and VAE stay frozen.</desc>
<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 7 3.5 0 7Z" fill="#1565c0"/></marker><marker id="update" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 7 3.5 0 7Z" fill="#8c1515"/></marker>
<style>text{font-family:Arial,Helvetica,sans-serif;fill:#202020;text-anchor:middle}.heading{font-size:18px;font-weight:600;fill:#202020}.detail{font-size:16px;fill:#585858}.math{font-family:"Times New Roman","STIX Two Math",serif;font-size:22px}.wire{fill:none;stroke:#1565c0;stroke-width:1.25;marker-end:url(#arrow);stroke-linejoin:miter}.update{stroke:#8c1515;stroke-dasharray:4 2;marker-end:url(#update)}.panel{fill:#fff;stroke:#909090;stroke-width:1}.frozen{fill:#fff;stroke:#737373;stroke-width:1.1;stroke-dasharray:4 3}.latent{fill:#E8F0F9;stroke:#737373;stroke-width:1.1}.lora{fill:#F6ECEC;stroke:#8c1515;stroke-width:1.1}.warm{fill:#202020}.prefix{fill:#E8F0F9;stroke:#1565c0;stroke-width:1}.suffix{fill:#F6ECEC;stroke:#8c1515;stroke-width:1}.anchor{fill:#fff;stroke:#1565c0;stroke-width:1}</style></defs>
<rect width="1450" height="630" fill="white"/>''']
def rect(x,y,w,h,cls='panel',rx=1):parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="1" class="{cls}"/>')
def text(x,y,t,cls='detail',size=None):parts.append(f'<text x="{x}" y="{y}" class="{cls}"'+(f' style="font-size:{size}px"' if size else '')+'>'+html.escape(t)+'</text>')
def path(d,cls='wire'):parts.append(f'<path d="{d}" class="{cls}"/>')
def photo(name,x,y,w,h):
 src=base64.b64encode((ASSETS/(name+'.jpg')).read_bytes()).decode()
 parts.append(f'<image href="data:image/jpeg;base64,{src}" x="{x}" y="{y}" width="{w}" height="{h}"/>')
for x,w,title in [(24,204,'(a) Sparse supervision'),(274,250,'(b) Repeat targets ×4'),(570,146,'(c) Encode'),(762,206,'(d) Latent partition')]:text(x+w/2,48,title,'heading')
rect(24,80,204,375);text(126,113,'Current observation');photo('observation',78,130,96,96);text(126,248,'oₜ','math');text(126,280,'Future targets')
for name,x,label in [('subgoal-1',38,'g₁'),('subgoal-2',103,'g₂'),('subgoal-last',168,'gₙ')]:photo(name,x,296,46,46);text(x+23,369,label,'math')
text(158,331,'…','math',19);text(126,427,'One frame per target')
rect(274,80,250,375);text(399,112,'Observation stays single');photo('observation',380,126,38,38);text(437,151,'oₜ','math')
for n,(name,label) in enumerate([('subgoal-1','g₁'),('subgoal-2','g₂'),('subgoal-last','gₙ')]):
 y=191+n*69
 for repeat in range(4):photo(name,288+repeat*47,y,40,40)
 text(499,y+26,label,'math',20)
text(399,318,'⋮','math',18);text(399,407,'4 copies → 1 latent slot');text(399,435,'1 + 4N input frames','math',20)
path('M228 276H274');path('M524 276H570')
rect(570,177,146,213,'frozen');text(643,220,'Frozen','heading',18);text(643,257,'Causal 3D');text(643,283,'VAE','heading',23);text(643,322,'Temporal');text(643,347,'compression ×4')
path('M716 276H762')
rect(762,80,206,425);text(865,114,'One slot per target')
# Explicit clean-prefix / supervised-suffix partition of the same latent sequence.
rect(775,124,180,180,'prefix',7);text(865,143,'Clean prefix','heading',16)
for y,label in [(153,'z(oₜ)'),(199,'z(g₁)'),(253,'z(gₚ)')]:rect(787,y,156,35,'anchor',5);text(865,y+24,label,'math',20)
text(865,246,'⋮','math',17);text(865,301,'σ = 0 · no loss',size=13)
rect(775,322,180,138,'suffix',7);text(865,344,'Future suffix','heading',16)
for y,label in [(354,'z(gₚ₊₁)'),(408,'z(gₙ)')]:rect(787,y,156,35,'latent',5);text(865,y+24,label,'math',20)
text(865,402,'⋮','math',17);text(865,457,'Add noise · apply loss',size=13)
text(865,490,'N + 1 latent slots','math',20)
path('M955 219H994V245H1016')
rect(1030,18,192,43,'panel',7);text(1126,46,'Instruction ℓ','heading',18);path('M1126 61V80')
rect(1016,80,220,90,'frozen');text(1126,116,'Frozen text encoder','heading',18);text(1126,146,'Language context');path('M1126 170V215')
rect(1016,215,220,195,'latent');text(1126,246,'Wan2.2-TI2V-5B','heading',19);text(1126,278,'DiT · frozen backbone');rect(1034,305,184,47,'lora',7);text(1126,335,'Trainable LoRA','heading',18);text(1126,386,'Predict flow velocity')
rect(762,510,206,94,'latent');text(865,541,'Noise future slots');text(865,573,'zσ = (1−σ)z + σε','math',18);path('M775 421H743V557H762');path('M968 544H993V350H1016')
rect(1110,472,126,48);text(1173,503,'Timestep σ','math',20);path('M1173 472V410')
path('M1236 310H1282');text(1259,293,'vθ','math',18)
rect(1282,215,144,195,'lora');text(1354,251,'Flow matching','heading',17);text(1354,293,'MSE','math',25);text(1354,334,'Supervise only');text(1354,362,'future slots')
path('M968 585H1400V410');text(1250,575,'Target: ε − z','math',20)
path('M1354 410V445H1248V329H1218','wire update');text(1340,471,'LoRA update','detail',15)
rect(24,516,670,104,'panel',9);text(359,537,'Random clean-prefix conditioning','heading',17)
rect(38,549,306,34,'prefix',5);text(191,573,'z(oₜ), z(g₁), …, z(gₚ)','math',19)
rect(358,549,322,34,'suffix',5);text(519,573,'z(gₚ₊₁), …, z(gₙ)','math',19)
text(191,604,'Loss mask: 0  0  …  0',size=16);text(519,604,'Loss mask: 1  …  1',size=16)
parts.append('</svg>');(ASSETS/'wan-finetune.svg').write_text('\n'.join(parts)+'\n')
