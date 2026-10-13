#!/usr/bin/env bash
# Alias compatible para instrucciones de versiones anteriores.
set -Eeuo pipefail
cd "$(dirname "$0")"
exec bash QA_RUN.sh "$@"
