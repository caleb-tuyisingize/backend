const pool = require('./config/pgPool');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running migration: 20260220_add_trip_timestamps.sql\n');
    
    const migrationPath = path.join(__dirname, 'migrations', '20260220_add_trip_timestamps.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
