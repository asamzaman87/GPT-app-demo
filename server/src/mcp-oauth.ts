/**
 * Simple OAuth 2.0 implementation for ChatGPT MCP authentication
 * Uses client credentials flow
 */

import crypto from 'crypto';

// Store for issued tokens (in production, use Redis or a database)
const issuedTokens: Map<string, { expiresAt: number; clientId: string }> = new Map();

// Token expiration time (1 hour)
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Get OAuth credentials from environment variables
 */
export function getOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MCP_OAUTH_CLIENT_ID || 'chatgpt-mcp-client';
  const clientSecret = process.env.MCP_OAUTH_CLIENT_SECRET || 'chatgpt-mcp-secret-key-2024';
  return { clientId, clientSecret };
}

/**
 * Validate client credentials
 */
export function validateClientCredentials(clientId: string, clientSecret: string): boolean {
  const { clientId: validId, clientSecret: validSecret } = getOAuthCredentials();
  return clientId === validId && clientSecret === validSecret;
}

/**
 * Generate an access token
 */
export function generateAccessToken(clientId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  
  issuedTokens.set(token, { expiresAt, clientId });
  
  // Clean up expired tokens periodically
  cleanupExpiredTokens();
  
  return token;
}

/**
 * Validate an access token
 */
export function validateAccessToken(token: string): boolean {
  const tokenData = issuedTokens.get(token);
  
  if (!tokenData) {
    return false;
  }
  
  if (Date.now() > tokenData.expiresAt) {
    issuedTokens.delete(token);
    return false;
  }
  
  return true;
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, data] of issuedTokens.entries()) {
    if (now > data.expiresAt) {
      issuedTokens.delete(token);
    }
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Get token info for response
 */
export function getTokenResponse(accessToken: string): {
  access_token: string;
  token_type: string;
  expires_in: number;
} {
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(TOKEN_EXPIRY_MS / 1000),
  };
}

