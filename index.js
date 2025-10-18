// Entry point for Railway/Nixpacks auto-detection.
// Railway checks for a start script, a main field, or an index.js at the project root.
// This file ensures detection even if the start script isn't picked up.
//
// It simply imports and runs the remote Slack MCP server.
import './remote-slack-mcp-server.cjs';
