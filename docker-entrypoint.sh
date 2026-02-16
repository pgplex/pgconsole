#!/bin/sh
set -e

CONFIG_PATH="/etc/pgconsole.toml"

# If PGCONSOLE_CONFIG env var is set, write it to the config file
if [ -n "$PGCONSOLE_CONFIG" ]; then
  echo "$PGCONSOLE_CONFIG" > "$CONFIG_PATH"
fi

# Only pass --config if the config file exists; otherwise start in demo mode
if [ -f "$CONFIG_PATH" ]; then
  exec node dist/server.mjs --config "$CONFIG_PATH"
else
  exec node dist/server.mjs
fi
