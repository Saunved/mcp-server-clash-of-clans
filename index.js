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

  server.tool(
    "get-clan",
    { tag: z.string().describe("Clan tag (with or without #)") },
    async ({ tag }) => {
      try {
        // Clan tags in Clash API need to have # prepended, and URL encoded
        const formattedTag = encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);
        const clanData = await fetchClashAPI(`/clans/${formattedTag}`);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(clanData, null, 2) 
          }]
        };
      } catch (error) {
        console.error("Error fetching clan data:", error);
        return {
          content: [{ 
            type: "text", 
            text: `Error retrieving clan data: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  )

  server.tool(
    "clan-war-league-info",
    { tag: z.string().describe("Clan tag (with or without #)") },
    async ({ tag }) => {
      try {
        // Clan tags in Clash API need to have # prepended, and URL encoded
        const formattedTag = encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);
        const warData = await fetchClashAPI(`/clans/${formattedTag}/currentwar/leaguegroup`);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(warData, null, 2) 
          }]
        };
      } catch (error) {
        console.error("Error fetching current war data:", error);
        return {
          content: [{ 
            type: "text", 
            text: `Error retrieving current war data: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  )


  server.tool(
    "clan-war-league-war",
    { 
      clanTag: z.string().describe("Clan tag (with or without #)"),
      round: z.number().describe("CWL round number (1-7)")
    },
    async ({ clanTag, round }) => {
      try {
        // Format clan tag correctly
        const formattedClanTag = encodeURIComponent(clanTag.startsWith('#') ? clanTag : `#${clanTag}`);
        
        // Get CWL group information
        const cwlInfo = await fetchClashAPI(`/clans/${formattedClanTag}/currentwar/leaguegroup`);
        
        // Validate round number
        if (round < 1 || round > 7) {
          throw new Error("Round number must be between 1 and 7");
        }
        
        // Check if the round has war tags
        const roundIndex = round - 1;
        if (!cwlInfo.rounds[roundIndex] || !cwlInfo.rounds[roundIndex].warTags) {
          return {
            content: [{ 
              type: "text", 
              text: `No war data found for round ${round}. The round may not exist in this CWL season.` 
            }]
          };
        }
        
        // Get all war tags for the specified round
        const warTags = cwlInfo.rounds[roundIndex].warTags;
        
        // Filter out placeholder tags
        const validWarTags = warTags.filter(tag => tag !== "#0");
        
        if (validWarTags.length === 0) {
          return {
            content: [{ 
              type: "text", 
              text: `War for round ${round} hasn't been scheduled yet or the data isn't available.` 
            }]
          };
        }
        
        // Find the war that includes our clan
        let clanWar = null;
        const _warDetails = []
        for (const tag of validWarTags) {
          try {
            const warDetails = await fetchClashAPI(`/clanwarleagues/wars/${encodeURIComponent(tag)}`);
            _warDetails.push(warDetails.clan.tag, warDetails.opponent.tag)
            
            // Check if this war involves our clan (comparing encoded tags to ensure exact match)
            if (encodeURIComponent(warDetails.clan.tag) === formattedClanTag || 
                encodeURIComponent(warDetails.opponent.tag) === formattedClanTag) {
              clanWar = warDetails;
              break;
            }
          } catch (error) {
            console.error(`Error fetching war details for tag ${tag}:`, error);
            // Continue to the next tag rather than failing completely
          }
        }
        
        if (!clanWar) {
          return {
            content: [{ 
              type: "text", 
              text: "Clan war not found or clan is not participating in this round"
            }]
          };
        }
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(clanWar, null, 2) 
          }]
        };
      } catch (error) {
        console.error("Error fetching CWL war data:", error);
        return {
          content: [{ 
            type: "text", 
            text: `Error retrieving CWL war data: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  );

  server.prompt(
    "analyze-cwl-war",
    { 
      clanTag: String,
      opponentTag: String,
      round: Number
    },
    ({ clanTag, opponentTag, round }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please analyze the Clan War League war between clan ${clanTag} and ${opponentTag} in round ${round}. Include:
  
  1. War overview (clan levels, stars, destruction percentage)
  2. Attack performance analysis for both clans
  3. Key attackers and defenders who performed well
  4. Town Hall level matchup comparison
  5. Unused attacks and their potential impact
  6. Strategic insights about attack timing and patterns
  7. Recommendations for future CWL wars based on this matchup
  
  [IMPORTANT] If the war hasn't completed, provide a mid-war analysis with current status and projections.`
        }
      }]
    })
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

// Create prompt for analyzing a clan
server.prompt(
    "analyze-clan",
    { tag: String },
    ({ tag }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please analyze the Clash of Clans clan with tag ${tag}. Include information about:
  1. Basic clan stats (level, members, war record)
  2. Leadership composition and activity
  3. Member breakdown by Town Hall levels
  4. Trophy range and league standings
  5. Clan Capital development
  6. War performance indicators
  7. Overall clan activity (donations, etc.)
  8. Recommendations for potential applicants
  9. Comparison to typical clans of similar level
  
  Based on this data, provide an overall assessment of the clan's strengths and potential areas for improvement.`
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