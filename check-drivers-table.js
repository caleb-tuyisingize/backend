const pool = require('./config/pgPool');

async function checkDriversTable() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Checking drivers table structure...\n');
    
    // Get table structure
    const structureQuery = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'drivers'
      ORDER BY ordinal_position
    `);
    
    console.log('Drivers table columns:');
    structureQuery.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkDriversTable();
