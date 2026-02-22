const pool = require('./config/pgPool');

async function checkAll() {
  try {
    const result = await pool.query(`
      SELECT 
        s.id as schedule_id,
        s.status,
        s.schedule_date,
        s.driver_id,
        COUNT(t.id) FILTER (WHERE t.status = 'CONFIRMED') as confirmed,
        COUNT(t.id) FILTER (WHERE t.status = 'CHECKED_IN') as checked_in
      FROM schedules s
      LEFT JOIN tickets t ON s.id = t.schedule_id
      WHERE s.status IN ('in_progress', 'scheduled')
      GROUP BY s.id, s.status, s.schedule_date, s.driver_id
      ORDER BY s.status DESC, s.schedule_date DESC
      LIMIT 20
    `);

    console.log('\n📋 ALL SCHEDULES:\n');
    console.log('═'.repeat(100));
    
    result.rows.forEach((s, idx) => {
      console.log(`${idx + 1}. Schedule: ${s.schedule_id}`);
      console.log(`   Status: ${s.status} | Date: ${s.schedule_date}`);
      console.log(`   Driver: ${s.driver_id || 'NOT ASSIGNED'}`);
      console.log(`   Tickets: ${s.confirmed} confirmed, ${s.checked_in} checked-in`);
      console.log('─'.repeat(100));
    });

    // Show tickets for in_progress schedules
    console.log('\n🎫 TICKETS ON IN_PROGRESS SCHEDULES:\n');
    
    const ticketsResult = await pool.query(`
      SELECT 
        t.id,
        t.booking_ref,
        t.seat_number,
        t.status,
        t.schedule_id,
        u.full_name,
        s.status as schedule_status
      FROM tickets t
      INNER JOIN users u ON t.passenger_id = u.id
      INNER JOIN schedules s ON t.schedule_id = s.id
      WHERE s.status = 'in_progress'
        AND t.status IN ('CONFIRMED', 'CHECKED_IN')
      ORDER BY t.schedule_id, t.seat_number
      LIMIT 30
    `);

    if (ticketsResult.rows.length === 0) {
      console.log('   ❌ No tickets found on in_progress schedules!\n');
    } else {
      const bySchedule = {};
      ticketsResult.rows.forEach(t => {
        if (!bySchedule[t.schedule_id]) bySchedule[t.schedule_id] = [];
        bySchedule[t.schedule_id].push(t);
      });

      Object.keys(bySchedule).forEach((schedId, idx) => {
        console.log(`Schedule #${idx + 1}: ${schedId}`);
        bySchedule[schedId].forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.full_name} - Seat ${t.seat_number} - ${t.status}`);
          console.log(`     Booking: ${t.booking_ref}`);
          console.log(`     Ticket ID: ${t.id}`);
        });
        console.log('');
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAll();
