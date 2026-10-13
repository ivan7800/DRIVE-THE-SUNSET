#!/usr/bin/env python3
"""Prueba de empaquetado sin navegador: rutas, HTML e imports relativos."""
from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
paths=['index.html','INICIO.html','start.html','webgl/prototype.html','js/main.js','js/game.bundle.js','tools/build.mjs','QA_RUN.sh','launch/server.py','INICIAR-LINUX.sh','INICIAR-WINDOWS.bat','LICENSE','.gitignore']
errors=[f'Falta {p}' for p in paths if not (root/p).is_file()]
for f in root.rglob('*.html'):
    txt=f.read_text(encoding='utf-8')
    for ref in re.findall(r'(?:src|href)=[\"\']([^\"\']+)[\"\']',txt):
        if ref.startswith(('http:','https:','#','mailto:','data:','blob:')):continue
        if ref.startswith('/'):errors.append(f'Ruta absoluta incompatible con subruta: {f.relative_to(root)} -> {ref}');continue
        target=(f.parent/ref.split('?',1)[0]).resolve()
        if not target.is_file():errors.append(f'Ruta rota {f.relative_to(root)} -> {ref}')
for f in root.rglob('*.js'):
    txt=f.read_text(encoding='utf-8')
    for mod in re.findall(r'\bfrom\s*[\"\'](\.[^\"\']+)[\"\']|\bimport\s*[\"\'](\.[^\"\']+)[\"\']',txt):
        ref=next((x for x in mod if x),'')
        target=(f.parent/ref).resolve()
        if not target.is_file():errors.append(f'Import roto {f.relative_to(root)} -> {ref}')
index=(root/'index.html').read_text(encoding='utf-8')
if not re.search(r'<script\b[^>]*type=["\']module["\'][^>]*src=["\'](?:\./)?js/main\.js["\']',index):errors.append('La entrada HTTP no declara el módulo principal js/main.js')
print('PACKAGING PASS: files, relative HTML/import paths, native ESM HTTP entry' if not errors else '\n'.join(errors))
sys.exit(bool(errors))
