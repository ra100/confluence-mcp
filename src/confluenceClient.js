import 'dotenv/config';
import fetch from 'node-fetch';

// Get Confluence credentials from environment variables
const baseUrl = process.env.CONFLUENCE_URL;
const username = process.env.CONFLUENCE_USERNAME;
const apiToken = process.env.CONFLUENCE_API_TOKEN;

// Testing space key from environment
const testingSpaceKey = process.env.TESTING_SPACE_KEY;

// Optional spaces filter
const spacesFilter = process.env.CONFLUENCE_SPACES_FILTER ? 
  process.env.CONFLUENCE_SPACES_FILTER.split(',').map(space => space.trim()) : 
  null;

// Authentication headers
const authHeader = !username ? `Bearer ${apiToken}` : `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`;
const headers = {
  'Authorization': authHeader,
  'Content-Type': 'application/json'
};

// Confluence Client class
class ConfluenceClient {
  constructor() {
    console.error('ConfluenceClient initialized with URL:', baseUrl);
  }

  // API request helper
  async request(endpoint, options = {}) {
    const url = `${baseUrl}/rest/api${endpoint}`;
    console.error('Making request to:', url);
    
    try {
      const response = await fetch(url, {
        headers,
        ...options
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Confluence API Error (${response.status}): ${text}`);
      }

      return response.json();
    } catch (error) {
      console.error('API request error:', error.message);
      throw error;
    }
  }

  // Get a list of spaces
  async getSpaces(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const spaces = await this.request(`/space?${queryParams}`);
    
    if (spacesFilter) {
      spaces.results = spaces.results.filter(space => 
        spacesFilter.includes(space.key)
      );
    }
    
    return spaces;
  }

  // Get a specific space by key
  async getSpace(spaceKey) {
    return this.request(`/space/${spaceKey}`);
  }

  // Get a specific page by ID
  async getContentById(id, expand = []) {
    const expandParam = expand.length ? `?expand=${expand.join(',')}` : '';
    return this.request(`/content/${id}${expandParam}`);
  }

  // Get content by space and title
  async getContentBySpaceAndTitle(spaceKey, title) {
    const params = new URLSearchParams({
      spaceKey,
      title,
      expand: 'body.storage,version'
    }).toString();
    
    return this.request(`/content?${params}`);
  }

  // Search for content using CQL
  async search(cql, limit = 10) {
    const params = new URLSearchParams({
      cql,
      limit: limit.toString()
    }).toString();
    
    return this.request(`/search?${params}`);
  }

  // Create a new page in Confluence
  async createPage(spaceKey, title, content, parentId = null) {
    // Use test space key if not provided
    const effectiveSpaceKey = spaceKey || testingSpaceKey;
    
    const data = {
      type: 'page',
      title,
      space: { key: effectiveSpaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    // If parent ID is provided, add it to the request
    if (parentId) {
      data.ancestors = [{ id: parentId }];
    }

    return this.request('/content', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Update an existing page in Confluence
  async updatePage(pageId, title, content, version) {
    // First, get the current page to get the version number if not provided
    if (!version) {
      const currentPage = await this.getContentById(pageId, ['version']);
      version = currentPage.version.number + 1;
    } else if (typeof version === 'number') {
      // If version is a number, increment it
      version = version + 1;
    }

    const data = {
      type: 'page',
      title,
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      version: {
        number: version
      }
    };

    return this.request(`/content/${pageId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}

export default new ConfluenceClient();