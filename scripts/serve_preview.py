#!/usr/bin/env python3
"""Local preview server with HTTP byte ranges for MP4 seeking and paired playback."""
import argparse
from email.utils import formatdate
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re

class RangeHandler(SimpleHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def send_head(self):
        self.remaining=None
        path=Path(self.translate_path(self.path))
        header=self.headers.get('Range')
        if not header or not path.is_file():return super().send_head()
        size=path.stat().st_size
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',header.strip())
        if not match or not any(match.groups()):
            self.send_error(400,'Invalid single byte range');return None
        left,right=match.groups()
        if left:start=int(left);end=min(int(right) if right else size-1,size-1)
        else:start=max(0,size-int(right));end=size-1
        if start>=size or start>end:
            self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return None
        f=path.open('rb');f.seek(start);self.remaining=end-start+1
        self.send_response(206)
        self.send_header('Content-Type',self.guess_type(str(path)))
        self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length',str(self.remaining))
        self.send_header('Last-Modified',formatdate(path.stat().st_mtime,usegmt=True))
        self.end_headers();return f
    def copyfile(self,source,outputfile):
        if self.remaining is None:return super().copyfile(source,outputfile)
        remaining=self.remaining
        while remaining:
            chunk=source.read(min(64*1024,remaining))
            if not chunk:break
            outputfile.write(chunk);remaining-=len(chunk)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--port',type=int,default=8002);p.add_argument('--directory',type=Path,default=Path(__file__).resolve().parents[1]);args=p.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(RangeHandler,directory=str(args.directory.resolve())))
    print(f'Preview: http://127.0.0.1:{args.port}/',flush=True)
    server.serve_forever()
if __name__=='__main__':main()
