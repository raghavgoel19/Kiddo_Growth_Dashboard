#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$DIR/scripts/stop-background.sh"
osascript -e 'display notification "Kiddo dashboard stopped" with title "Kiddo Analytics"'
exit 0
