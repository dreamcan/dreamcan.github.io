#!/usr/bin/env python3
"""Import verified alternate Dense rollouts into the website's temporary VLP slots."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--generated', type=Path, required=True)
    parser.add_argument('--planning-root', type=Path,
                        default=Path(__file__).resolve().parents[1] / 'assets/experiments/planning')
    args = parser.parse_args()
    root = args.planning_root
    manifest_file = root / 'manifest.json'
    manifest = json.loads(manifest_file.read_text())
    pending = []
    for task in manifest['tasks']:
        generation = json.loads((args.generated / f"{task['id']}-generation.json").read_text())
        assert generation['actualMethod'] == 'Dense planning'
        assert generation['temporarySlot'] == 'VLP'
        records = {r['episode']: r for r in generation['examples']}
        for sample in task['examples']:
            record = records[sample['episode']]
            assert record['sourceInstruction'] == sample['sourceInstruction']
            source_dir = Path(sample['media']['ours']['source']).parent
            assert Path(record['condition']) == source_dir / 'condition.png'
            video = args.generated / record['video']
            poster = args.generated / record['poster']
            digest = hashlib.sha256(video.read_bytes()).hexdigest()
            assert digest == record['sha256']
            assert poster.is_file()
            info = json.loads(subprocess.check_output([
                'ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=codec_name,width,height,nb_frames,r_frame_rate:format=duration',
                '-of', 'json', str(video)], text=True))
            stream = info['streams'][0]
            assert stream['width'] == generation['width'] == 320
            assert stream['height'] == generation['height'] == 192
            assert int(stream['nb_frames']) == record['frameCount']
            assert abs(float(info['format']['duration']) - record['duration']) < .01
            rate = stream['r_frame_rate'].split('/')
            assert int(rate[0]) / int(rate[1]) == generation['fps'] == 10
            condition = video.parent / 'condition.png'
            pixels = subprocess.check_output([
                'ffmpeg', '-v', 'error', '-i', str(condition), '-frames:v', '1',
                '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
            assert hashlib.sha256(pixels).hexdigest() == record['conditionPixelsSha256']
            first_frame = subprocess.check_output([
                'ffmpeg', '-v', 'error', '-i', str(video), '-frames:v', '1',
                '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
            assert len(pixels) == len(first_frame) == 320 * 192 * 3
            # Allow H.264 compression, but reject an unrelated conditioning image.
            mean_error = sum(abs(a - b) for a, b in zip(pixels, first_frame)) / len(pixels)
            assert mean_error < 5, (sample['episode'], mean_error)
            sample['media']['vlp'] = {
                'video': record['video'], 'poster': record['poster'],
                'source': record['source'], 'sha256': digest,
                'codec': stream['codec_name'], 'width': 320, 'height': 192,
                'frameCount': record['frameCount'], 'fps': 10,
                'duration': record['duration'], 'actualMethod': 'Dense planning',
                'temporaryPlaceholder': True, 'checkpoint': generation['checkpoint'],
                'checkpointSha256': generation['checkpointSha256'],
                'numRounds': generation['numRounds'], 'numInferenceSteps': 40,
                'cfgScale': 1.0, 'baseSeed': 0, 'testTimeSearch': False,
                'conditionSource': record['condition'],
                'conditionSha256': record['conditionSha256'],
                'conditionPixelsSha256': record['conditionPixelsSha256'],
            }
            pending.append((video, root / record['video']))
            pending.append((poster, root / record['poster']))
            metadata = video.parent / 'generation.json'
            pending.append((metadata, root / record['video'].replace('vlp.mp4', 'vlp-generation.json')))
        pending.append((args.generated / f"{task['id']}-generation.json",
                        root / f"{task['id']}-placeholder-generation.json"))
    # Validate every sample before modifying the live website assets.
    for source, target in pending:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    manifest['missingMedia'] = 'All-to-region Uniform and Canonical shape Dense/Uniform remain pending.'
    manifest['temporaryMedia'] = (
        'All nine VLP video slots temporarily display newly generated alternate Dense checkpoints. '
        'These are not VLP outputs. VLP table values remain the manuscript-reported results '
        'and do not describe the placeholder rollouts.')
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print('Imported and verified all nine temporary Dense videos, posters and generation provenance.')


if __name__ == '__main__':
    main()
