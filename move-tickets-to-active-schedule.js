const pool = require('./config/pgPool');

async function moveTicketsToActiveSchedule() {
  try {
    // Find the in_progress schedule
    const activeSchedule = await pool.query(`
      SELECT id, schedule_date, departure_time
      FROM schedules
      WHERE status = 'in_progress'
      LIMIT 1
    `);

    if (activeSchedule.rows.length === 0) {
      console.log('❌ No in_progress schedule found!');
      console.log('   You need to START a trip first from the dashboard.');
      await pool.end();
      return;
    }

    const activeScheduleId = activeSchedule.rows[0].id;
    console.log(`\n✅ Found active schedule: ${activeScheduleId}`);
    console.log(`   Date: ${activeSchedule.rows[0].schedule_date}`);
    console.log(`   Time: ${activeSchedule.rows[0].departure_time}\n`);

    // Find tickets on non-active schedules for MUGENZI
    const inactiveTickets = await pool.query(`
      SELECT 
        t.id,
        t.booking_ref,
        t.seat_number,
        t.status,
        t.schedule_id,
        s.status as schedule_status,
        u.full_name
      FROM tickets t
      INNER JOIN schedules s ON t.schedule_id = s.id
      INNER JOIN users u ON t.passenger_id = u.id
      WHERE s.status != 'in_progress' 
        AND t.status IN ('CONFIRMED', 'CHECKED_IN')
        AND s.schedule_date >= CURRENT_DATE - INTERVAL '1 day'
      ORDER BY t.seat_number
      LIMIT 20
    `);

    if (inactiveTickets.rows.length === 0) {
      console.log('✅ All tickets are already on active schedules!');
      await pool.end();
      return;
    }

    console.log(`Found ${inactiveTickets.rows.length} tickets on inactive schedules:\n`);
    inactiveTickets.rows.forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.full_name} - Seat ${t.seat_number} - ${t.booking_ref}`);
      console.log(`   Current schedule: ${t.schedule_id} (${t.schedule_status})`);
    });

    console.log(`\n🔄 Moving these tickets to active schedule ${activeScheduleId}...\n`);

    // Update tickets to use the active schedule
    const updateResult = await pool.query(`
      UPDATE tickets
      SET schedule_id = $1, updated_at = NOW()
      WHERE id IN (
        SELECT t.id
        FROM tickets t
        INNER JOIN schedules s ON t.schedule_id = s.id
        WHERE s.status != 'in_progress' 
          AND t.status IN ('CONFIRMED',  'CHECKED_IN')
          AND s.schedule_date >= CURRENT_DATE - INTERVAL '1 day'
      )
      RETURNING id, booking_ref, seat_number
    `, [activeScheduleId]);

    console.log(`✅ SUCCESS! Moved ${updateResult.rows.length} tickets to active schedule!`);
    console.log(`\n📋 Updated tickets:`);
    updateResult.rows.forEach((t, idx) => {
      console.log(`   ${idx + 1}. Seat ${t.seat_number} - ${t.booking_ref}`);
      console.log(`      Ticket ID: ${t.id}`);
    });

    console.log(`\n🎫 You can now scan these tickets successfully!`);
    console.log(`   Try scanning any booking reference or ticket ID from above.`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

moveTicketsToActiveSchedule();
