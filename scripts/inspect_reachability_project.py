#!/usr/bin/env python3
"""Read-only SSH inspection of DreamCan code, without copying datasets or checkpoints."""
import argparse
import json
from pathlib import Path
import shlex
import subprocess

REMOTE_SCRIPT = r'''import json, os
from pathlib import Path
import sys
root = Path(sys.argv[1]).resolve()
if not root.is_dir():
    raise SystemExit("Project directory does not exist: " + str(root))
skip = {".git", ".venv", "venv", "node_modules", "__pycache__", ".cache", "wandb"}
binary = {".pt", ".pth", ".ckpt", ".safetensors", ".hdf5", ".h5", ".zarr", ".mp4", ".avi", ".webm", ".mov", ".npz", ".npy", ".zip"}
source_suffixes = {".py", ".yaml", ".yml", ".toml", ".sh", ".md"}
result = {"root": str(root), "parent_instructions": {}, "source_files": {}, "artifact_samples": [], "top_level": [], "truncated": False}
for parent in (root.parent.parent, root.parent, root):
    path = parent / "AGENTS.md"
    if path.is_file(): result["parent_instructions"][str(path)] = path.read_text(errors="replace")
result["top_level"] = [{"name": p.name, "directory": p.is_dir()} for p in sorted(root.iterdir())]
bytes_used = 0
file_count = 0
for directory, dirs, files in os.walk(root, followlinks=False):
    dirs[:] = sorted(d for d in dirs if d not in skip and not (Path(directory)/d).is_symlink())
    relative = Path(directory).relative_to(root)
    if len(relative.parts) > 7:
        dirs[:] = []
        continue
    sampled = 0
    for name in sorted(files):
        path = Path(directory) / name
        if path.is_symlink(): continue
        lower = name.lower()
        if lower.startswith(".env") or any(x in lower for x in ("credential", "secret", "id_rsa", "id_ed25519")): continue
        suffix = path.suffix.lower()
        key = str(path.relative_to(root))
        try:
            size = path.stat().st_size
            if suffix in binary and sampled < 10 and len(result["artifact_samples"]) < 2500:
                result["artifact_samples"].append({"path": key, "bytes": size})
                sampled += 1
            if suffix in source_suffixes and size <= 300000 and file_count < 1200 and bytes_used + size <= 30000000:
                result["source_files"][key] = path.read_text(errors="replace")
                bytes_used += size
                file_count += 1
            elif suffix in source_suffixes:
                result["truncated"] = True
        except OSError:
            pass
print(json.dumps(result))
'''

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="lyg2080")
    parser.add_argument("--remote-root", default="/data/gck/svl_project")
    parser.add_argument("--output", type=Path, default=Path("/tmp/dreamcan-remote-inspection"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    remote_command = "python3 - " + shlex.quote(args.remote_root)
    result = subprocess.run(["ssh", "-o", "ConnectTimeout=20", args.host, remote_command], input=REMOTE_SCRIPT, text=True, stdout=subprocess.PIPE)
    if result.returncode:
        raise SystemExit("SSH inspection failed; the website and remote project were not modified.")
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise SystemExit("Remote output was not valid JSON: " + str(error))
    (args.output / "inspection.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    source_dir = args.output / "source"
    source_dir.mkdir(exist_ok=True)
    for name, text in payload["source_files"].items():
        destination = (source_dir / name).resolve()
        if not destination.is_relative_to(source_dir.resolve()):
            raise SystemExit("Unsafe remote filename")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text)
    print("Inspection saved:", args.output / "inspection.json")
    print("Source files:", len(payload["source_files"]))
    print("Dataset/checkpoint samples:", len(payload["artifact_samples"]))
    if payload["truncated"]: print("Some source files were too large or exceeded the inspection limit.")

if __name__ == "__main__":
    main()
