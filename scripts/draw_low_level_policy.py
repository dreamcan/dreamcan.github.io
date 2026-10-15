#!/usr/bin/env python3
"""Draw the verified LIBERO-Long low-level policy as a standalone vector figure."""
from pathlib import Path
from html import escape
ROOT = Path(__file__).resolve().parents[1]
parts = ['''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 610" width="1500" height="610" role="img" aria-labelledby="title description">
<title id="title">Goal-conditioned low-level policy architecture</title>
<desc id="description">LIBERO-Long implementation: visual observation history is encoded with frozen RADIO local features and a language-modulated ResNet34 global feature. Generated subgoal RADIO features are compressed by a Perceiver into four tokens per subgoal. Observation, goal, projected proprioception and language tokens form a condition prefix. A ten-layer flow-matching Transformer attends to this prefix and predicts action velocities from noisy action tokens and flow time. Integration produces a sixteen-step robot action chunk.</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="#737373" stroke-width="1.5"/></marker><marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="#1565c0" stroke-width="1.5"/></marker></defs>
<style>text{font-family:Arial,Helvetica,sans-serif;fill:#202020;font-size:20px}.heading{font-size:23px;font-weight:600}.small{font-size:17px;fill:#737373}.label{font-weight:600}.red{fill:#8c1515}.blue{fill:#1565c0}.wire{fill:none;stroke:#737373;stroke-width:1.6;marker-end:url(#arrow)}.box{fill:white;stroke:#b8b8b8;stroke-width:1.3}</style>
<rect width="1500" height="610" fill="white"/>
''']
def text(x,y,value,kind='',anchor='middle'):
    parts.append(f'<text x="{x}" y="{y}" class="{kind}" text-anchor="{anchor}">{escape(value)}</text>')
def box(x,y,w,h,stroke=None,fill=None):
    style=(' stroke="'+stroke+'"' if stroke else '')+(' fill="'+fill+'"' if fill else '')
    # Explicit style overrides the shared base class.
    overrides=[]
    if stroke: overrides.append('stroke:'+stroke)
    if fill: overrides.append('fill:'+fill)
    parts.append(f'<rect class="box" x="{x}" y="{y}" width="{w}" height="{h}" style="{";".join(overrides)}"/>')
def arrow(path,dashed=False,blue=False):
    parts.append(f'<path class="wire" d="{path}"'+(' stroke-dasharray="6 5"' if dashed else '')+(' style="stroke:#1565c0;marker-end:url(#arrow-blue)"' if blue else '')+'/>')
for x,label in [(120,'Inputs'),(425,'Feature encoding'),(770,'Condition prefix'),(1060,'Action generation'),(1360,'Robot actions')]:
    text(x,50,label,'heading')
# Input branches.
box(25,150,190,100);text(120,185,'Observation','label');text(120,212,'history');text(120,236,'Multi-view images','small')
box(25,285,190,95,'#1565c0');text(120,319,'Visual subgoals','label blue');text(120,347,'ĝ₁, ĝ₂, …, ĝK');text(120,369,'From the planner','small')
box(25,420,190,65);text(120,458,'Robot state','label')
box(25,520,190,55);text(120,554,'Language ℓ','label')
# Encoders and per-subgoal compression.
box(270,150,320,100);text(430,180,'Observation features','label');text(430,209,'Frozen RADIO · local tokens','small');text(430,234,'FiLM-ResNet34 · global token','small')
box(270,285,320,95,'#1565c0','#e8f0f9');text(430,316,'Frozen RADIO → Perceiver','label blue');text(430,345,'4 latent tokens per subgoal','small');text(430,368,'Ordered future states','small')
box(270,420,320,65);text(430,458,'State MLP + normalization','small')
box(270,520,320,55);text(430,542,'Language encoder + projection','small');text(430,565,'Language token','small')
for y in [200,332,452,547]:arrow(f'M 215 {y} H 267',blue=y==332);arrow(f'M 590 {y} H 662',blue=y==332)
# The projected instruction modulates the trainable observation encoder.
arrow('M 615 547 V 116 H 430 V 147',True);text(430,105,'Language-conditioned FiLM','small')
box(665,145,210,430,'#1565c0','#e8f0f9');text(770,176,'Condition tokens','label blue')
for y,label in [(206,'Observation tokens'),(326,'Subgoal tokens'),(452,'State token'),(550,'Language token')]:
    text(770,y,label,'small')
# Token tiles are schematic; draw fewer observation tiles than subgoal tiles.
for y in [240]:
    for i in range(6):box(692+i*25,y,18,12,'#1565c0','#e8f0f9')
for y in [343,363]:
    for i in range(6):box(692+i*25,y,18,12,'#1565c0','#e8f0f9')
text(770,409,'Concatenate + positions','small')
# Prefix and noisy action streams meet in the single Transformer trunk.
arrow('M 875 355 H 932')
box(935,260,250,190,'#1565c0','#e8f0f9');text(1060,295,'Flow-matching','label blue');text(1060,325,'Transformer','label blue');text(1060,357,'10 layers · width 512','small');text(1060,385,'8 heads · adaLN-Zero','small');text(1060,425,'Linear velocity head','small')
box(950,145,220,70);text(1060,174,'Noisy actions xτ','label');text(1060,199,'Flow time τ → adaLN','small');arrow('M 1060 215 V 257')
arrow('M 1185 355 H 1257')
box(1260,295,215,120,'#8c1515','#f6ecec');text(1367,333,'Action chunk','label red');text(1367,365,'16 steps × 7-D actions','small');text(1367,395,'Execute → observe','small')
text(1202,494,'Integrate predicted velocities from noise to actions','small')
arrow('M 1367 418 V 520 H 1060 V 453',True);text(1208,544,'Repeated flow steps','small')
text(750,601,'Frozen visual features • Trainable goal compression and action policy • Independent of planner gradients','small')
parts.append('</svg>')
(ROOT/'assets/experiments/suite/architecture/low-level-policy.svg').write_text('\n'.join(parts)+'\n')
