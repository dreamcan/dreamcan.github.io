#!/usr/bin/env python3
"""Verify and import real Dense/Uniform videos into previously empty slots.

Run with ffmpeg and ffprobe available. A candidate asset directory needs a copy
of the current planning manifest.json; existing filled slots are never replaced.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=Path, required=True)
    parser.add_argument('--generated', type=Path, required=True)
    parser.add_argument('--planning-root', type=Path, required=True)
    args = parser.parse_args()
    root = args.planning_root
    manifest_path = root / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    tasks = {t['id']: t for t in manifest['tasks']}
    pending = []
    count = 0
    for job in json.loads(args.jobs.read_text())['jobs']:
        generation = json.loads((args.generated / (job['id'] + '-generation.json')).read_text())
        method = job['method']
        assert generation['method'] == method and generation['task'] == job['task']
        assert generation['checkpoint'] == job['checkpoint']
        assert generation['actualMethod'] == ('Uniform planning' if method == 'uniform' else 'Dense planning')
        samples = {s['episode']: s for s in tasks[job['task']]['examples']}
        assert len(generation['examples']) == len(job['examples']) == 3
        for record in generation['examples']:
            sample = samples[record['episode']]
            assert sample['media'][method] is None, 'Refusing to replace an existing video'
            assert record['sourceInstruction'] == sample['sourceInstruction']
            assert Path(record['condition']) == Path(sample['media']['ours']['source']).parent / 'condition.png'
            video = args.generated / record['video']
            poster = args.generated / record['poster']
            digest = hashlib.sha256(video.read_bytes()).hexdigest()
            assert digest == record['sha256'] and poster.is_file()
            info = json.loads(subprocess.check_output([
                'ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=codec_name,width,height,nb_frames,r_frame_rate:format=duration',
                '-of', 'json', str(video)], text=True))
            stream = info['streams'][0]
            assert stream['width'] == generation['width'] == 320
            assert stream['height'] == generation['height'] == 192
            expected_frames = 1 + len(generation['outputFrameIndices']) * job['stages']
            assert int(stream['nb_frames']) == record['frameCount'] == expected_frames
            assert abs(float(info['format']['duration']) - record['duration']) < .01
            numerator, denominator = map(int, stream['r_frame_rate'].split('/'))
            assert numerator / denominator == generation['fps']
            pixels = subprocess.check_output([
                'ffmpeg', '-v', 'error', '-i', str(video.parent / (method + '-condition.png')),
                '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
            assert hashlib.sha256(pixels).hexdigest() == record['conditionPixelsSha256']
            first = subprocess.check_output([
                'ffmpeg', '-v', 'error', '-i', str(video), '-frames:v', '1',
                '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
            assert len(first) == len(pixels) == 320 * 192 * 3
            assert sum(abs(a - b) for a, b in zip(first, pixels)) / len(pixels) < 5
            sample['media'][method] = {
                'video': record['video'], 'poster': record['poster'], 'source': record['source'],
                'sha256': digest, 'codec': stream['codec_name'], 'width': 320, 'height': 192,
                'frameCount': record['frameCount'], 'fps': generation['fps'],
                'duration': record['duration'], 'actualMethod': generation['actualMethod'],
                'checkpoint': generation['checkpoint'], 'checkpointSha256': generation['checkpointSha256'],
                'baseModel': generation['baseModel'], 'numStages': job['stages'],
                'numFramesPerCall': 65, 'numInferenceSteps': 40, 'cfgScale': 1.0,
                'stageSeeds': generation['stageSeeds'], 'outputFrameIndices': generation['outputFrameIndices'],
                'testTimeSearch': False, 'temporaryPlaceholder': False,
                'conditionSource': record['condition'], 'conditionSha256': record['conditionSha256'],
                'conditionPixelsSha256': record['conditionPixelsSha256'],
            }
            for source in [video, poster, video.parent / (method + '-generation.json')]:
                pending.append((source, root / source.relative_to(args.generated)))
            count += 1
        pending.append((args.generated / (job['id'] + '-generation.json'),
                        root / (job['id'] + '-evaluation.json')))
    assert count == 9
    assert all(s['media'][method] for t in manifest['tasks'] for s in t['examples']
               for method in ['ours', 'dense', 'uniform', 'vlp'])
    for source, target in pending:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    manifest['missingMedia'] = (
        'No empty display slots. Genuine VLP outputs remain unavailable; VLP slots retain '
        'the previously generated temporary Dense checkpoint videos.')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print('Verified and imported 9 Dense/Uniform videos; all representative display slots filled.')


if __name__ == '__main__':
    main()
