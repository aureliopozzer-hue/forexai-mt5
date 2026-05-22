#!/bin/bash
cd /home/z/my-project/mini-services/crypto-stream
PIDFILE="/tmp/crypto-stream.pid"
LOGFILE="/tmp/crypto-stream.log"

# Kill existing process if any
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  kill "$OLD_PID" 2>/dev/null
  rm -f "$PIDFILE"
fi

# Start the service
nohup bun index.ts >> "$LOGFILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PIDFILE"
echo "Started crypto-stream with PID $NEW_PID"
