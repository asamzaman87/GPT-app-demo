# ChatGPT Reservations Manager

A ChatGPT app that helps you manage pending Google Calendar invitations directly from within ChatGPT conversations. Built using OpenAI's Apps SDK with the Model Context Protocol (MCP), featuring multi-user support and a unified React widget interface.

## Features

- 🗓️ **View Pending Invitations** - See all calendar invites awaiting your response
- ✅ **Quick Actions** - Accept, decline, or mark invitations as tentative with one click
- 💬 **Natural Language** - Interact with your calendar through ChatGPT conversations
- 🔐 **Secure OAuth 2.0** - Google Calendar authentication with automatic token refresh
- 👥 **Multi-User Support** - Each ChatGPT user has their own isolated authentication and data
- 🎨 **Modern UI** - Beautiful, theme-aware widget with dark/light mode support
- 🔄 **Real-time Updates** - Refresh invites on-demand with a single click
- 🚀 **Single-Page Widget** - Unified React Router-based interface for seamless navigation

---

## Architecture Overview

### Backend (Express + MCP Server)

```
┌─────────────────────────────────────────────────────────────┐
│                         ChatGPT                              │
│  (Sends MCP requests with openai/subject as user ID)        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ MCP Protocol (OAuth 2.1 Protected)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Server                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MCP OAuth Layer (mcp-oauth.ts)                       │  │
│  │  - Client credentials validation                      │  │
│  │  - Access token generation                            │  │
│  │  - Authorization code flow with PKCE                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MCP Server (mcp-server.ts)                           │  │
│  │  - Handles tool calls (get_pending_reservations,      │  │
│  │    check_auth_status, respond_to_invite)              │  │
│  │  - Serves widget HTML resource                        │  │
│  │  - Extracts user ID from openai/subject               │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Google Auth (google-auth.ts)                         │  │
│  │  - OAuth 2.0 flow with Google                         │  │
│  │  - Token refresh logic                                │  │
│  │  - Per-user authentication state                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Token Store (token-store.ts)                         │  │
│  │  - JSON-based token storage                           │  │
│  │  - Multi-user token management                        │  │
│  │  - Automatic token cleanup                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Calendar Service (calendar-service.ts)               │  │
│  │  - Fetches pending invitations from Google Calendar   │  │
│  │  - Updates RSVP status                                │  │
│  │  - Filters events by user response status             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Frontend (React Widget)

```
┌─────────────────────────────────────────────────────────────┐
│              ChatGPT Widget Container (iframe)               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  CalendarWidget.tsx (React Router)                    │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  WidgetContext (Global State)                   │  │  │
│  │  │  - authData: Authentication state               │  │  │
│  │  │  - invitesData: List of pending invites         │  │  │
│  │  │  - theme: dark/light mode                       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Routes:                                         │  │  │
│  │  │  - / (AuthView)                                  │  │  │
│  │  │    • Not connected: Show Google sign-in         │  │  │
│  │  │    • Connected: Show status + "View Invites"    │  │  │
│  │  │                                                  │  │  │
│  │  │  - /invites (InvitesView)                       │  │  │
│  │  │    • List of pending invitations                │  │  │
│  │  │    • Accept/Decline/Maybe buttons               │  │  │
│  │  │    • Refresh button                             │  │  │
│  │  │    • Inline response status                     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  useOpenAI Hook                                  │  │  │
│  │  │  - window.openai API integration                │  │  │
│  │  │  - callTool() for MCP tool calls                │  │  │
│  │  │  - openExternal() for OAuth flow                │  │  │
│  │  │  - theme detection                              │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## How It Works

### Backend Flow

#### 1. **MCP Connection Initialization**
```typescript
// ChatGPT connects to the MCP server
POST /mcp
Authorization: Bearer <access_token>

// Server validates OAuth token and establishes connection
// Returns server capabilities and available tools
```

#### 2. **User Identification (Multi-User Support)**
```typescript
// Every MCP request includes user ID in metadata
{
  "_meta": {
    "openai/subject": "v1/lCfSEYFrY4Wl6KfrK0Oa7ucHW4p9rUXYcYgFLv6xWNjJ08m5eF3W6l"
  }
}

// Server extracts user ID
function extractUserId(params: any): string {
  return params._meta?.['openai/subject'] || DEFAULT_USER_ID;
}

// All operations are scoped to this user ID
```

