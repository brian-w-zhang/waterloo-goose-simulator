#!/bin/bash
# Build art models and restart the production server so it serves the new files:
#   tools/art/publish.sh bld_dc bld_mc        (no names: every model)
# `next start` only serves public/ files that existed when it started.
set -e
cd "$(dirname "$0")/../.."
npm run art -- "$@" 2>&1 | grep -E "\[art\]|Error|Traceback" || true
PID=$(lsof -ti :${PORT:-3100} || true)
[ -n "$PID" ] && kill $PID && sleep 1
nohup npm start > /tmp/wgs-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null localhost:${PORT:-3100} && break; sleep 0.5; done
echo "server restarted"
