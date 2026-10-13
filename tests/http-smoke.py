#!/usr/bin/env python3
"""Actual HTTP requests: local launcher plus project-directory deployment.
No browser/GPU, native Windows or visual-layout claim is made by this test.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen
import json
import os
import re
import selectors
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ['index.html', 'INICIO.html', 'start.html', 'style.css', 'js/main.js', 'js/physics.js', 'js/save.js', 'js/routes.js', 'js/stories.js', 'js/visuals.js', 'js/trip.js', 'webgl/prototype.html']

def check_resource(base, ref):
    url = urljoin(base, ref)
    with urlopen(url, timeout=5) as response:
        body = response.read()
        assert response.status == 200, (url, response.status)
        mime = response.headers.get_content_type()
        ext = Path(urlparse(url).path).suffix
        if ext in ['.js', '.mjs']:
            assert mime in ['text/javascript', 'application/javascript'], (url, mime)
        elif ext == '.css':
            assert mime == 'text/css', (url, mime)
        elif ext == '.html':
            assert mime == 'text/html', (url, mime)
        assert body, url
        return body.decode('utf-8') if ext in ['.html', '.js', '.css'] else ''

def crawl(base):
    visited = set()
    queue = [urljoin(base, p) for p in RESOURCES]
    while queue:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        source = check_resource(base, url)
        refs = re.findall(r'(?:src|href)=["\']([^"\']+)["\']', source) if urlparse(url).path.endswith('.html') else []
        refs += [next((p for p in match if p), '') for match in re.findall(r'\bfrom\s*["\'](\.[^"\']+)["\']|\bimport\s*["\'](\.[^"\']+)["\']', source)]
        for ref in refs:
            if not ref or ref.startswith(('http:', 'https:', '#', 'mailto:', 'data:', 'blob:')):
                continue
            child = urljoin(url, ref)
            assert child.startswith(base), ('Path left repository subdirectory', child)
            queue.append(child)
    return len(visited)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

handler = partial(QuietHandler, directory=str(ROOT.parent))
with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    count = crawl(f'http://127.0.0.1:{server.server_port}/{ROOT.name}/')
    server.shutdown()

def run_launcher():
    environment = {**os.environ, 'PYTHONUNBUFFERED': '1', 'BROWSER': '/bin/true'}
    launcher = subprocess.Popen(['bash', 'INICIAR-LINUX.sh'], cwd=ROOT, env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    selector = selectors.DefaultSelector()
    try:
        selector.register(launcher.stdout, selectors.EVENT_READ)
        deadline = time.monotonic() + 8
        base = None
        output = b''
        while time.monotonic() < deadline:
            for key, _ in selector.select(timeout=.1):
                output += os.read(key.fileobj.fileno(), 65536)
                match = re.search(r'http://127\.0\.0\.1:(\d+)/', output.decode('utf-8'))
                if match:
                    port = int(match.group(1))
                    assert 8765 <= port <= 8775, 'Launcher must prefer a stable origin'
                    base = f'http://127.0.0.1:{port}/'
                    break
            if base:
                break
            assert launcher.poll() is None, 'Linux launcher exited before serving'
        assert base, 'No launch URL printed within 8 s'
        return base, crawl(base)
    finally:
        selector.close()
        launcher.terminate()
        try:
            launcher.wait(timeout=3)
        except subprocess.TimeoutExpired:
            launcher.kill()
            launcher.wait()
        launcher.stdout.close()
        launcher.stderr.close()

base, local_count = run_launcher()
relaunched_base, relaunched_count = run_launcher()
assert base == relaunched_base, ('Normal relaunch changed localStorage origin', base, relaunched_base)
result={'result':'PASS','project_subdirectory':f'/{ROOT.name}/','subdirectory_resources':count,'linux_launcher_resources':local_count,'relaunch_resources':relaunched_count,'stable_relaunch_origin':base,'scope':'HTTP requests and stable local origin only, no browser or native Windows verification'}
print(json.dumps(result, ensure_ascii=False))
