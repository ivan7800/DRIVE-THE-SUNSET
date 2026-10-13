#!/usr/bin/env python3
"""Servidor local efímero para CHASE-404. Sin conexiones remotas ni dependencias."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
import threading
import time
import webbrowser

ROOT = Path(__file__).resolve().parent.parent
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

def main():
    handler = partial(Handler, directory=str(ROOT))
    # localStorage is scoped to the origin, including the port. Prefer the same
    # port on every launch so a normally restarted game can recover its progress.
    httpd = None
    for port in range(8765, 8776):
        try:
            httpd = ThreadingHTTPServer(('127.0.0.1', port), handler)
            break
        except OSError:
            continue
    if httpd is None:
        raise SystemExit('No se puede abrir el servidor local (puertos 8765–8775).')
    with httpd:
        url = f'http://127.0.0.1:{httpd.server_port}/index.html'
        print('\nCHASE-404 · Lanzador local seguro')
        print('Abre esta dirección en tu navegador:', url)
        print('Pulsa Ctrl+C para cerrar el servidor.\n')
        threading.Thread(target=lambda: (time.sleep(0.5), webbrowser.open(url)), daemon=True).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServidor detenido.')
if __name__ == '__main__':
    main()
