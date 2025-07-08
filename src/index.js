import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import confluenceClient from './confluenceClient.js';
import { z } from 'zod';

// Get Confluence base URL from environment
const baseUrl = process.env.CONFLUENCE_URL;

// Check if we should use HTTP transport instead of stdio
const useHttpTransport = process.env.USE_HTTP_TRANSPORT === 'true';

// Create MCP Server
console.error(`Starting Confluence MCP Server with ${useHttpTransport ? 'HTTP' : 'stdio'} transport`);
const transport = useHttpTransport
  ? new StreamableHTTPServerTransport({ port: 3002 })
  : new StdioServerTransport();

const server = new McpServer({
  name: 'confluence-mcp',
  version: '1.0.0',
  description: 'MCP server for Atlassian Confluence',
});

// Define schemas
const SpaceSchema = z.object({
  id: z.string().or(z.number()),
  key: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.object({
    plain: z.object({
      value: z.string().optional(),
    }).optional(),
  }).optional(),
  homepage: z.object({
    id: z.string().or(z.number()),
    title: z.string(),
  }).optional(),
});

const ContentSchema = z.object({
  id: z.string().or(z.number()),
  type: z.string(),
  status: z.string(),
  title: z.string(),
  space: z.object({
    key: z.string(),
    name: z.string(),
  }).optional(),
  body: z.object({
    storage: z.object({
      value: z.string(),
      representation: z.string(),
    }).optional(),
  }).optional(),
  version: z.object({
    number: z.number(),
  }).optional(),
});

const SearchResultSchema = z.object({
  results: z.array(z.object({
    content: ContentSchema.optional(),
    title: z.string(),
    excerpt: z.string().optional(),
    url: z.string(),
    lastModified: z.string().optional(),
  })),
  start: z.number(),
  limit: z.number(),
  size: z.number(),
  totalSize: z.number().optional(),
  cqlQuery: z.string(),
});

// Helper function to clean up Confluence API responses
function cleanResponse(data) {
  console.error('Raw data received:', JSON.stringify(data, null, 2));
  
  if (!data) {
    return { 
      content: [{ type: "text", text: "No data found" }] 
    };
  }
  
  // For responses with results array (like spaces, search results, getContentBySpaceAndTitle)
  if (data.results && Array.isArray(data.results)) {
    if (data.results.length === 0) {
      return {
        content: [{ type: "text", text: "No results found" }]
      };
    }
    
    // If it's a single result from getContentBySpaceAndTitle, format it as a single item
    if (data.results.length === 1) {
      const textContent = formatItemAsText(data.results[0]);
      return {
        content: [{ type: "text", text: textContent }]
      };
    }
    
    // Multiple results - format as list
    const textContent = data.results.map((item, index) => {
      return `## Result ${index + 1}\\n${formatItemAsText(item)}`;
    }).join('\\n\\n');
    
    return {
      content: [{ type: "text", text: textContent }],
      _metadata: {
        start: data.start || 0,
        limit: data.limit || 25,
        size: data.size || data.results.length,
        totalSize: data.totalSize
      }
    };
  }
  
  // For single items (like individual pages/spaces)
  const textContent = formatItemAsText(data);
  return {
    content: [{ type: "text", text: textContent }]
  };
}

