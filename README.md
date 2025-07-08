# Confluence MCP Server

An MCP (Model Context Protocol) server for Atlassian Confluence that allows AI assistants like Claude and Cursor AI to interact with your Confluence instance. The server enables querying spaces, retrieving page content, and searching your Confluence knowledge base directly through your AI assistant.

## Features

- List available Confluence spaces
- Get detailed information about specific spaces
- Retrieve page content by ID or by title within a space
- Search Confluence using CQL (Confluence Query Language)
- Security-focused design with local credential management

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Docker (recommended for containerized usage)
- An Atlassian Confluence account with API access
- An Atlassian API token

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SnirRadomsky/confluence-mcp.git
   cd confluence-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   
   **Note**: The `package-lock.json` file ensures consistent dependency versions across environments. It's recommended to keep it in the repository for reproducible builds.

### Configuration

1. Copy the `env.example` file to `env`:
   ```bash
   cp env.example env
   ```

2. Edit the `env` file with your Confluence credentials:
   ```
   CONFLUENCE_URL=https://your-organization.atlassian.net/wiki
   CONFLUENCE_USERNAME=your-email@example.com
   CONFLUENCE_API_TOKEN=your-api-token-here
   ```

   To get an API token:
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Copy the generated token

3. (Optional) If you want to filter available spaces, uncomment and set `CONFLUENCE_SPACES_FILTER`:
   ```
   CONFLUENCE_SPACES_FILTER=DEV,TEAM,DOCS
   ```

### Running the Server

#### Using Docker (Recommended)

1. Make sure the scripts are executable:
   ```bash
   chmod +x docker-mcp-launcher.sh restart-mcp.sh docker-entrypoint.sh
   ```

2. Start the server:
   ```bash
   ./docker-mcp-launcher.sh
   ```

3. To restart the server if needed:
   ```bash
   ./restart-mcp.sh
   ```

#### Without Docker

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

### Connecting to Your AI Assistant

Update your AI assistant configuration to use this MCP server. For Cursor, edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "confluence-mcp": {
      "type": "stdio",
      "command": "/path/to/confluence-mcp/docker-mcp-launcher.sh",
      "restartOptions": {
        "command": "/path/to/confluence-mcp/restart-mcp.sh",
        "delay": 1000,
        "maxRestarts": 5
      }
    }
  }
}
```

## Available Tools

The server provides the following MCP tools:

- `confluence_get_spaces`: List available Confluence spaces
- `confluence_get_space`: Get detailed information about a specific space
- `confluence_get_page`: Get page content by ID
- `confluence_get_page_by_title`: Get page content by title within a space
- `confluence_search`: Search Confluence content using CQL

## Security Considerations

- Credentials are stored locally in the `env` file and never leave your machine
- The server runs locally and communicates only with your Confluence instance
- API tokens can be revoked at any time from your Atlassian account