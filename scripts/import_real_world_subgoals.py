#!/usr/bin/env python3
"""Import the nine verified DP annotations and generate clickable frame sequences."""
import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = '/media/gck/miniconda3/envs/maniladder/lib/python3.10/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'


def run(source):
    manifest = json.loads((source / 'export/manifest.json').read_text())
    records = manifest['records']
    assert len(records) == 9
    assert {(r['task'], r['trajectory']) for r in records} == {(t, i) for t in ['folding', 'packing', 'line'] for i in [1, 2, 3]}
    dest = ROOT / 'assets/experiments/real-world/subgoals'
    dest.mkdir(exist_ok=True)
    page = (ROOT / 'index.html').read_text()
    for r in records:
        video = ROOT / r['source']['video']
        assert hashlib.sha256(video.read_bytes()).hexdigest() == r['source']['sha256']
        steps = r['subgoal_timesteps']
        assert len(steps) == r['k'] and steps == sorted(set(steps)) and steps[-1] == r['frame_count'] - 1
        folder = dest / r['episode_id']
        folder.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            selection = '+'.join(f'eq(n,{t})' for t in steps)
            subprocess.run([FFMPEG, '-loglevel', 'error', '-i', str(video), '-vf', f"select='{selection}',scale=256:144",
                            '-vsync', '0', '-threads', '2', str(Path(tmp) / 'sg-%02d.png')], check=True)
            frames = sorted(Path(tmp).glob('*.png'))
            assert len(frames) == len(steps)
            for j, frame in enumerate(frames, 1):
                Image.open(frame).save(folder / f'subgoal-{j:02d}.webp', quality=88)
        r['thumbnails'] = [f"assets/experiments/real-world/subgoals/{r['episode_id']}/subgoal-{j:02d}.webp" for j in range(1, len(steps)+1)]
        values = source / r['values']
        assert hashlib.sha256(values.read_bytes()).hexdigest() == r['values_sha256']
        shutil.copy2(values, folder / 'values.npz')
        shutil.copy2(source / 'export' / f"{r['episode_id']}-variants.json", folder / 'variants.json')
        shutil.copy2(source / 'export' / f"{r['episode_id']}-dp-curves.png", folder / 'dp-curves.png')
        annotation = '<div class="real-subgoal-sequence"><div class="real-subgoal-header"><strong>Subgoal sequence</strong><span data-subgoal-status>Subgoal 1 / ' + str(r['k']) + '</span></div>'
        annotation += '<div class="real-subgoal-strip" role="group" aria-label="DP-selected subgoal sequence">'
        for j, (frame, seconds, image) in enumerate(zip(steps, r['subgoal_seconds'], r['thumbnails']), 1):
            annotation += f'<button type="button" class="real-subgoal-frame" data-subgoal-time="{seconds:.8f}" data-subgoal-frame="{frame}" aria-current="{"step" if j == 1 else "false"}" aria-label="Subgoal {j}, frame {frame}, {seconds:.2f} seconds" title="Subgoal {j} · {seconds:.2f} s"><img src="{html.escape(image)}" width="256" height="144" loading="lazy" alt="Subgoal {j}"><span>{j}</span></button>'
        annotation += '</div></div>'
        pattern = r'<figure\b[^>]*>(?:(?!</figure>).)*data-exp-asset="real-' + re.escape(r['episode_id']) + r'"(?:(?!</figure>).)*</figure>'
        match = re.search(pattern, page, flags=re.S)
        assert match, r['episode_id']
        figure = match.group()
        # Idempotently replace only our own sequence, preserving captions/video sources.
        figure = re.sub(r'<div class="real-subgoal-sequence">.*?</div></div>', '', figure, flags=re.S)
        figure = re.sub(r'^<figure\b[^>]*>', '<figure class="exp-figure" data-real-subgoals>', figure)
        figure = figure.replace('</video>', '</video>' + annotation)
        page = page[:match.start()] + figure + page[match.end():]
    if 'href="real-world-subgoals.css' not in page:
        page = page.replace('</head>', '<link rel="stylesheet" href="real-world-subgoals.css?v=20261012-dp">\n</head>')
    if 'src="real-world-subgoals.js' not in page:
        page = page.replace('</body>', '<script src="real-world-subgoals.js?v=20261012-dp"></script>\n</body>')
    (dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    shutil.copy2(source / 'input.json', dest / 'input.json')
    for task in ['folding', 'packing', 'line']:
        shutil.copy2(source / f'{task}-progress.json', dest / f'{task}-progress.json')
    source_manifest = ROOT / 'assets/experiments/real-world/source.json'
    provenance = json.loads(source_manifest.read_text())
    provenance['subgoal_annotation'] = {
        'manifest': 'assets/experiments/real-world/subgoals/manifest.json',
        'type': 'retrospective value/progress DP on each exact displayed recording',
        'original_videos_preserved': True,
    }
    source_manifest.write_text(json.dumps(provenance, indent=2) + '\n')
    (ROOT / 'index.html').write_text(page)
    print(f'Imported {len(records)} exact-video sequences / {sum(r["k"] for r in records)} subgoals.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    run(parser.parse_args().source)
