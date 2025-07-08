#!/bin/sh

# Start the MCP server in the background
if [ "$USE_HTTP_TRANSPORT" = "true" ]; then
  echo "Container is running with HTTP server on port 3002"
  echo "For Cursor integration, you can configure to connect to localhost:3002"
  node src/index.js &
else
  echo "Container is running with stdio transport"
  echo "This is the recommended mode for Cursor integration"
  # Don't start the server here - it will be started via exec
fi

# Keep the container running with a tail on the log
echo "Container is running. Press Ctrl+C to stop."
tail -f /dev/null