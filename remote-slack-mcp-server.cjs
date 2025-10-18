const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Auth middleware for protected MCP endpoints
const requireAuth = (req, res, next) => {
  const expected = process.env.MCP_AUTH_TOKEN;
  if (!expected) {
    return res.status(500).json({ error: 'Server not configured: missing MCP_AUTH_TOKEN' });
  }
  const authHeader = req.get('authorization') || '';
  const match = authHeader.match(/^Bearer (.+)$/i);
  if (!match || match[1] !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'slack-mcp-server'
  });
});

// MCP Protocol endpoints
app.post('/mcp/tools', requireAuth, async (req, res) => {
  try {
    const tools = [
      {
        name: 'get_channels',
        description: 'List all channels in the workspace',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_channel_history',
        description: 'Get message history for a specific channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID or name',
            },
            limit: {
              type: 'number',
              description: 'Number of messages to retrieve (default: 10)',
              default: 10,
            },
          },
          required: ['channel'],
        },
      },
      {
        name: 'search_messages',
        description: 'Search for messages across channels',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_user_info',
        description: 'Get information about a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            user: {
              type: 'string',
              description: 'User ID or username',
            },
          },
          required: ['user'],
        },
      },
      {
        name: 'send_message',
        description: 'Send a message to a Slack channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID or name (e.g., #general or C1234567890)',
            },
            text: {
              type: 'string',
              description: 'The message text to send',
            },
            thread_ts: {
              type: 'string',
              description: 'Optional: Timestamp of parent message to reply in thread',
            },
            blocks: {
              type: 'array',
              description: 'Optional: Rich formatting blocks for the message',
            },
          },
          required: ['channel', 'text'],
        },
      },
    ];

    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mcp/call', requireAuth, async (req, res) => {
  try {
    const { name, arguments: args } = req.body;

    let result;
    switch (name) {
      case 'get_channels':
        result = await getChannels();
        break;
      case 'get_channel_history':
        result = await getChannelHistory(args.channel, args.limit || 10);
        break;
      case 'search_messages':
        result = await searchMessages(args.query);
        break;
      case 'get_user_info':
        result = await getUserInfo(args.user);
        break;
      case 'send_message':
        result = await sendMessage(args.channel, args.text, args.thread_ts, args.blocks);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    });
  }
});

// Slack API functions
async function getChannels() {
  const result = await slack.conversations.list({
    types: 'public_channel,private_channel',
  });
  
  const channels = result.channels.map(channel => ({
    id: channel.id,
    name: channel.name,
    is_private: channel.is_private,
    num_members: channel.num_members,
    topic: channel.topic?.value || '',
    purpose: channel.purpose?.value || '',
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(channels, null, 2),
      },
    ],
  };
}

async function getChannelHistory(channel, limit) {
  const result = await slack.conversations.history({
    channel: channel,
    limit: limit,
  });

  const messages = result.messages.map(msg => ({
    user: msg.user,
    text: msg.text,
    timestamp: msg.ts,
    type: msg.type,
    thread_ts: msg.thread_ts,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(messages, null, 2),
      },
    ],
  };
}

async function searchMessages(query) {
  const result = await slack.search.messages({
    query: query,
    count: 20,
  });

  const messages = result.messages.matches.map(match => ({
    channel: match.channel.name,
    user: match.username,
    text: match.text,
    timestamp: match.ts,
    permalink: match.permalink,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(messages, null, 2),
      },
    ],
  };
}

async function getUserInfo(user) {
  const result = await slack.users.info({
    user: user,
  });

  const userInfo = {
    id: result.user.id,
    name: result.user.name,
    real_name: result.user.real_name,
    display_name: result.user.profile?.display_name || result.user.real_name,
    email: result.user.profile?.email,
    title: result.user.profile?.title,
    status: result.user.profile?.status_text,
    is_admin: result.user.is_admin,
    is_owner: result.user.is_owner,
    is_bot: result.user.is_bot,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(userInfo, null, 2),
      },
    ],
  };
}

async function sendMessage(channel, text, thread_ts = null, blocks = null) {
  const messageData = {
    channel: channel,
    text: text,
  };

  if (thread_ts) {
    messageData.thread_ts = thread_ts;
  }

  if (blocks) {
    messageData.blocks = blocks;
  }

  const result = await slack.chat.postMessage(messageData);

  const response = {
    success: result.ok,
    channel: result.channel,
    timestamp: result.ts,
    message: result.message,
    text: result.message?.text,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Remote Slack MCP Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 MCP Tools: http://localhost:${PORT}/mcp/tools`);
  console.log(`⚡ MCP Call: http://localhost:${PORT}/mcp/call`);
});

module.exports = app;
