#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

export PATH="/opt/anaconda3/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if [ -f .run.pid ]; then
  OLD_PID=$(cat .run.pid)
  /bin/kill "$OLD_PID" 2>/dev/null
  /usr/bin/pkill -P "$OLD_PID" 2>/dev/null
  /bin/rm -f .run.pid
fi
/usr/sbin/lsof -ti :5173 | /usr/bin/xargs /bin/kill -9 2>/dev/null
/usr/sbin/lsof -ti :3001 | /usr/bin/xargs /bin/kill -9 2>/dev/null

if [ ! -d node_modules ] || [ ! -d server/node_modules ]; then
  npm install >> .run.log 2>&1
  (cd server && npm install >> ../.run.log 2>&1)
fi

/usr/bin/nohup npm run dev >> .run.log 2>&1 &
echo $! > .run.pid
