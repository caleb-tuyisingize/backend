const pool = require('./config/pgPool');

async function checkScheduleColumns() {
  const client = await pool.connect();
  try {
    // Query to get all columns from schedules table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'schedules'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n=== SCHEDULES TABLE COLUMNS ===\n');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(25)} | ${row.data_type.padEnd(20)} | Nullable: ${row.is_nullable}`);
    });
    console.log('\n================================\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkScheduleColumns();
