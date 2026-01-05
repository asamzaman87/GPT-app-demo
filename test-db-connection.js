#!/usr/bin/env node

/**
 * Quick test script to verify PostgreSQL connection
 * Run with: node test-db-connection.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function testConnection() {
  console.log('Testing PostgreSQL connection...\n');
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('   Add it to your .env file or Railway will inject it automatically');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL found');
  console.log(`   Host: ${databaseUrl.split('@')[1]?.split('/')[0] || 'hidden'}\n`);
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : undefined,
  });
  
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL\n');
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'google_calendar_tokens'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Table "google_calendar_tokens" exists');
      
      // Count tokens
      const countResult = await client.query('SELECT COUNT(*) FROM google_calendar_tokens');
      const count = countResult.rows[0].count;
      console.log(`   ${count} token(s) stored in database`);
      
      // Show users (without sensitive data)
      if (count > 0) {
        const users = await client.query(`
          SELECT user_id, email, created_at 
          FROM google_calendar_tokens 
          ORDER BY created_at DESC
        `);
        console.log('\n   Users:');
        users.rows.forEach(user => {
          console.log(`   - ${user.user_id} (${user.email}) - registered ${user.created_at}`);
        });
      }
    } else {
      console.log('❌ Table "google_calendar_tokens" does not exist');
      console.log('   Run the SQL script to create it');
    }
    
    client.release();
    console.log('\n✅ Database migration is ready!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();

