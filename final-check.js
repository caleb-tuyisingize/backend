const pool = require('./config/pgPool');

async function finalCheck() {
  try {
    const result = await pool.query(`
      SELECT 
        s.id as schedule_id,
        s.status as schedule_status,
        COUNT(t.id) as confirmed_tickets
      FROM schedules s
      LEFT JOIN tickets t ON s.id = t.schedule_id AND t.status = 'CONFIRMED'
      WHERE s.status = 'in_progress'
      GROUP BY s.id, s.status
    `);

    if (result.rows.length === 0) {
      console.log('\n❌ No active (in_progress) schedule found!');
      console.log('   Start a trip from the dashboard first.\n');
      await pool.end();
      return;
    }

    const schedule = result.rows[0];
    console.log('\n✅ READY TO SCAN TICKETS!');
    console.log('═'.repeat(60));
    console.log(`Schedule ID: ${schedule.schedule_id}`);
    console.log(`Status: ${schedule.schedule_status}`);
    console.log(`Confirmed Tickets: ${schedule.confirmed_tickets}`);
    console.log('═'.repeat(60));

    // Get a few sample tickets to test
    const tickets = await pool.query(`
      SELECT 
        t.id,
        t.booking_ref,
        t.seat_number,
        u.full_name
      FROM tickets t
      INNER JOIN users u ON t.passenger_id = u.id
      WHERE t.schedule_id = $1 AND t.status = 'CONFIRMED'
      ORDER BY t.seat_number
      LIMIT 5
    `, [schedule.schedule_id]);

    console.log('\n📋 Sample tickets you can scan:\n');
tickets.rows.forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.full_name} - Seat ${t.seat_number}`);
      console.log(`   📱 Scan this: ${t.booking_ref}`);
      console.log(`   🆔 Or this: ${t.id}`);
      console.log('');
    });

    console.log('═'.repeat(60));
    console.log('🎫 TICKET SCANNING IS NOW ENABLED!');
    console.log('   Go to the Driver Dashboard and scan any QR code above.');
    console.log('═'.repeat(60));
    console.log('\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

finalCheck();
