const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();

class SlackMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'slack-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_channels':
            return await this.getChannels();
          case 'get_channel_history':
            return await this.getChannelHistory(args.channel, args.limit || 10);
          case 'search_messages':
            return await this.searchMessages(args.query);
          case 'get_user_info':
            return await this.getUserInfo(args.user);
          case 'send_message':
            return await this.sendMessage(args.channel, args.text, args.thread_ts, args.blocks);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async getChannels() {
    const result = await this.slack.conversations.list({
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

  async getChannelHistory(channel, limit) {
    const result = await this.slack.conversations.history({
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

  async searchMessages(query) {
    const result = await this.slack.search.messages({
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

  async getUserInfo(user) {
    const result = await this.slack.users.info({
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

  async sendMessage(channel, text, thread_ts = null, blocks = null) {
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

    const result = await this.slack.chat.postMessage(messageData);

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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Slack MCP Server running on stdio');
  }
}

const server = new SlackMCPServer();
server.run().catch(console.error);