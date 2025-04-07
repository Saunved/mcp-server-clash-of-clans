Clash of Clans MCP server!

For usage with Claude Desktop, you can update the `claude_desktop_config.json` file to register this server.

```json
{
    "mcpServers": {
        "Clash of Clans": {
            "command": "npx",
            "args": [
                "-y",
                "mcp-server-clash-of-clans"
            ],
            "env": {
                "CLASH_API_KEY": "<your-api-key>"
            }
        }
    }
}
```

# Available tools

## get-player
Obtains information for a given player tag and summarizes it.

## get-clan
Obtains information for a given clan and summarizes it.

## clan-war-league-info
Obtains information about the most recent CWL rounds.

## clan-war-league-war
Obtains information about a specific CWL war based on the round.

## get-current-war
Gets the current war info for the clan (provided it is public).

## get-war-log
Gets a clan's war log (provided it is public).

## get-capital-raids
Gets information regarding the clan's capital raids.

# Available prompts

## analyze-current-war
Analyzes the current war. Provides an overview with the stats, top-performers, and potential strategy changes.

## analyze-war-log
Analyzes a clan's war log and summarizes its overall performance.

## analyze-cwl-war
Analyzes a given CWL war and summarizes the clan's overall performance in that war.

## analyze-player
Analyzes a player's statistics and suggests scope for improvement.

## analyze-clan
Analyzes a given clan and assesses it based on the members, their TH levels, war record, etc.

## analyze-capital-raids
Analyzes a clan's last few capital raids (3 by default).