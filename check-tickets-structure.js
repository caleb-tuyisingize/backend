require('dotenv').config();
const pool = require('./config/pgPool');

async function checkTicketsStructure() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Tickets Table Structure\n');
    
    // Get columns
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tickets'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Tickets Table Columns:');
    columns.rows.forEach((col, i) => {
      console.log(`  ${i + 1}. ${col.column_name} (${col.data_type})`);
    });
    
    console.log('\n🔍 Sample Ticket Data:');
    const sample = await client.query(`
      SELECT * FROM tickets LIMIT 1;
    `);
    
    if (sample.rows.length > 0) {
      console.log('  Sample:', JSON.stringify(sample.rows[0], null, 2));
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkTicketsStructure().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
