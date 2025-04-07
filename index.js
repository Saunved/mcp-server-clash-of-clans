#!/usr/bin/env node

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

// Simple cache implementation with TTL
class Cache {
    constructor(ttlSeconds = 300) {
      this.cache = new Map();
      this.ttl = ttlSeconds * 1000; // Convert to milliseconds
    }
  
    set(key, value) {
      const item = {
        value,
        expiry: Date.now() + this.ttl
      };
      this.cache.set(key, item);
      return value;
    }
  
    get(key) {
      const item = this.cache.get(key);
      if (!item) return null;
      
      // Return null if expired
      if (Date.now() > item.expiry) {
        this.cache.delete(key);
        return null;
      }
      
      return item.value;
    }
  
    clear() {
      this.cache.clear();
    }
  }
  
  // Initialize cache with 300s TTL
  const apiCache = new Cache(300);

// Create the MCP server
const server = new McpServer({
    name: "Clash of Clans MCP Server",
    version: "1.0.2"
});

// Helper function to fetch data from Clash API
async function fetchClashAPI(endpoint) {
    // Check cache first
    const cacheKey = endpoint;
    const cachedData = apiCache.get(cacheKey);

    if (cachedData) {
        console.error(`Cache hit for ${endpoint}`);
        return cachedData;
    }

    console.error(`Cache miss for ${endpoint}, fetching from API`);

    // If not in cache, fetch from API
    const url = `${CLASH_API_BASE}${endpoint}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json'
            }
        });

        // Store in cache and return
        return apiCache.set(cacheKey, response.data);
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

server.tool(
    "get-current-war",
    { tag: z.string().describe("Clan tag (with or without #)") },
    async ({ tag }) => {
        try {
            // Format clan tag correctly
            const formattedTag = encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);
            
            // Fetch current war data
            const warData = await fetchClashAPI(`/clans/${formattedTag}/currentwar`);

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
);

server.tool(
    "get-war-log",
    { 
        tag: z.string().describe("Clan tag (with or without #)"),
        limit: z.number().optional().default(10).describe("Number of war log entries to retrieve (max allowed by API)")
    },
    async ({ tag, limit }) => {
        try {
            // Format clan tag correctly
            const formattedTag = encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);
            
            // Fetch war log data
            // Note: The Clash API only returns a limited number of most recent wars
            const warLogData = await fetchClashAPI(`/clans/${formattedTag}/warlog?limit=${limit}`);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(warLogData, null, 2)
                }]
            };
        } catch (error) {
            console.error("Error fetching war log data:", error);
            return {
                content: [{
                    type: "text",
                    text: `Error retrieving war log data: ${error.message}`
                }],
                isError: true
            };
        }
    }
);

server.tool(
    "get-capital-raids",
    { 
        tag: z.string().describe("Clan tag (with or without #)"),
        limit: z.number().optional().default(10).describe("Number of capital raid seasons to retrieve (max allowed by API)"),
        before: z.string().optional().describe("Pagination token to fetch records before a certain point"),
        after: z.string().optional().describe("Pagination token to fetch records after a certain point")
    },
    async ({ tag, limit, before, after }) => {
        try {
            // Format clan tag correctly
            const formattedTag = encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);
            
            // Build the query parameters
            let queryParams = [`limit=${limit}`];
            
            // Add pagination parameters if provided
            if (before) {
                queryParams.push(`before=${encodeURIComponent(before)}`);
            } else if (after) {
                queryParams.push(`after=${encodeURIComponent(after)}`);
            }
            
            // Fetch capital raid seasons data
            const raidData = await fetchClashAPI(`/clans/${formattedTag}/capitalraidseasons?${queryParams.join('&')}`);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(raidData, null, 2)
                }]
            };
        } catch (error) {
            console.error("Error fetching capital raid seasons data:", error);
            return {
                content: [{
                    type: "text",
                    text: `Error retrieving capital raid seasons data: ${error.message}`
                }],
                isError: true
            };
        }
    }
);

server.prompt(
    "analyze-current-war",
    { tag: String },
    ({ tag }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Please analyze the current clan war for clan ${tag}. Include:

1. War overview (clan vs opponent, size, start/end time)
2. Current war status (preparation, in war, ended)
3. Current score comparison (stars and destruction percentage)
4. Attack statistics for both clans (attacks used, average stars)
5. Remaining attacks and potential maximum stars
6. Best performing members so far
7. Town Hall level distribution comparison
8. Strategic recommendations based on the current situation

If the war is in preparation phase, focus on the matchup analysis and strategic recommendations based on the lineup.`
            }
        }]
    })
);

server.prompt(
    "analyze-war-log",
    { 
        tag: String,
        wars: z.number().optional().default(10).describe("Number of recent wars to analyze")
    },
    ({ tag, wars }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Please analyze the war log for clan ${tag} using the last ${wars} wars. Include:

1. Overall win-loss record and win percentage
2. Average stars per war
3. Average destruction percentage
4. War size distribution (frequency of different war sizes)
5. Performance trends (improving, declining, or stable)
6. Typical war strategy insights (based on attack patterns)
7. Toughest opponents faced
8. Most dominant victories
9. Recommendations for improving war performance

This analysis should help the clan understand their war performance over time and identify areas for improvement.`
            }
        }]
    })
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

server.prompt(
    "analyze-capital-raids",
    { 
        tag: String,
        seasons: z.number().optional().default(3).describe("Number of recent seasons to analyze")
    },
    ({ tag, seasons }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Please analyze the Clan Capital raid performance for clan ${tag} over the last ${seasons} seasons. Include:

1. Overall raid statistics (total loot earned, raids completed, number of attacks used)
2. Offensive performance metrics (districts destroyed, average attacks per district)
3. Defensive performance assessment (districts lost, average enemy attacks needed)
4. Member participation analysis (most active members, attack utilization)
5. Weekend-by-weekend trend analysis
6. Loot efficiency (average capital gold per attack)
7. Recommendations for improvement based on the data

This analysis will help the clan understand their Capital raid strengths and weaknesses, and identify areas for improvement.`
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