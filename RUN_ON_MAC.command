#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 20 or newer, then open this launcher again.'
  read -r -p 'Press Return to close...'
  exit 1
fi
node server.mjs &
smartstock_server_pid=$!
trap 'kill "$smartstock_server_pid" 2>/dev/null' EXIT
sleep 1
if kill -0 "$smartstock_server_pid" 2>/dev/null; then
  open 'http://127.0.0.1:4173/'
  echo 'Keep this window running while using SmartStock locally.'
  wait "$smartstock_server_pid"
else
  echo 'The server could not start. Read the error above; another server may already use port 4173.'
  read -r -p 'Press Return to close...'
fi
