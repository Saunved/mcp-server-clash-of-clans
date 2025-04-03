// index.js

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Clash of Clans API base URL
const CLASH_API_BASE = 'https://api.clashofclans.com/v1';
const API_KEY = process.env.CLASH_API_KEY;

// Create the MCP server
const server = new McpServer({
  name: "Clash of Clans API",
  version: "1.0.0"
});

// Helper function to fetch data from Clash API
async function fetchClashAPI(endpoint) {
  const url = `${CLASH_API_BASE}${endpoint}`;
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(`API error: ${error.response?.status || 'unknown'} - ${error.message}`);
  }
}

  server.tool(
    "get-player",
    { tag: z.string().describe("Player tag (with or without #)") },
    async ({ tag }) => {
      try {
        // Player tags in Clash API need to have # prepended, and URL encoded
        const formattedTag = encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);
        const playerData = await fetchClashAPI(`/players/${formattedTag}`);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(playerData, null, 2) 
          }]
        };
      } catch (error) {
        console.error("Error fetching player data:", error);
        return {
          content: [{ 
            type: "text", 
            text: `Error retrieving player data: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  );


server.prompt(
  "analyze-player",
  { tag: String },
  ({ tag }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please analyze the Clash of Clans player with tag ${tag}. Include their town hall level, trophies, and notable achievements. Suggest potential areas for improvement based on their stats.`
      }
    }]
  })
);

// Create stdio transport and connect
const transport = new StdioServerTransport();

// Log startup
console.error("Starting Clash of Clans MCP server with stdio transport...");

// Connect the server to the transport
server.connect(transport).catch(err => {
  console.error("Error starting server:", err);
  process.exit(1);
});