#### 3. **Authentication Flow**
```typescript
// Step 1: Check if user is authenticated
check_auth_status() → { authenticated: false, authUrl: "..." }

// Step 2: User clicks "Connect with Google"
openExternal({ href: authUrl }) // Opens Google OAuth consent

// Step 3: Google redirects to callback with auth code
GET /oauth/callback?code=...&state=<userId>

// Step 4: Exchange code for tokens
const { tokens, email } = await exchangeCodeForTokens(code);

// Step 5: Save tokens with user ID
saveTokens(userId, tokens, email);

// Step 6: Widget polls for auth status
check_auth_status() → { authenticated: true, email: "user@example.com" }
```

#### 4. **Fetching Pending Invitations**
```typescript
// Tool call from ChatGPT
get_pending_reservations({ start_date?, end_date? })

// Server flow:
1. Extract userId from request metadata
2. Check if user is authenticated (has valid tokens)
3. If not authenticated → return { authRequired: true, authUrl: "..." }
4. Get authorized OAuth2 client (auto-refreshes token if expired)
5. Fetch events from Google Calendar API
6. Filter to only events where:
   - User is an attendee
   - User's response status is "needsAction"
   - User is not the organizer
7. Return { invites: [...], dateRange: {...}, totalCount: N }
```

#### 5. **Responding to Invitations**
```typescript
// Tool call from ChatGPT
respond_to_invite({ event_id: "abc123", response: "accepted" })

// Server flow:
1. Extract userId from request
2. Get authorized client
3. Fetch event from Google Calendar
4. Update attendee status for this user
5. Patch event with sendUpdates: "all" (notify organizer)
6. Return { success: true, message: "...", newStatus: "accepted" }
```

#### 6. **Token Management**
```typescript
// Automatic token refresh
if (token.expiry_date - 5_minutes < now) {
  // Token expired or about to expire
  const newTokens = await refreshAccessToken(token.refresh_token);
  updateTokens(userId, newTokens);
}

// Token storage structure (data/tokens.json)
{
  "v1/user_id_hash_1": {
    "tokens": {
      "access_token": "...",
      "refresh_token": "...",
      "expiry_date": 1234567890
    },
    "email": "user1@example.com",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "v1/user_id_hash_2": { ... }
}
```

---

### Frontend Flow

#### 1. **Widget Initialization**
```typescript
// CalendarWidget mounts
useOpenAI() // Detects window.openai and reads toolOutput

// Initial data routing
if (toolOutput.invites) → navigate('/invites')
if (toolOutput.authenticated === false) → stay on '/' (AuthView)
if (toolOutput.authenticated === true) → stay on '/' (show connected state)
if (toolOutput.authRequired) → stay on '/' (show sign-in)
```

#### 2. **State Management**
```typescript
// Global state via WidgetContext
const contextValue = {
  theme: 'dark' | 'light',
  isDark: boolean,
  callTool: (name, args) => window.openai.callTool(...),
  openExternal: ({ href }) => window.openai.openExternal(...),
  notifyHeight: () => window.openai.notifyIntrinsicHeight(...),
  setWidgetState: (state) => window.openai.setWidgetState(...),
  authData: { authenticated, email, authUrl },
  setAuthData: (data) => { ... },
  invitesData: { invites, dateRange, totalCount },
  setInvitesData: (data) => { ... }
};

// State persists across route navigation via Context
```

#### 3. **AuthView Component**
```typescript
// Not Connected State
<button onClick={handleConnect}>
  Connect with Google
</button>

function handleConnect() {
  openExternal({ href: authData.authUrl }); // Opens OAuth in new tab
  setIsPolling(true); // Start polling
  
  // Poll every 3 seconds for up to 5 minutes
  setInterval(async () => {
    const result = await callTool('check_auth_status', {});
    if (result.authenticated) {
      setAuthData(result);
      setWidgetState({ authenticated: true, email: result.email });
      setIsPolling(false);
    }
  }, 3000);
}

// Connected State
<button onClick={handleViewInvites}>
  View Pending Invites
</button>

function handleViewInvites() {
  const result = await callTool('get_pending_reservations', {});
  setInvitesData(result);
  navigate('/invites');
}
```

