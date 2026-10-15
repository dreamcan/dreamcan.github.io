#!/usr/bin/env python3
"""Use exact safetensors weights with regular reads on the cluster's Ceph mounts.

The stock memory-mapped loader blocks on these large files. This private runtime
wrapper changes only file I/O, retaining every tensor, dtype, name and checkpoint.
"""
import json
import runpy
import struct
import sys
from pathlib import Path
import torch

sys.path.insert(0, '/data/gck/robometer')
sys.path.insert(0, '/data/gck/svl_project')
import robometer.utils.setup_utils as setup_utils


def read_weights(filename, device='cpu'):
    types = {'F64': torch.float64, 'F32': torch.float32, 'F16': torch.float16,
             'BF16': torch.bfloat16, 'I64': torch.int64, 'I32': torch.int32,
             'I16': torch.int16, 'I8': torch.int8, 'U8': torch.uint8, 'BOOL': torch.bool}
    tensors = {}
    with open(filename, 'rb') as f:
        header_len = struct.unpack('<Q', f.read(8))[0]
        header = json.loads(f.read(header_len))
        offset = 8 + header_len
        entries = sorted(((k, v) for k, v in header.items() if k != '__metadata__'), key=lambda kv: kv[1]['data_offsets'][0])
        for i, (name, entry) in enumerate(entries):
            start, end = entry['data_offsets']
            f.seek(offset + start)
            raw = bytearray(f.read(end - start))
            assert len(raw) == end - start, name
            dtype = types[entry['dtype']]
            if not raw:
                tensor = torch.empty(entry['shape'], dtype=dtype)
            else:
                tensor = torch.frombuffer(raw, dtype=dtype).reshape(entry['shape'])
            tensors[name] = tensor.to(device)
            if i % 100 == 0:
                print(f'[regular checkpoint read] {i}/{len(entries)} tensors', flush=True)
    return tensors


if __name__ == '__main__':
    setup_utils.load_file = read_weights
    runpy.run_path('/data/gck/svl_project/scripts/extract_galaxea_robometer_progress.py', run_name='__main__')
