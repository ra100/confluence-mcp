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
LOGFILE="$LOGS_DIR/mcp-restart_$TIMESTAMP.log"
touch "$LOGFILE"
echo "--------------------------------------------" >> "$LOGFILE"
echo "Restarting Confluence MCP Server at $(date)" >> "$LOGFILE"

# Check if Docker is available
if command -v docker >/dev/null 2>&1; then
  echo "Rebuilding and restarting Docker container..." >> "$LOGFILE"
  echo "Rebuilding and restarting Docker container..."
  
  # Stop the container if it's running
  if docker ps -q -f name=confluence-mcp >/dev/null; then
    echo "Stopping existing container..." >> "$LOGFILE"
    echo "Stopping existing container..."
    docker stop confluence-mcp
  fi
  
  # Remove the container to ensure clean restart
  if docker ps -a -q -f name=confluence-mcp >/dev/null; then
    echo "Removing existing container..." >> "$LOGFILE"
    echo "Removing existing container..."
    docker rm confluence-mcp
  fi

  # Set environment variable to use HTTP transport
  export USE_HTTP_TRANSPORT=true
  
  # Build and start with docker-compose
  echo "Building and starting with docker-compose..." >> "$LOGFILE"
  echo "Building and starting with docker-compose..."
  docker-compose up --build -d
  
  echo "Container rebuilt and restarted successfully." >> "$LOGFILE"
  echo "Container rebuilt and restarted successfully."
  echo "Restart completed at $(date)" >> "$LOGFILE"
  echo "Restart completed at $(date)"
  exit 0
else
  echo "Docker not available. Attempting to restart the Node.js process..." >> "$LOGFILE"
  echo "Docker not available. Attempting to restart the Node.js process..."
  
  # Find the PID of the Node.js process running the MCP server
  PID=$(pgrep -f "node src/index.js" || true)
  
  if [ -n "$PID" ]; then
    echo "Killing existing Node.js process (PID: $PID)..." >> "$LOGFILE"
    echo "Killing existing Node.js process (PID: $PID)..."
    kill "$PID" 2>/dev/null || true
    sleep 2
  fi
  
  echo "Starting new Node.js process with HTTP transport..." >> "$LOGFILE"
  echo "Starting new Node.js process with HTTP transport..."
  export USE_HTTP_TRANSPORT=true
  nohup node src/index.js >/dev/null 2>&1 &
  
  echo "Restart completed at $(date)" >> "$LOGFILE"
  echo "Restart completed at $(date)"
  exit 0
fi