#### 4. **InvitesView Component**
```typescript
// Render list of invites
{invites.map(invite => (
  <InviteCard
    invite={invite}
    onRespond={handleRespond}
  />
))}

// Handle response (inline, no navigation)
async function handleRespond(eventId, response) {
  setStatus('loading');
  await callTool('respond_to_invite', { event_id: eventId, response });
  setStatus(response); // Show "Accepted", "Declined", or "Maybe"
}

// Refresh invites
async function handleRefresh() {
  const result = await callTool('get_pending_reservations', {});
  setInvitesData(result);
}
```

#### 5. **Theme Handling**
```typescript
// Automatic theme detection from window.openai.theme
const theme = window.openai?.theme || 'light';

// Theme-aware CSS classes
const card = (isDark) => isDark 
  ? 'bg-slate-900 border-slate-700 text-white'
  : 'bg-white border-gray-200 text-gray-900';

// Tailwind dark mode
<div className={isDark ? 'dark' : ''}>
  <div className="dark:bg-slate-900 dark:text-white">
    ...
  </div>
</div>
```

---

## API Endpoints

### MCP Protocol Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `POST /mcp` | POST | OAuth Bearer | Main MCP protocol endpoint. Handles all tool calls and resource requests |

### OAuth 2.1 Endpoints (for ChatGPT)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /.well-known/openid-configuration` | GET | OAuth server metadata (RFC 8414) |
| `POST /oauth/register` | POST | Dynamic client registration (RFC 7591) |
| `GET /oauth/authorize` | GET | Authorization endpoint (PKCE flow) |
| `POST /oauth/token` | POST | Token endpoint (client_credentials + authorization_code grants) |
| `GET /oauth/info` | GET | Display OAuth credentials for setup |

### Google OAuth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /auth/google` | GET | Initiate Google OAuth flow (redirects to Google) |
| `GET /oauth/callback` | GET | Google OAuth callback handler. Exchanges code for tokens |
| `GET /auth/status` | GET | Check if current user is authenticated (for testing) |
| `POST /auth/logout` | POST | Revoke tokens and log out user |

### Utility Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /health` | GET | Health check endpoint |
| `GET /` | GET | Server info and status page |

---

## MCP Tools

### 1. `check_auth_status`

Check if the current user is authenticated with Google Calendar.

**Input Schema:**
```json
{}
```

**Output (not authenticated):**
```json
{
  "authenticated": false,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Output (authenticated):**
```json
{
  "authenticated": true,
  "email": "user@example.com"
}
```

**Widget Template:** `ui://widget/calendar-widget.html`

---

### 2. `get_pending_reservations`

Fetch pending calendar invitations that the user hasn't responded to. Automatically prompts for authentication if needed.

**Input Schema:**
```json
{
  "start_date": "2024-01-15T00:00:00Z",  // Optional, defaults to now
  "end_date": "2024-01-30T23:59:59Z"     // Optional, defaults to +14 days
}
```

**Output (authenticated with invites):**
```json
{
  "invites": [
    {
      "eventId": "abc123",
      "summary": "Team Standup",
      "description": "Daily standup meeting",
      "location": "Conference Room A",
      "startTime": "2024-01-16T10:00:00-05:00",
      "endTime": "2024-01-16T10:30:00-05:00",
      "isAllDay": false,
      "organizerEmail": "manager@company.com",
      "organizerName": "Manager Name",
      "attendees": [
        {
          "email": "user@company.com",
          "name": "User Name",
          "status": "needsAction"
        }
      ],
      "calendarLink": "https://www.google.com/calendar/event?eid=..."
    }
  ],
  "dateRange": {
    "start": "2024-01-15T00:00:00Z",
    "end": "2024-01-30T23:59:59Z"
  },
  "totalCount": 1
}
```

**Output (not authenticated):**
```json
{
  "authRequired": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "invites": [],
  "totalCount": 0
}
```

**Widget Template:** `ui://widget/calendar-widget.html`

---

### 3. `respond_to_invite`

