#!/usr/bin/env python3
"""Download the original static website with relative GitHub Pages URLs."""
import argparse
import collections
import html
from html.parser import HTMLParser
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://4dcodebench.com/'


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src', 'poster', 'data-src'):
            if attrs.get(key):
                self.urls.append(attrs[key])
        if tag == 'link' and attrs.get('href'):
            self.urls.append(attrs['href'])
        if attrs.get('srcset'):
            self.urls.extend(item.strip().split()[0] for item in attrs['srcset'].split(','))


def mirror():
    queue = collections.deque([ORIGIN])
    visited = set()
    failures = []
    while queue:
        url = queue.popleft()
        url, _ = urllib.parse.urldefrag(url)
        if url in visited:
            continue
        visited.add(url)
        parsed = urllib.parse.urlsplit(url)
        if parsed.netloc != urllib.parse.urlsplit(ORIGIN).netloc:
            continue
        relative = urllib.parse.unquote(parsed.path).lstrip('/') or 'index.html'
        target = (ROOT / relative).resolve()
        if not target.is_relative_to(ROOT) or relative.startswith(('.git/', '.github/', 'scripts/')):
            continue
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(request, timeout=90) as response:
                data = response.read()
                content_type = response.headers.get('Content-Type', '')
        except Exception as error:
            failures.append((url, str(error)))
            print(f'FAILED {url}: {error}')
            continue
        refs = []
        if any(kind in content_type for kind in ('text/', 'javascript', 'json', 'svg')):
            text = data.decode('utf-8')
            if 'html' in content_type:
                parser = References()
                parser.feed(text)
                refs.extend(parser.urls)
            refs.extend(re.findall(r'url\(\s*[\"\x27]?([^\s\)\"\x27]+)', text))
            refs.extend(re.findall(r'[\"\x27]([^\"\x27\s]+\.(?:css|js|mjs|json|csv|png|jpg|jpeg|webp|svg|gif|mp4|webm|woff2?)(?:\?[^\"\x27]*)?)[\"\x27]', text))
            # Root-relative references must also work under /repository-name/.
            prefix = './' if target.parent == ROOT else '../' * len(target.parent.relative_to(ROOT).parts)
            # Rewrite actual HTML attributes and CSS URLs, leaving JS regexes
            # and SVG self-closing tags intact.
            if 'html' in content_type:
                text = re.sub(r'((?:src|href|poster|data-src)=[\"\x27])/(?!/)', lambda match: match[1] + prefix, text)
            if 'css' in content_type:
                text = re.sub(r'(url\(\s*[\"\x27]?)/(?!/)', lambda match: match[1] + prefix, text)
            text = text.replace(ORIGIN, prefix)
            data = text.encode('utf-8')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        print(f'SAVED {relative} ({len(data):,} bytes)')
        for ref in refs:
            resolved = urllib.parse.urljoin(url, html.unescape(ref))
            if urllib.parse.urlsplit(resolved).netloc == parsed.netloc:
                queue.append(resolved)
    if failures:
        raise SystemExit(f'{len(failures)} download(s) failed. Re-run with network access before deploying.')
    (ROOT / '.nojekyll').touch()
    print('Mirror downloaded. Check browser Network for dynamically constructed asset URLs.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true', required=True, help='Download original page and replace local index.html')
    parser.parse_args()
    mirror()
