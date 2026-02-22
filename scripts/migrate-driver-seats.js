/**
 * Migration Script: Add is_driver column and mark driver seats
 * 
 * This script:
 * 1. Adds is_driver column to seats table
 * 2. Marks seat #1 as driver seat for all buses
 * 3. Provides verification output
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

// Allow disabling SSL for local dev via DB_SSL=false
const useDbSsl = process.env.DB_SSL !== 'false';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useDbSsl ? { require: true, rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting driver seat migration...\n');
    
    // Step 1: Add is_driver column
    console.log('📋 Step 1: Adding is_driver column...');
    await client.query(`
      ALTER TABLE seats 
      ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT false;
    `);
    console.log('✅ Column added successfully\n');
    
    // Step 2: Create index
    console.log('📋 Step 2: Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_seats_is_driver ON seats(is_driver);
    `);
    console.log('✅ Index created successfully\n');
    
    // Step 3: Get count before update
    const beforeResult = await client.query(`
      SELECT COUNT(*) as count FROM seats WHERE seat_number = '1';
    `);
    const seatCount = parseInt(beforeResult.rows[0].count);
    console.log(`📋 Step 3: Found ${seatCount} seat(s) with seat_number='1'\n`);
    
    // Step 4: Mark seat #1 as driver for all buses
    console.log('📋 Step 4: Marking seat #1 as driver seat...');
    const updateResult = await client.query(`
      UPDATE seats 
      SET is_driver = true 
      WHERE seat_number = '1';
    `);
    console.log(`✅ Updated ${updateResult.rowCount} seat(s) as driver seats\n`);
    
    // Step 5: Verify changes
    console.log('📋 Step 5: Verifying changes...');
    const verifyResult = await client.query(`
      SELECT 
        bus_id, 
        seat_number, 
        is_driver,
        row,
        col,
        side
      FROM seats 
      WHERE is_driver = true
      ORDER BY bus_id, seat_number;
    `);
    
    console.log('✅ Driver seats verified:');
    console.table(verifyResult.rows);
    
    // Step 6: Show summary by bus
    console.log('\n📊 Summary by bus:');
    const summaryResult = await client.query(`
      SELECT 
        bus_id,
        COUNT(*) FILTER (WHERE is_driver = true) as driver_seats,
        COUNT(*) FILTER (WHERE is_driver = false OR is_driver IS NULL) as passenger_seats,
        COUNT(*) as total_seats
      FROM seats
      GROUP BY bus_id
      ORDER BY bus_id;
    `);
    console.table(summaryResult.rows);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
