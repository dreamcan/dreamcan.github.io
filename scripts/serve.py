#!/usr/bin/env python3
"""Preview this website locally; default port is 8001."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
from serve_preview import RangeHandler
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8001)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
handler = partial(RangeHandler, directory=str(root))

try:
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        print(f'Preview: http://localhost:{args.port}/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
except OSError as error:
    raise SystemExit(f'Cannot start preview on port {args.port}: {error}')
