#!/usr/bin/env python3
"""Run on lyg2080: generate alternate Dense checkpoints for temporary VLP slots.

Read-only checkpoints and paired conditions; write only to a new output directory.
Each task loads a fresh pipeline so LoRA weights never accumulate across tasks.
"""
import argparse
import glob
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--task', required=True)
    args = parser.parse_args()
    project = Path('/data/gck/svl_project')
    output = args.output.resolve()
    if output == project or project in output.parents:
        parser.error('Use a new export directory outside the source project.')
    jobs = json.loads(args.jobs.read_text())
    job = next(t for t in jobs['tasks'] if t['id'] == args.task)
    checkpoint = Path(job['checkpoint'])
    if not checkpoint.is_file():
        raise FileNotFoundError(checkpoint)
    sys.path[:0] = [str(project), '/data/gck/DiffSynth-Studio']
    import imageio.v2 as imageio
    import numpy as np
    from PIL import Image
    import torch
    from diffsynth.pipelines.wan_video import ModelConfig, WanVideoPipeline

    root = Path('/mnt2/gck/models/Wan2.2-TI2V-5B')
    pipe = WanVideoPipeline.from_pretrained(
        torch_dtype=torch.bfloat16, device='cuda:0',
        model_configs=[
            ModelConfig(path=sorted(glob.glob(str(root / 'diffusion_pytorch_model*.safetensors')))),
            ModelConfig(path=str(root / 'models_t5_umt5-xxl-enc-bf16.pth')),
            ModelConfig(path=str(root / 'Wan2.2_VAE.pth')),
        ],
        tokenizer_config=ModelConfig(path='/mnt2/gck/models/Wan-AI/Wan2.1-T2V-1.3B/google/umt5-xxl'),
    )
    pipe.load_lora(pipe.dit, str(checkpoint), alpha=1.0)
    pipe.dit.eval()
    checkpoint_hash = sha256(checkpoint)
    manifest = {'task': args.task, 'actualMethod': 'Dense planning',
                'temporarySlot': 'VLP', 'checkpoint': str(checkpoint),
                'checkpointSha256': checkpoint_hash, 'numFramesPerCall': 65,
                'numRounds': job['rounds'], 'numInferenceSteps': 40, 'cfgScale': 1.0,
                'baseSeed': 0, 'fps': 10, 'width': 320, 'height': 192,
                'testTimeSearch': False, 'examples': []}
    for sample in job['examples']:
        target = output / args.task / sample['episode']
        # Never silently overwrite previously generated results.
        if target.exists():
            raise FileExistsError(target)
        target.mkdir(parents=True)
        condition_path = Path(sample['condition'])
        condition = Image.open(condition_path).convert('RGB')
        if condition.size != (320, 192):
            raise ValueError(f'Unexpected condition dimensions: {condition_path}')
        prompt = Path(sample['instructionFile']).read_text().strip()
        if prompt != sample['sourceInstruction']:
            raise ValueError('Instruction differs from the paired website example.')
        frames = [np.asarray(condition).copy()]
        started = time.time()
        print(f"START {args.task}/{sample['episode']} {checkpoint.name}", flush=True)
        with torch.inference_mode():
            for round_index in range(job['rounds']):
                generated = pipe(prompt=prompt, negative_prompt='', input_image=condition,
                                 height=192, width=320, num_frames=65, cfg_scale=1.0,
                                 num_inference_steps=40, seed=round_index, tiled=False,
                                 output_type='floatpoint')
                if generated.ndim == 5:
                    generated = generated[0]
                new = ((generated.float().cpu().clamp(-1, 1) + 1) * 127.5).clamp(0, 255)
                new = new.to(torch.uint8).permute(1, 2, 3, 0).numpy()
                frames.extend(new[1:])
                condition = Image.fromarray(new[-1])
                del generated, new
        video = target / 'vlp.mp4'
        imageio.mimwrite(video, frames, fps=10, quality=8)
        Image.fromarray(frames[0]).save(target / 'condition.png')
        (target / 'instruction.txt').write_text(prompt + '\n')
        poster = target / 'vlp.webp'
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-frames:v', '1',
                        '-c:v', 'libwebp', '-quality', '85', str(poster)], check=True)
        record = {**sample, 'video': video.relative_to(output).as_posix(),
                  'poster': poster.relative_to(output).as_posix(), 'source': str(video),
                  'sha256': sha256(video), 'conditionSha256': sha256(condition_path),
                  'conditionPixelsSha256': hashlib.sha256(frames[0].tobytes()).hexdigest(),
                  'frameCount': len(frames), 'duration': len(frames) / 10,
                  'secondsToGenerate': round(time.time() - started, 2)}
        (target / 'generation.json').write_text(json.dumps({**manifest, **record}, indent=2) + '\n')
        manifest['examples'].append(record)
        (output / f'{args.task}-generation.json').write_text(json.dumps(manifest, indent=2) + '\n')
        print(f"DONE {args.task}/{sample['episode']} {len(frames)} frames", flush=True)
    print(f'COMPLETE {args.task}: {len(manifest["examples"])} videos', flush=True)


if __name__ == '__main__':
    main()