Accept, decline, or mark a calendar invitation as tentative.

**Input Schema:**
```json
{
  "event_id": "abc123",               // Required
  "response": "accepted"              // Required: "accepted" | "declined" | "tentative"
}
```

**Output:**
```json
{
  "success": true,
  "message": "You have accepted the invitation \"Team Standup\"",
  "eventId": "abc123",
  "newStatus": "accepted",
  "eventSummary": "Team Standup"
}
```

**Widget Template:** `ui://widget/calendar-widget.html`

---

## Project Structure

```
chatgpt-reservations-manager/
├── package.json                 # Root package with npm workspaces
├── railway.json                 # Railway deployment configuration
├── Dockerfile                   # Docker configuration for Railway
├── Procfile                     # Process file for Railway
├── data/
│   └── tokens.json              # Multi-user token storage (auto-created)
├── server/                      # Backend Express + MCP server
│   ├── src/
│   │   ├── index.ts             # Express server entry point
│   │   │                         - Serves MCP endpoint, OAuth endpoints, Google OAuth
│   │   │
│   │   ├── mcp-server.ts        # MCP protocol handler
│   │   │                         - Registers tools and resources
│   │   │                         - Handles tool calls
│   │   │                         - Serves widget HTML
│   │   │                         - Extracts user ID from openai/subject
│   │   │
│   │   ├── mcp-oauth.ts         # OAuth 2.1 implementation for ChatGPT
│   │   │                         - Client credentials validation
│   │   │                         - Access token generation
│   │   │                         - Authorization code flow with PKCE
│   │   │                         - Dynamic client registration
│   │   │
│   │   ├── google-auth.ts       # Google OAuth 2.0 logic
│   │   │                         - Generate auth URLs
│   │   │                         - Exchange code for tokens
│   │   │                         - Refresh expired tokens
│   │   │                         - Per-user authentication
│   │   │
│   │   ├── token-store.ts       # Token persistence layer
│   │   │                         - JSON-based storage
│   │   │                         - Multi-user token management
│   │   │                         - CRUD operations for tokens
│   │   │                         - Automatic cleanup
│   │   │
│   │   ├── calendar-service.ts  # Google Calendar API integration
│   │   │                         - Fetch pending invitations
│   │   │                         - Filter by response status
│   │   │                         - Update RSVP status
│   │   │
│   │   └── types.ts             # TypeScript type definitions
│   │                             - OAuth tokens, Calendar events, MCP types
│   │
│   ├── dist/                    # Compiled JavaScript (generated)
│   ├── package.json
│   └── tsconfig.json
│
└── widget/                      # React widget (embedded in ChatGPT)
    ├── src/
    │   ├── calendar-widget-entry.tsx  # Widget entry point
    │   │
    │   ├── CalendarWidget.tsx         # Main widget component
    │   │                                - React Router setup
    │   │                                - Context provider
    │   │                                - Initial data routing
    │   │
    │   ├── WidgetContext.tsx           # Global state management
    │   │                                - Auth data
    │   │                                - Invites data
    │   │                                - OpenAI SDK methods
    │   │
    │   ├── useOpenAI.ts                # OpenAI SDK hook
    │   │                                - window.openai integration
    │   │                                - callTool, openExternal, etc.
    │   │                                - Theme detection
    │   │
    │   ├── components/
    │   │   ├── AuthView.tsx            # Authentication view
    │   │   │                            - Not connected: Google sign-in
    │   │   │                            - Connected: Status + "View Invites"
    │   │   │                            - OAuth polling
    │   │   │
    │   │   ├── InvitesView.tsx         # Invitations list view
    │   │   │                            - List of pending invites
    │   │   │                            - InviteCard components
    │   │   │                            - Refresh button
    │   │   │                            - Inline response handling
    │   │   │
    │   │   └── index.ts                # Component exports
    │   │
    │   ├── types.ts                    # TypeScript types (widget-specific)
    │   ├── theme.ts                    # Theme utilities and CSS helpers
    │   ├── main.css                    # Tailwind CSS + custom styles
    │   │
    │   ├── preview-entry.tsx           # Local preview entry point
    │   └── PreviewPage.tsx             # Local preview with mock data
    │
    ├── dist/
    │   └── calendar-widget.html        # Bundled widget (served by MCP)
    │
    ├── preview.html                    # Local preview HTML
    ├── build-widgets.js                # Vite build script
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── tsconfig.json
```

