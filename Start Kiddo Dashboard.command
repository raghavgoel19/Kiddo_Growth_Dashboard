#!/bin/bash
cd "$(dirname "$0")"
export PATH="/opt/anaconda3/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Stop any previous instance first
/usr/sbin/lsof -ti :5173 | /usr/bin/xargs /bin/kill -9 2>/dev/null
/usr/sbin/lsof -ti :3001 | /usr/bin/xargs /bin/kill -9 2>/dev/null

npm install --silent
(cd server && npm install --silent)

npm run dev &
sleep 5
/usr/bin/open http://localhost:5173
