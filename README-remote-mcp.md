# Remote Slack MCP Server

A remote HTTP-based Model Context Protocol (MCP) server for Slack integration.

## Features

- 🌐 HTTP API: Accessible via REST endpoints
- 🔒 Secure: Helmet security headers, CORS protection, Bearer token auth
- 📊 Monitoring: Morgan logging, health checks
- 🐳 Dockerized: Easy deployment with Docker
- 🚀 Production Ready: Error handling, graceful shutdowns

## Quick Start

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your Slack bot token and an auth token
   # SLACK_BOT_TOKEN=...
   # MCP_AUTH_TOKEN=...
   ```

3. Start the server:
   ```bash
   node remote-slack-mcp-server.cjs
   ```

4. Test the server:
   ```bash
   curl http://localhost:3000/health
   ```

### Docker Deployment

1. Build and run:
   ```bash
   docker-compose up -d
   ```

2. Check status:
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

## Authentication

Both MCP endpoints are protected with Bearer auth.

- Header: `Authorization: Bearer <MCP_AUTH_TOKEN>`
- Env var required: `MCP_AUTH_TOKEN`

If `MCP_AUTH_TOKEN` is not set, the server will return a 500 until configured.

## API Endpoints

### Health Check
```http
GET /health
```

### MCP Tools (requires auth)
```http
POST /mcp/tools
Authorization: Bearer <MCP_AUTH_TOKEN>
```

### MCP Call (requires auth)
```http
POST /mcp/call
Authorization: Bearer <MCP_AUTH_TOKEN>
Content-Type: application/json

{
  "name": "get_channels",
  "arguments": {}
}
```

## Available Tools

- `get_channels` - List all channels
- `get_channel_history` - Get channel messages
- `search_messages` - Search across channels
- `get_user_info` - Get user information
- `send_message` - Send messages to channels
  - Params:
    - `channel` (string): Channel ID or name (e.g., `#general` or `C1234567890`)
    - `text` (string): Message text
    - Optional: `thread_ts` (string), `blocks` (array)

## Environment Variables

- `SLACK_BOT_TOKEN` - Your Slack bot token (required)
- `MCP_AUTH_TOKEN` - Bearer token required for MCP endpoints (required)
- `PORT` - Server port (default: 3000)

## Railway Deployment

Service name recommendation: `slack_mcp`

1. Connect repo in Railway (already connected per instructions).
2. Set environment variables in the service:
   - `SLACK_BOT_TOKEN`: your Slack bot token
   - `MCP_AUTH_TOKEN`: a strong random string (used for Bearer auth)
   - `PORT`: 3000 (optional, defaults to 3000)
3. Build & Run:
   - Railway/Nixpacks will detect Node
   - Start command: `node remote-slack-mcp-server.cjs`
4. Obtain the generated Railway URL after deploy (e.g., `https://<service>.up.railway.app`)
5. Verify:
   ```bash
   BASE_URL="https://<service>.up.railway.app"
   TOKEN="<MCP_AUTH_TOKEN>"

   curl -s "$BASE_URL/health" | jq .
   curl -s -X POST "$BASE_URL/mcp/tools" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" | jq .
   ```

## Using From Cline

Configure a remote MCP server that speaks HTTP with:
- Tools endpoint: `POST <BASE_URL>/mcp/tools` (Authorization: Bearer <MCP_AUTH_TOKEN>)
- Call endpoint: `POST <BASE_URL>/mcp/call` (Authorization: Bearer <MCP_AUTH_TOKEN>)

Tool to send messages:
- `send_message` with `arguments`:
  ```json
  {
    "channel": "#cline",
    "text": "Hello from remote Slack MCP"
  }
  ```

Note: `channel` accepts either `#channel-name` or a channel ID like `C1234567890`.

## Example: Post Latest PR Commits via Remote MCP

This example fetches the latest merged PR from GitHub and posts commit IDs and titles to `#cline` via the remote MCP server.

```bash
OWNER="smb060606"
REPO="arsenal-matchday-pulse"
BASE_URL="https://<service>.up.railway.app"
MCP_TOKEN="<MCP_AUTH_TOKEN>"

# Find latest merged PR number
PR_NUMBER=$(
  curl -s "https://api.github.com/repos/${OWNER}/${REPO}/pulls?state=closed&per_page=50" \
  | jq -r '[.[] | select(.merged_at != null)] | sort_by(.merged_at) | last.number'
)

# Build commit lines: "abcdef0 - Commit title"
COMMITS=$(
  curl -s "https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/commits" \
  | jq -r '.[] | "\(.sha[0:7]) - \(.commit.message | split("\n")[0])"'
)

# Post via remote MCP
PAYLOAD=$(jq -n --arg channel "#cline" --arg text "$COMMITS" \
  '{name:"send_message", arguments:{channel:$channel, text:$text}}')

curl -s -X POST "$BASE_URL/mcp/call" \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD" | jq .
```

## Security Considerations

- Use environment variables for secrets
- Always set `MCP_AUTH_TOKEN` and use HTTPS in production
- Set up proper firewall rules
- Monitor access logs
- Regular security updates

## Monitoring

- Health check endpoint: `/health`
- Logs via Morgan middleware
- Docker health checks enabled
- PM2 monitoring (if used)

## Troubleshooting

### Common Issues

1. Port already in use:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. Docker build fails:
   ```bash
   docker system prune -a
   docker-compose build --no-cache
   ```

3. Slack API errors:
   - Check bot token validity
   - Verify bot permissions
   - Check rate limits
   - Ensure the bot is a member of the target channel

### Logs

```bash
# Docker logs
docker-compose logs -f

# PM2 logs
pm2 logs slack-mcp

# Direct logs
node remote-slack-mcp-server.cjs
```

## Development

### Adding New Tools

1. Add tool definition to `/mcp/tools` endpoint
2. Add case to `/mcp/call` switch statement
3. Implement function
4. Test with curl or Postman

### Testing

```bash
# Test health
curl http://localhost:3000/health

# Test tools
curl -X POST http://localhost:3000/mcp/tools \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN"

# Test call
curl -X POST http://localhost:3000/mcp/call \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "get_channels", "arguments": {}}'
```

## License

MIT
