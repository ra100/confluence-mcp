#!/bin/bash

# Exit on any error
set -e

# Store the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Create logs directory if it doesn't exist
LOGS_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOGS_DIR"

# Create a log file with timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOGFILE="$LOGS_DIR/mcp-server_$TIMESTAMP.log"
touch "$LOGFILE"
echo "--------------------------------------------" >> "$LOGFILE"
echo "Starting Confluence MCP Server (Docker) at $(date)" >> "$LOGFILE"
echo "Current directory: $(pwd)" >> "$LOGFILE"

# Make sure the Docker container is running
echo "Checking Docker container status..." >> "$LOGFILE"
if ! docker ps -q -f name=confluence-mcp >/dev/null; then
  echo "Container not running. Starting confluence-mcp container..." >> "$LOGFILE"
  docker-compose up -d
  sleep 2 # Give it a moment to start
else
  echo "Container already running." >> "$LOGFILE"
fi

# Since we're using HTTP transport but Cursor expects stdio, we need to execute the server in stdio mode
echo "Connecting to MCP server in stdio mode..." >> "$LOGFILE"
exec docker exec -i confluence-mcp node src/index.js 2>> "$LOGFILE"