---

## Data Flow

### 1. Initial Widget Load

```
ChatGPT → calls tool → MCP Server
                          ↓
                  check_auth_status or get_pending_reservations
                          ↓
              Returns structured data + widget template
                          ↓
        ChatGPT renders widget with initial data
                          ↓
          Widget detects data type and navigates:
          - authRequired → AuthView (/)
          - invites → InvitesView (/invites)
          - authenticated → AuthView (/) connected state
```

### 2. User Authentication Flow

```
User clicks "Connect with Google"
          ↓
Widget calls openExternal(authUrl)
          ↓
Opens new tab with Google OAuth consent
          ↓
User approves → Google redirects to /oauth/callback?code=...&state=userId
          ↓
Server exchanges code for tokens
          ↓
Server saves tokens with userId in data/tokens.json
          ↓
Widget polls check_auth_status every 3 seconds
          ↓
Server returns { authenticated: true, email: "..." }
          ↓
Widget updates state and shows connected UI
```

### 3. Fetching Invitations

```
User clicks "View Pending Invites"
          ↓
Widget calls callTool('get_pending_reservations', {})
          ↓
MCP Server extracts userId from metadata
          ↓
Server checks authentication (loads tokens)
          ↓
If token expired → auto-refresh with refresh_token
          ↓
Server creates authorized Google Calendar client
          ↓
Fetch events from Google Calendar API
          ↓
Filter to pending invites only
          ↓
Return { invites: [...], totalCount: N }
          ↓
Widget navigates to /invites and displays list
```

### 4. Responding to Invitation

```
User clicks "Accept" on an invite
          ↓
Widget calls callTool('respond_to_invite', { event_id, response })
          ↓
MCP Server extracts userId
          ↓
Server fetches event from Google Calendar
          ↓
Server updates attendee status for this user
          ↓
Server patches event with sendUpdates: 'all'
          ↓
Google notifies organizer of response
          ↓
Server returns { success: true, newStatus: "accepted" }
          ↓
Widget updates InviteCard to show "✓ Accepted" badge
```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# Google OAuth 2.0 Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback  # Update for production

# Server Configuration
PORT=3000
NODE_ENV=development

# MCP OAuth Credentials (for ChatGPT authentication)
# Optional - defaults provided if not set
MCP_OAUTH_CLIENT_ID=chatgpt-mcp-client
MCP_OAUTH_CLIENT_SECRET=chatgpt-mcp-secret-key-2024

# Widget Base URL (for CSP and resource loading)
# Optional - auto-detected from request in development
WIDGET_BASE_URL=https://your-app.railway.app
```

---

## Local Development

### Installation

```bash
# Install all dependencies (server + widget)
npm install

# Build widget
cd widget
npm run build

# Build server
cd ../server
npm run build
```

### Running Locally

```bash
# Option 1: Start server with MCP stdio transport (for ChatGPT)
cd server
npm run start:mcp

# Option 2: Start server with HTTP (for testing API endpoints)
npm run start

# Option 3: Development mode with auto-rebuild
npm run dev
```

### Widget Development

```bash
# Start local preview server with hot reload
cd widget
npm run dev

# Visit http://localhost:5173 to preview widget with mock data
# Toggle between light/dark themes and different views
```

### Building for Production

```bash
# Build everything
npm run build

# This runs:
# 1. widget build → creates dist/calendar-widget.html
# 2. server build → compiles TypeScript to dist/
```

---

## Google Cloud Project Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "ChatGPT Reservations Manager"
3. Enable Google Calendar API

### Step 2: Configure OAuth Consent Screen

1. Go to APIs & Services → OAuth consent screen
2. Select "External" user type
3. Fill required fields:
   - **App name**: ChatGPT Reservations Manager
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Add test users (during development)

### Step 3: Create OAuth 2.0 Credentials

1. Go to APIs & Services → Credentials
2. Create OAuth client ID → Web application
3. Add authorized origins:
   - `http://localhost:3000` (development)
   - `https://your-app.railway.app` (production)
