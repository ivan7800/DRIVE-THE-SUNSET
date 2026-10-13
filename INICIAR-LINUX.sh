#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$(readlink -f "$0")")"
if ! command -v python3 >/dev/null 2>&1; then
  echo 'ERROR: es necesario Python 3 (sudo apt install python3).' >&2
  read -r -p 'Pulsa Intro para salir...' _ || true
  exit 1
fi
exec python3 launch/server.py
