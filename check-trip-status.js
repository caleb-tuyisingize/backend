const pool = require('./config/pgPool');

async function checkSchedules() {
  try {
    const result = await pool.query(`
      SELECT 
        s.id, 
        s.schedule_date, 
        s.status, 
        s.driver_id,
        d.name as driver_name
      FROM schedules s
      LEFT JOIN drivers d ON s.driver_id = d.id
      WHERE s.schedule_date >= CURRENT_DATE - INTERVAL '1 day'
      ORDER BY s.schedule_date DESC
      LIMIT 10
    `);

    console.log('\n📋 Recent Schedules:\n');
    
    result.rows.forEach((s, idx) => {
      console.log(`${idx + 1}. Schedule ID: ${s.id} | Date: ${s.schedule_date} | Status: ${s.status} | Driver: ${s.driver_name || 'none'}`);
    });

    console.log('\n💡 To activate a trip, the driver must START it from the dashboard.');
    console.log('   Status should be "ACTIVE" or "in_progress" to scan tickets.\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchedules();
