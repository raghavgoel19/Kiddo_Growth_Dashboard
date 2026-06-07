#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

if [ -f .run.pid ]; then
  PID=$(cat .run.pid)
  /bin/kill "$PID" 2>/dev/null
  /usr/bin/pkill -P "$PID" 2>/dev/null
  /bin/rm -f .run.pid
fi

/usr/sbin/lsof -ti :5173 | /usr/bin/xargs /bin/kill -9 2>/dev/null
/usr/sbin/lsof -ti :3001 | /usr/bin/xargs /bin/kill -9 2>/dev/null
