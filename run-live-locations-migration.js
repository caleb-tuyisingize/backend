/**
 * Run live_bus_locations table migration
 * Creates the table for real-time GPS tracking
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const migrationPath = path.join(__dirname, 'migrations', 'create-live-bus-locations-table.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    console.log('🔄 Running migration: create-live-bus-locations-table.sql');
    const client = await pool.connect();
    await client.query(sql);
    client.release();
    console.log('✅ Migration completed successfully');
    console.log('📍 live_bus_locations table created');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