function formatItemAsText(item) {
  if (!item) return "No item data";
  
  let text = "";
  
  // Format based on item type
  if (item.type === "page") {
    text += `📄 **${item.title}**\\n`;
    text += `ID: ${item.id}\\n`;
    text += `Status: ${item.status}\\n`;
    
    if (item.space) {
      text += `Space: ${item.space.name} (${item.space.key})\\n`;
    }
    
    if (item.version) {
      text += `Version: ${item.version.number}\\n`;
    }
    
    if (item.body && item.body.storage) {
      const content = item.body.storage.value;
      // Remove HTML tags and get a preview
      const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (plainText.length > 500) {
        text += `Content Preview: ${plainText.substring(0, 500)}...\\n\\n`;
        text += `Full Content:\\n${plainText}\\n`;
      } else {
        text += `Content: ${plainText}\\n`;
      }
    }
    
    if (item._links && item._links.webui) {
      text += `URL: ${baseUrl}${item._links.webui}`;
    }
  } 
  else if (item.type === "personal" || item.type === "global") {
    text += `🏠 **${item.name}**\\n`;
    text += `Key: ${item.key}\\n`;
    text += `Type: ${item.type}\\n`;
    text += `Status: ${item.status || 'N/A'}\\n`;
    text += `ID: ${item.id}\\n`;
    
    if (item.description && item.description.plain && item.description.plain.value) {
      text += `Description: ${item.description.plain.value}\\n`;
    }
    
    if (item._links && item._links.webui) {
      text += `URL: ${baseUrl}${item._links.webui}`;
    }
  }
  else {
    // Generic format for other types or unknown structures
    text += `**${item.title || item.name || 'Untitled'}**\\n`;
    if (item.type) text += `Type: ${item.type}\\n`;
    if (item.id) text += `ID: ${item.id}\\n`;
    if (item.key) text += `Key: ${item.key}\\n`;
    if (item.status) text += `Status: ${item.status}\\n`;
    
    // Handle any additional properties
    Object.keys(item).forEach(key => {
      if (!['title', 'name', 'type', 'id', 'key', 'status', '_links'].includes(key)) {
        const value = item[key];
        if (typeof value === 'string' && value.length < 100) {
          text += `${key}: ${value}\\n`;
        }
      }
    });
  }
  
  return text;
}

function cleanItem(item) {
  // This function is no longer used but keeping for compatibility
  return item;
}

// Helper function to handle errors consistently
function errorResponse(message) {
  console.error(message);
  return { 
    content: [{ type: "text", text: `❌ **Error:** ${message}` }]
  };
}

// Register tools WITH CORRECT NAMES (no mcp_ prefix)
server.tool(
  'confluence_get_spaces',
  {
    limit: z.number().min(1).max(100).optional().describe('Maximum number of spaces to return'),
    start: z.number().min(0).optional().describe('Starting index for pagination'),
    type: z.enum(['global', 'personal']).optional().describe('Type of spaces to return'),
    status: z.enum(['current', 'archived']).optional().describe('Status of spaces to return'),
  },
  async ({ limit = 25, start = 0, type, status }) => {
    try {
      const params = { limit, start };
      if (type) params.type = type;
      if (status) params.status = status;
      
      console.error(`Getting spaces with params: ${JSON.stringify(params)}`);
      const spaces = await confluenceClient.getSpaces(params);
      return cleanResponse(spaces);
    } catch (error) {
      return errorResponse(`Failed to get Confluence spaces: ${error.message}`);
    }
  }
);

server.tool(
  'confluence_get_space',
  {
    spaceKey: z.string().describe('The key of the space to retrieve'),
  },
  async ({ spaceKey }) => {
    try {
      console.error(`Getting space with key: ${spaceKey}`);
      const space = await confluenceClient.getSpace(spaceKey);
      return cleanResponse(space);
    } catch (error) {
      return errorResponse(`Failed to get Confluence space: ${error.message}`);
    }
  }
);

server.tool(
  'confluence_get_page',
  {
    pageId: z.string().describe('The ID of the page to retrieve (pass as string)'),
    expand: z.array(z.string()).optional().describe('Properties to expand in the response'),
  },
  async ({ pageId, expand = ['body.storage', 'version', 'space'] }) => {
    try {
      console.error(`Getting page with ID: ${pageId} (type: ${typeof pageId}), expand: ${expand.join(',')}`);
      const content = await confluenceClient.getContentById(pageId, expand);
      return cleanResponse(content);
    } catch (error) {
      return errorResponse(`Failed to get Confluence page: ${error.message}`);
    }
  }
);

server.tool(
  'confluence_get_page_by_title',
  {
    spaceKey: z.string().describe('The key of the space containing the page'),
    title: z.string().describe('The title of the page to retrieve'),
  },
  async ({ spaceKey, title }) => {
    try {
      console.error(`Getting page by title "${title}" in space ${spaceKey}`);
      const response = await confluenceClient.getContentBySpaceAndTitle(spaceKey, title);
      return cleanResponse(response);
    } catch (error) {
      return errorResponse(`Failed to get Confluence page by title: ${error.message}`);
    }
  }
);

