#!/bin/bash
# Build only the web distribution. Use --output PATH for isolated verification.
# The Python helper removes marked Steam-only blocks; no downloads or deployment.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
exec python3 -B scripts/build-userscript.py "$@"
