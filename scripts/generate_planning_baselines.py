#!/usr/bin/env python3
"""Generate paired Dense / Uniform evaluation videos for missing website slots.

Run on lyg2080 with the planning environment. Checkpoints and paired inputs are
read-only. Restore the pristine DiT weights between recipes to prevent LoRA
accumulation while loading the large shared model only once.
"""
import argparse
import glob
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

from generate_planning_placeholder import sha256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        raise FileExistsError('Use a new output directory: ' + str(output))
    project = Path('/data/gck/svl_project')
    if output == project or project in output.parents:
        parser.error('Output must be outside the source project.')
    jobs = json.loads(args.jobs.read_text())['jobs']
    for job in jobs:
        assert job['method'] in ['dense', 'uniform']
        assert Path(job['checkpoint']).is_file()
        for sample in job['examples']:
            assert Path(sample['condition']).is_file()
            assert Path(sample['instructionFile']).read_text().strip() == sample['sourceInstruction']
    output.mkdir(parents=True)
    sys.path[:0] = [str(project), '/data/gck/DiffSynth-Studio']
    import imageio.v2 as imageio
    import numpy as np
    from PIL import Image
    import torch
    from diffsynth.pipelines.wan_video import ModelConfig, WanVideoPipeline

    model_root = Path('/mnt2/gck/models/Wan2.2-TI2V-5B')
    pipe = WanVideoPipeline.from_pretrained(
        torch_dtype=torch.bfloat16, device='cuda:0',
        model_configs=[
            ModelConfig(path=sorted(glob.glob(str(model_root / 'diffusion_pytorch_model*.safetensors')))),
            ModelConfig(path=str(model_root / 'models_t5_umt5-xxl-enc-bf16.pth')),
            ModelConfig(path=str(model_root / 'Wan2.2_VAE.pth')),
        ],
        tokenizer_config=ModelConfig(path='/mnt2/gck/models/Wan-AI/Wan2.1-T2V-1.3B/google/umt5-xxl'),
    )
    # Independent CPU copies survive the in-place fusion performed by load_lora.
    pristine = {name: value.detach().cpu().clone() for name, value in pipe.dit.state_dict().items()}
    print('MODEL LOADED; pristine DiT state copied to CPU', flush=True)
    for job_index, job in enumerate(jobs):
        if job_index:
            restored = pipe.dit.load_state_dict(pristine, strict=True)
            assert not restored.missing_keys and not restored.unexpected_keys
            print('RESTORED pristine DiT before ' + job['id'], flush=True)
        pipe.load_lora(pipe.dit, job['checkpoint'], alpha=1.0, hotload=False)
        assert pipe.dit.state_dict().keys() == pristine.keys()
        pipe.dit.eval()
        sparse = job['method'] == 'uniform'
        fps = 4 if sparse else 10
        indices = list(range(4, 65, 4)) if sparse else list(range(1, 65))
        checkpoint_hash = sha256(job['checkpoint'])
        manifest = {k: v for k, v in job.items() if k != 'examples'}
        manifest.update({'actualMethod': 'Uniform planning' if sparse else 'Dense planning',
                         'checkpointSha256': checkpoint_hash, 'baseModel': str(model_root),
                         'numFramesPerCall': 65, 'numInferenceSteps': 40, 'cfgScale': 1.0,
                         'loraAlpha': 1.0, 'stageSeeds': [0] * job['stages'],
                         'outputFrameIndices': indices, 'fps': fps, 'width': 320, 'height': 192,
                         'testTimeSearch': False, 'examples': []})
        for sample in job['examples']:
            target = output / job['task'] / sample['episode']
            target.mkdir(parents=True, exist_ok=True)
            video = target / (job['method'] + '.mp4')
            if video.exists():
                raise FileExistsError(video)
            condition_path = Path(sample['condition'])
            condition = Image.open(condition_path).convert('RGB')
            assert condition.size == (320, 192)
            prompt = Path(sample['instructionFile']).read_text().strip()
            frames = [np.asarray(condition).copy()]
            started = time.time()
            print('START ' + job['id'] + '/' + sample['episode'], flush=True)
            with torch.inference_mode():
                for stage in range(job['stages']):
                    generated = pipe(prompt=prompt, negative_prompt='', input_image=condition,
                                     height=192, width=320, num_frames=65, cfg_scale=1.0,
                                     num_inference_steps=40, seed=0, tiled=False,
                                     output_type='floatpoint')
                    if generated.ndim == 5:
                        generated = generated[0]
                    decoded = ((generated.float().cpu().clamp(-1, 1) + 1) * 127.5).clamp(0, 255)
                    decoded = decoded.to(torch.uint8).permute(1, 2, 3, 0).numpy()
                    frames.extend(decoded[i] for i in indices)
                    condition = Image.fromarray(decoded[indices[-1]])
                    del generated, decoded
            imageio.mimwrite(video, frames, fps=fps, quality=8)
            Image.fromarray(frames[0]).save(target / (job['method'] + '-condition.png'))
            (target / (job['method'] + '-instruction.txt')).write_text(prompt + '\n')
            poster = video.with_suffix('.webp')
            subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-frames:v', '1',
                            '-c:v', 'libwebp', '-quality', '85', str(poster)], check=True)
            record = {**sample, 'video': video.relative_to(output).as_posix(),
                      'poster': poster.relative_to(output).as_posix(), 'source': str(video),
                      'sha256': sha256(video), 'conditionSha256': sha256(condition_path),
                      'conditionPixelsSha256': hashlib.sha256(frames[0].tobytes()).hexdigest(),
                      'frameCount': len(frames), 'duration': len(frames) / fps,
                      'secondsToGenerate': round(time.time() - started, 2)}
            (target / (job['method'] + '-generation.json')).write_text(
                json.dumps({**manifest, **record}, indent=2) + '\n')
            manifest['examples'].append(record)
            (output / (job['id'] + '-generation.json')).write_text(json.dumps(manifest, indent=2) + '\n')
            print('DONE ' + job['id'] + '/' + sample['episode'] + ' ' + str(len(frames)) + ' frames', flush=True)
        print('COMPLETE ' + job['id'], flush=True)
    (output / 'COMPLETE').write_text('complete\n')


if __name__ == '__main__':
    main()