server.tool(
  'confluence_search',
  {
    cql: z.string().describe('The CQL query to execute'),
    limit: z.number().min(1).max(100).optional().describe('Maximum number of results to return'),
  },
  async ({ cql, limit = 10 }) => {
    try {
      console.error(`Searching with query "${cql}", limit: ${limit}`);
      const results = await confluenceClient.search(cql, limit);
      return cleanResponse(results);
    } catch (error) {
      return errorResponse(`Failed to search Confluence: ${error.message}`);
    }
  }
);

// Add a new page to Confluence
server.tool(
  'confluence_create_page',
  {
    spaceKey: z.string().optional().describe('The key of the space where the page will be created (defaults to test space)'),
    title: z.string().describe('Title of the new page'),
    content: z.string().describe('Content of the page in Confluence storage format (HTML)'),
    parentId: z.string().optional().describe('ID of the parent page, if creating a child page'),
  },
  async ({ spaceKey, title, content, parentId = null }) => {
    try {
      // Use default test space if not provided
      const effectiveSpaceKey = spaceKey || process.env.TESTING_SPACE_KEY;
      
      if (!effectiveSpaceKey) {
        throw new Error('No space key provided and TESTING_SPACE_KEY not set in environment');
      }
      
      console.error(`Creating page "${title}" in space ${effectiveSpaceKey}`);
      const response = await confluenceClient.createPage(effectiveSpaceKey, title, content, parentId);
      
      const cleaned = cleanResponse(response);
      
      // Add success message with URL
      const pageUrl = `${baseUrl}/spaces/${effectiveSpaceKey}/pages/${response.id}`;
      const successText = `✅ **Page created successfully!**\\n\\n${cleaned.content[0].text}\\n\\n🔗 **Direct Link:** ${pageUrl}`;
      
      return {
        content: [{ type: "text", text: successText }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ **Error creating page:** ${error.message}` }]
      };
    }
  }
);

// Update an existing page in Confluence
server.tool(
  'confluence_update_page',
  {
    pageId: z.string().describe('ID of the page to update'),
    title: z.string().optional().describe('New title for the page (if updating the title)'),
    content: z.string().describe('New content for the page in Confluence storage format (HTML)'),
    version: z.number().optional().describe('Current version number (if omitted, will be retrieved automatically)'),
  },
  async ({ pageId, title, content, version = null }) => {
    try {
      console.error(`Update page request received for pageId: ${pageId}`);
      
      // Validate content
      if (content === undefined) {
        throw new Error('Content is required but was undefined');
      }
      
      if (typeof content !== 'string') {
        throw new Error(`Invalid content type: ${typeof content}. Content must be a string.`);
      }
      
      // If title not provided, get the current page to get the title
      if (!title) {
        console.error(`No title provided, retrieving current page details...`);
        const currentPage = await confluenceClient.getContentById(pageId, ['version']);
        title = currentPage.title;
        console.error(`Using existing title: ${title}`);
      }
      
      console.error(`Updating page ${pageId} with title "${title}", content length: ${content.length}`);
      const response = await confluenceClient.updatePage(pageId, title, content, version);
      console.error(`Page updated successfully, version: ${response.version.number}`);
      
      const cleaned = cleanResponse(response);
      
      // Add success message with URL
      const pageUrl = `${baseUrl}/spaces/${response.space.key}/pages/${response.id}`;
      const successText = `✅ **Page updated successfully!**\\n\\n${cleaned.content[0].text}\\n\\n🔗 **Direct Link:** ${pageUrl}`;
      
      console.error(`Returning success response for pageId: ${pageId}`);
      return {
        content: [{ type: "text", text: successText }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ **Error updating page:** ${error.message}` }]
      };
    }
  }
);

// Start the server
console.error('Connecting Confluence MCP Server...');
server.connect(transport)
  .then(() => {
    console.error('Confluence MCP Server started successfully');
  })
  .catch(err => {
    console.error('Failed to start Confluence MCP Server:', err);
    process.exit(1);
  });