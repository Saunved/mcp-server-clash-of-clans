Clash of Clans MCP server!

For usage with Claude Desktop, you can update the `claude_desktop_config.json` file to register this server.
Example usage with WSL (please change the commands based on your environment):

```json
{
    "mcpServers": {
        "Clash of Clans": {
            "command": "wsl.exe",
            "args": [
                "bash",
                "-c",
                "CLASH_API_KEY=<your-api-key> <path-to-node-cmd> path-to/mcp-server-clash-of-clans/index.js"
            ]
        }
    }
}
```

For WSL, path to node cmd is the path you get when you type `which node` into the terminal.
Ref: https://scottspence.com/posts/getting-mcp-server-working-with-claude-desktop-in-wsl for details.