4. Add redirect URIs:
   - `http://localhost:3000/oauth/callback`
   - `https://your-app.railway.app/oauth/callback`
5. Copy Client ID and Client Secret to `.env`

### Step 4: Publish App (Production)

1. Go to OAuth consent screen
2. Click "Publish App"
3. Submit for verification (if using sensitive scopes)

---

## Railway Deployment

### Step 1: Prepare Repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy to Railway

1. Go to [Railway.app](https://railway.app/)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects configuration from `railway.json`

### Step 3: Configure Environment Variables

Add in Railway dashboard Variables tab:

```
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_REDIRECT_URI=https://your-app.railway.app/oauth/callback
PORT=3000
NODE_ENV=production
WIDGET_BASE_URL=https://your-app.railway.app
```

### Step 4: Update Google OAuth Settings

1. Go to Google Cloud Console → Credentials
2. Edit OAuth client
3. Add production URLs:
   - Origin: `https://your-app.railway.app`
   - Redirect URI: `https://your-app.railway.app/oauth/callback`

---

## ChatGPT Integration

### Step 1: Register MCP Server in ChatGPT

1. Open ChatGPT → Settings → Personalization
2. Add MCP server:
   - **Server URL**: `https://your-app.railway.app/mcp`
   - **Authentication**: OAuth 2.0
   - **Client ID**: `chatgpt-mcp-client` (from your MCP_OAUTH_CLIENT_ID)
   - **Client Secret**: `chatgpt-mcp-secret-key-2024` (from MCP_OAUTH_CLIENT_SECRET)
   - **Token URL**: `https://your-app.railway.app/oauth/token`

### Step 2: Test in ChatGPT

Try these commands:

- "Show my pending calendar invites"
- "What meetings haven't I responded to?"
- "Do I have any calendar invitations?"
- "Accept the meeting with [person name]"
- "Decline all meetings on Friday"

The widget will automatically appear with your data!

---

## Multi-User Support

### How It Works

Each ChatGPT user is identified by a unique `openai/subject` ID in the MCP request metadata:

```typescript
{
  "_meta": {
    "openai/subject": "v1/uniqueUserIdHash..."
  }
}
```

**Token Storage:**
- Tokens are stored in `data/tokens.json` keyed by user ID
- Each user has isolated authentication state
- Automatic token refresh per user
- Secure and private - no cross-user data leakage

**Example:**
```json
{
  "v1/user_1_hash": {
    "tokens": { "access_token": "...", ... },
    "email": "user1@gmail.com",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "v1/user_2_hash": {
    "tokens": { "access_token": "...", ... },
    "email": "user2@gmail.com",
    "createdAt": "2024-01-02T00:00:00Z"
  }
}
```

---

## Widget Architecture

### Key Technologies

- **React 18** - UI framework
- **React Router 6** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Vite** - Build tool with single-file output
- **OpenAI Apps SDK** - ChatGPT widget integration

### Unified Widget Pattern

Instead of separate HTML files for each view, we use a single widget with React Router:

**Before (legacy):**
- `auth-status.html`
- `pending-invites.html`
- `respond-result.html`

**After (unified):**
- `calendar-widget.html` (single file with React Router)
  - Route `/` → AuthView
  - Route `/invites` → InvitesView

### Benefits

✅ Seamless navigation without page reloads  
✅ Shared state across views via Context  
✅ Smaller bundle size (one React instance)  
✅ Better UX with smooth transitions  
✅ Easier maintenance (single codebase)  

---

## Troubleshooting

### "Resource not found" in ChatGPT

**Problem:** ChatGPT can't find the widget resource  
**Solution:**
1. Disconnect and reconnect MCP server in ChatGPT settings
2. Verify server is running and accessible
3. Check server logs for resource registration

### OAuth "redirect_uri_mismatch"

**Problem:** Google OAuth fails with redirect URI error  
**Solution:**
1. Ensure `.env` GOOGLE_REDIRECT_URI exactly matches Google Cloud Console
2. Check for trailing slashes
3. Verify protocol (http vs https)

### Token Refresh Errors

**Problem:** "Access token expired and no refresh token available"  
**Solution:**
1. Delete `data/tokens.json`
2. Re-authenticate in ChatGPT
3. Ensure OAuth consent includes `access_type: 'offline'`

### Widget Shows White Screen

**Problem:** Widget doesn't load in ChatGPT  
**Solution:**
1. Check browser console for CSP errors
2. Verify `openai/widgetCSP` configuration in `mcp-server.ts`
3. Ensure widget HTML is valid and bundled correctly

### Multi-User Issues

**Problem:** Users seeing each other's data  
**Solution:**
1. Verify `openai/subject` is being extracted correctly
2. Check server logs for user ID in tool calls
3. Ensure token-store is using user ID as key

---

## Security Considerations

### Token Storage

- Tokens stored in JSON file (suitable for MVP/small deployments)
- For production: Consider Redis or encrypted database
- Automatic cleanup of expired tokens
- Per-user isolation

### OAuth Flow

- Uses Google OAuth 2.0 with offline access
- Refresh tokens for long-lived sessions
- Automatic token refresh before expiration
- Secure token exchange

### CSP Policy

```typescript
'openai/widgetCSP': {
  connect_domains: ['https://chatgpt.com', baseUrl, 'https://accounts.google.com'],
  resource_domains: [baseUrl, 'https://*.oaistatic.com'],
  redirect_domains: ['https://accounts.google.com'],
}
```

### MCP OAuth

- Bearer token authentication for all MCP requests
- Client credentials validation
- Authorization code flow with PKCE
- Dynamic client registration support

---

## Performance

### Widget Bundle

- Single HTML file with embedded CSS and JS
- Optimized with Vite (tree-shaking, minification)
- Typical size: ~200KB (React + Router + Tailwind)

### API Efficiency

- Token refresh only when needed (5-minute buffer)
- Calendar API: Single request per invitation fetch
- Efficient filtering on server side
- Minimal data transfer

### Caching

- Widget HTML served with MCP resource caching
- Auth state cached in WidgetContext
- No unnecessary re-fetches

---

## Testing

### Manual Testing Checklist

**Authentication Flow:**
- [ ] Initial load shows "Connect with Google"
- [ ] OAuth opens in new tab
- [ ] After approval, widget auto-updates to connected state
- [ ] Email displays correctly
- [ ] Re-opening ChatGPT shows connected state (persistent)

**Invitations List:**
- [ ] "View Pending Invites" loads invitation list
- [ ] Invites display with correct details
- [ ] Empty state shows "All Caught Up" message
- [ ] Refresh button updates the list

**RSVP Actions:**
- [ ] Accept button works and shows "✓ Accepted"
- [ ] Decline button works and shows "✗ Declined"
- [ ] Maybe button works and shows "? Maybe"
- [ ] Organizer receives email notification
- [ ] Status persists in Google Calendar

**Multi-User:**
- [ ] Two different ChatGPT accounts can authenticate separately
- [ ] Each user sees only their invitations
- [ ] No data leakage between users

**Theme Support:**
- [ ] Light mode displays correctly
- [ ] Dark mode displays correctly
- [ ] Theme switches dynamically

---

## Future Enhancements

### Potential Features

- [ ] **Database Storage** - PostgreSQL/MongoDB instead of JSON
- [ ] **Calendar Sync** - Two-way sync with Google Calendar
- [ ] **Notifications** - Alert when new invites arrive
- [ ] **Bulk Actions** - Accept/decline multiple invites at once
- [ ] **Custom Responses** - Add personal notes when responding
- [ ] **Calendar Creation** - Create new events from ChatGPT
- [ ] **Multiple Calendars** - Support for work/personal calendars
- [ ] **Analytics** - Track response patterns and insights
- [ ] **Reminder Settings** - Configure invite reminder preferences
- [ ] **Mobile Optimization** - Better mobile widget experience

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues, questions, or contributions:

1. Check existing issues on GitHub
2. Open a new issue with detailed description
3. Include server logs and browser console output
4. Specify environment (local/Railway, ChatGPT version)

---

## Credits

Built with:
- [OpenAI Apps SDK](https://platform.openai.com/docs/apps)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Google Calendar API](https://developers.google.com/calendar)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)

---

**Happy Calendar Managing! 🗓️✨**
