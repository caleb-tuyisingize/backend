const pool = require('./config/pgPool');

async function checkSchedules() {
  try {
    const result = await pool.query(`
      SELECT 
        s.id, 
        s.schedule_date, 
        s.departure_time, 
        s.status, 
        s.driver_id,
        d.name as driver_name,
        COUNT(t.id) as ticket_count
      FROM schedules s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN tickets t ON s.id = t.schedule_id AND t.status IN ('CONFIRMED', 'CHECKED_IN')
      GROUP BY s.id, s.schedule_date, s.departure_time, s.status, s.driver_id, d.name
      ORDER BY s.schedule_date DESC, s.departure_time DESC
      LIMIT 20
    `);

    console.log('\n📋 Recent Schedules:\n');
    console.log('═'.repeat(100));
    
    result.rows.forEach((s, idx) => {
      console.log(`${idx + 1}. ID: ${s.id}`);
      console.log(`   Date: ${s.schedule_date} ${s.departure_time}`);
      console.log(`   Status: ${s.status}`);
      console.log(`   Driver: ${s.driver_name || 'Not assigned'} (ID: ${s.driver_id || 'none'})`);
      console.log(`   Tickets: ${s.ticket_count}`);
      console.log('─'.repeat(100));
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchedules();
