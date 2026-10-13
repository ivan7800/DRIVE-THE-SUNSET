#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo 'ERROR: se necesita Node.js 20 o posterior para QA.' >&2; exit 2; }
command -v python3 >/dev/null || { echo 'ERROR: se necesita Python 3 para QA de empaquetado y HTTP.' >&2; exit 2; }

echo '1/5 · Sintaxis real de los módulos y scripts'
while IFS= read -r -d '' file; do
 case "$file" in
  js/game.bundle.js) node --input-type=commonjs --check < "$file" ;;
  *.js|*.mjs) node --input-type=module --check < "$file" ;;
  *.cjs) node --input-type=commonjs --check < "$file" ;;
 esac
done < <(find js webgl tests tools -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print0)
bash -n INICIAR-LINUX.sh QA_RUN.sh QA_RUN_v0.20.0.sh
python3 - <<'PY'
from pathlib import Path
for directory in ['launch', 'tests', 'tools']:
    for path in Path(directory).glob('*.py'):
        compile(path.read_text(encoding='utf-8'), str(path), 'exec')
PY

echo '2/5 · Bundle opcional reproducible (la entrada HTTP usa ESM)'
node tools/build.mjs --check

echo '3/5 · Pruebas de lógica, datos y flujos'
for file in tests/*.test.mjs; do node "$file"; done
node --experimental-vm-modules tests/runtime-smoke.cjs
node --experimental-vm-modules tests/journey-runtime.cjs

echo '4/5 · Empaquetado y recursos bajo /CHASE-404/'
python3 tests/package-smoke.py
python3 tests/http-smoke.py

echo '5/5 · Navegador opcional'
if [[ "${CHASE_QA_GLES:-0}" == 1 ]]; then
 node tools/capture-gles.mjs
 python3 tools/gles-smoke.py
fi
if [[ -n "${CHASE_BROWSER_BINARY:-}" ]]; then
 node tests/browser-e2e.mjs
else
 echo 'PENDIENTE: navegador. Ejecutar con CHASE_BROWSER_BINARY y Playwright instalado (solo desarrollo).'
fi
echo 'QA completado. Las pruebas manuales de plataformas y sensación de conducción se documentan en QA_REPORT.md.'
