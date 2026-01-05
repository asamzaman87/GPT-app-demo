import pg from 'pg';
import { OAuth2Tokens, StoredTokenData } from './types.js';

const { Pool } = pg;

// PostgreSQL connection pool
let pool: pg.Pool | null = null;

/**
 * Get or create the database connection pool
 */
function getPool(): pg.Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Required for Railway and most cloud PostgreSQL
      } : undefined,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Log pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
    
    console.log('PostgreSQL connection pool initialized');
  }
  
  return pool;
}

/**
 * Save tokens for a user
 */
export async function saveTokens(userId: string, tokens: OAuth2Tokens, email: string): Promise<void> {
  const pool = getPool();
  const now = new Date();
  
  try {
    // Check if user already exists to preserve createdAt
    const checkResult = await pool.query(
      'SELECT created_at FROM google_calendar_tokens WHERE user_id = $1',
      [userId]
    );
    
    const createdAt = checkResult.rows.length > 0 ? checkResult.rows[0].created_at : now;
    
    await pool.query(`
      INSERT INTO google_calendar_tokens (
        user_id, access_token, refresh_token, scope, token_type, expiry_date, email, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        scope = EXCLUDED.scope,
        token_type = EXCLUDED.token_type,
        expiry_date = EXCLUDED.expiry_date,
        email = EXCLUDED.email,
        updated_at = EXCLUDED.updated_at
    `, [
      userId,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.scope,
      tokens.token_type,
      tokens.expiry_date || null,
      email,
      createdAt,
      now
    ]);
    
    console.log(`Tokens saved for user: ${userId}`);
  } catch (error) {
    console.error('Error saving tokens:', error);
    throw error;
  }
}

/**
 * Get tokens for a user
 */
export async function getTokens(userId: string): Promise<StoredTokenData | null> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT * FROM google_calendar_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      tokens: {
        access_token: row.access_token,
        refresh_token: row.refresh_token || undefined,
        scope: row.scope,
        token_type: row.token_type,
        expiry_date: row.expiry_date || undefined,
      },
      email: row.email,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  } catch (error) {
    console.error('Error getting tokens:', error);
    throw error;
  }
}

/**
 * Delete tokens for a user
 */
export async function deleteTokens(userId: string): Promise<boolean> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'DELETE FROM google_calendar_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`Tokens deleted for user: ${userId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting tokens:', error);
    throw error;
  }
}

/**
 * Check if user has valid tokens (not expired)
 */
export async function hasValidTokens(userId: string): Promise<boolean> {
  const data = await getTokens(userId);
  
  if (!data || !data.tokens) {
    return false;
  }
  
  // Check if access token exists
  if (!data.tokens.access_token) {
    return false;
  }
  
  // Check expiry if available
  if (data.tokens.expiry_date) {
    const now = Date.now();
    // Consider token invalid if it expires within 5 minutes
    const bufferMs = 5 * 60 * 1000;
    if (data.tokens.expiry_date - bufferMs < now) {
      // Token is expired or about to expire
      // But if we have a refresh token, we can still use it
      return !!data.tokens.refresh_token;
    }
  }
  
  return true;
}

/**
 * Update tokens after refresh
 */
export async function updateTokens(userId: string, newTokens: Partial<OAuth2Tokens>): Promise<void> {
  const data = await getTokens(userId);
  
  if (!data) {
    throw new Error(`No existing tokens for user: ${userId}`);
  }
  
  const updatedTokens: OAuth2Tokens = {
    ...data.tokens,
    ...newTokens,
  };
  
  await saveTokens(userId, updatedTokens, data.email);
}

/**
 * Get all user IDs with stored tokens
 */
export async function getAllUserIds(): Promise<string[]> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT user_id FROM google_calendar_tokens ORDER BY created_at DESC'
    );
    
    return result.rows.map(row => row.user_id);
  } catch (error) {
    console.error('Error getting all user IDs:', error);
    throw error;
  }
}

/**
 * Get user ID by email (for looking up during OAuth callback)
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT user_id FROM google_calendar_tokens WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].user_id;
  } catch (error) {
    console.error('Error getting user ID by email:', error);
    throw error;
  }
}

/**
 * Clean up expired tokens (utility function)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const pool = getPool();
  const now = Date.now();
  
  try {
    const result = await pool.query(
      'DELETE FROM google_calendar_tokens WHERE expiry_date < $1 AND refresh_token IS NULL',
      [now]
    );
    
    const removedCount = result.rowCount || 0;
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired tokens`);
    }
    
    return removedCount;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    throw error;
  }
}

/**
 * Close the database connection pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL connection pool closed');
  }
}
