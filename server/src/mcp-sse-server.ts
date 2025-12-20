/**
 * Reservations Manager MCP Server (SSE transport)
 * 
 * Following the official OpenAI Apps SDK examples pattern:
 * - SSE transport for MCP communication
 * - Widget HTML served as MCP resources
 * - Proper _meta with openai/outputTemplate
 * - structuredContent for widget data
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getPendingReservations, respondToInvite } from './calendar-service.js';
import { isAuthenticated, getAuthUrl, getUserEmail, DEFAULT_USER_ID } from './google-auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '..', 'assets');

const MIME_TYPE = 'text/html+skybridge';

// Widget definitions
const WIDGETS = {
  pendingInvites: {
    uri: 'ui://widget/pending-invites.html',
    file: 'pending-invites.html',
    name: 'Pending Invites Widget',
  },
  authStatus: {
    uri: 'ui://widget/auth-status.html',
    file: 'auth-status.html',
    name: 'Auth Status Widget',
  },
  respondResult: {
    uri: 'ui://widget/respond-result.html',
    file: 'respond-result.html',
    name: 'Respond Result Widget',
  },
};

function readWidgetHtml(filename: string): string {
  const filePath = path.join(ASSETS_DIR, filename);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  
  // Try fallback with hash suffix
  const baseName = filename.replace('.html', '');
  const candidates = fs.readdirSync(ASSETS_DIR)
    .filter(f => f.startsWith(baseName) && f.endsWith('.html'))
    .sort();
  
  if (candidates.length > 0) {
    return fs.readFileSync(path.join(ASSETS_DIR, candidates[candidates.length - 1]), 'utf8');
  }
  
  throw new Error(`Widget HTML "${filename}" not found in ${ASSETS_DIR}`);
}

function toolMeta(widgetUri: string, invoking: string, invoked: string) {
  return {
    'openai/outputTemplate': widgetUri,
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
    'openai/widgetAccessible': true,
  };
}

// Tool schemas
const getPendingSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const respondSchema = z.object({
  event_id: z.string(),
  response: z.enum(['accepted', 'declined', 'tentative']),
});

const tools: Tool[] = [
  {
    name: 'check_auth_status',
    title: 'Check Authentication Status',
    description: 'Check if the user is authenticated with Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    _meta: toolMeta(
      WIDGETS.authStatus.uri,
      'Checking authentication...',
      'Authentication status retrieved'
    ),
  },
  {
    name: 'get_pending_reservations',
    title: 'Get Pending Reservations',
    description: 'Fetch pending calendar invitations that the user has not responded to.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in ISO 8601 format. Defaults to now.',
        },
        end_date: {
          type: 'string',
          description: 'End date in ISO 8601 format. Defaults to 14 days from now.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    _meta: toolMeta(
      WIDGETS.pendingInvites.uri,
      'Fetching pending reservations...',
      'Reservations retrieved'
    ),
  },
  {
    name: 'respond_to_invite',
    title: 'Respond to Invite',
    description: 'Accept, decline, or mark a calendar invitation as tentative.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'The unique identifier of the calendar event.',
        },
        response: {
          type: 'string',
          enum: ['accepted', 'declined', 'tentative'],
          description: 'The response to send.',
        },
      },
      required: ['event_id', 'response'],
      additionalProperties: false,
    },
    _meta: toolMeta(
      WIDGETS.respondResult.uri,
      'Sending response...',
      'Response sent'
    ),
  },
];

const resources: Resource[] = Object.values(WIDGETS).map(widget => ({
  name: widget.name,
  uri: widget.uri,
  description: `${widget.name} markup`,
  mimeType: MIME_TYPE,
  _meta: toolMeta(widget.uri, '', ''),
}));

function createReservationsServer(baseUrl: string): Server {
  const server = new Server(
    {
      name: 'reservations-manager',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async (_request: ListResourcesRequest) => {
    return { resources };
  });

  // Read resource (return widget HTML)
  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const uri = request.params.uri;
    const widget = Object.values(WIDGETS).find(w => w.uri === uri);
    
    if (!widget) {
      throw new Error(`Resource not found: ${uri}`);
    }

    const html = readWidgetHtml(widget.file);
    return {
      contents: [
        {
          uri,
          mimeType: MIME_TYPE,
          text: html,
          _meta: toolMeta(uri, '', ''),
        },
      ],
    };
  });

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async (_request: ListToolsRequest) => {
    return { tools };
  });

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;
    const userId = DEFAULT_USER_ID;

    switch (name) {
      case 'check_auth_status': {
        const authenticated = isAuthenticated(userId);
        const structuredContent = {
          authenticated,
          email: authenticated ? getUserEmail(userId) : null,
          authUrl: authenticated ? null : getAuthUrl(baseUrl),
        };

        return {
          content: [
            {
              type: 'text',
              text: authenticated
                ? `Authenticated as ${structuredContent.email}`
                : 'Not authenticated. Please click the link to sign in with Google.',
            },
          ],
          structuredContent,
          _meta: toolMeta(
            WIDGETS.authStatus.uri,
            'Checking authentication...',
            'Authentication status retrieved'
          ),
        };
      }

      case 'get_pending_reservations': {
        const params = getPendingSchema.parse(args ?? {});
        
        if (!isAuthenticated(userId)) {
          return {
            content: [{ type: 'text', text: 'Please authenticate first.' }],
            structuredContent: {
              authenticated: false,
              authUrl: getAuthUrl(baseUrl),
              reservations: [],
            },
            _meta: toolMeta(
              WIDGETS.authStatus.uri,
              'Checking authentication...',
              'Authentication required'
            ),
          };
        }

        const reservations = await getPendingReservations(
          userId,
          params.start_date,
          params.end_date
        );

        return {
          content: [
            {
              type: 'text',
              text: `Found ${reservations.length} pending reservation(s).`,
            },
          ],
          structuredContent: {
            authenticated: true,
            reservations,
          },
          _meta: toolMeta(
            WIDGETS.pendingInvites.uri,
            'Fetching pending reservations...',
            'Reservations retrieved'
          ),
        };
      }

      case 'respond_to_invite': {
        const params = respondSchema.parse(args);
        
        if (!isAuthenticated(userId)) {
          return {
            content: [{ type: 'text', text: 'Please authenticate first.' }],
            structuredContent: {
              success: false,
              error: 'Not authenticated',
              authUrl: getAuthUrl(baseUrl),
            },
            _meta: toolMeta(
              WIDGETS.authStatus.uri,
              'Checking authentication...',
              'Authentication required'
            ),
          };
        }

        const result = await respondToInvite(userId, params.event_id, params.response);

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `Successfully ${params.response} the invitation.`
                : `Failed to respond: ${result.message}`,
            },
          ],
          structuredContent: result,
          _meta: toolMeta(
            WIDGETS.respondResult.uri,
            'Sending response...',
            'Response sent'
          ),
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

export function createMCPHandler(baseUrl: string) {
  const ssePath = '/mcp';
  const postPath = '/mcp/messages';

  async function handleSseRequest(res: ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const server = createReservationsServer(baseUrl);
    const transport = new SSEServerTransport(postPath, res);
    const sessionId = transport.sessionId;

    sessions.set(sessionId, { server, transport });

    transport.onclose = async () => {
      sessions.delete(sessionId);
      await server.close();
    };

    transport.onerror = (error) => {
      console.error('SSE transport error', error);
    };

    try {
      await server.connect(transport);
    } catch (error) {
      sessions.delete(sessionId);
      console.error('Failed to start SSE session', error);
      if (!res.headersSent) {
        res.writeHead(500).end('Failed to establish SSE connection');
      }
    }
  }

  async function handlePostMessage(req: IncomingMessage, res: ServerResponse, url: URL) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      res.writeHead(400).end('Missing sessionId query parameter');
      return;
    }

    const session = sessions.get(sessionId);

    if (!session) {
      res.writeHead(404).end('Unknown session');
      return;
    }

    try {
      await session.transport.handlePostMessage(req, res);
    } catch (error) {
      console.error('Failed to process message', error);
      if (!res.headersSent) {
        res.writeHead(500).end('Failed to process message');
      }
    }
  }

  return { ssePath, postPath, handleSseRequest, handlePostMessage };
}

