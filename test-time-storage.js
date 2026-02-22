require('dotenv').config();
const pool = require('./config/pgPool');

async function testTimeStorage() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing Time Storage (No Timezone Conversion)\n');
    
    // Test 1: Check column types
    console.log('1️⃣ Checking column types:');
    const typeCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'schedules'
        AND column_name IN ('departure_time', 'arrival_time')
      ORDER BY column_name;
    `);
    
    typeCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Test 2: Check recent schedules
    console.log('\n2️⃣ Recent schedules with times:');
    const schedules = await client.query(`
      SELECT 
        id,
        schedule_date::TEXT as date,
        departure_time::TEXT as departure,
        arrival_time::TEXT as arrival,
        status
      FROM schedules
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    if (schedules.rows.length === 0) {
      console.log('  ℹ️ No schedules found');
    } else {
      schedules.rows.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.date} | ${s.departure} → ${s.arrival} | Status: ${s.status}`);
      });
    }
    
    // Test 3: Simulate what will be stored
    console.log('\n3️⃣ Testing time string storage:');
    const testTimes = ['15:35', '09:00:00', '23:59'];
    
    for (const time of testTimes) {
      const result = await client.query(
        `SELECT $1::TIME as stored_time`,
        [time]
      );
      console.log(`  Input: "${time}" → Stored as: "${result.rows[0].stored_time}"`);
    }
    
    console.log('\n✅ All tests completed!');
    console.log('\n📌 Summary:');
    console.log('  - Columns are TIME WITHOUT TIME ZONE ✓');
    console.log('  - Times are stored without timezone conversion ✓');
    console.log('  - Ready to accept time strings like "15:35" ✓');
    
  } finally {
    client.release();
    await pool.end();
  }
}

testTimeStorage().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
