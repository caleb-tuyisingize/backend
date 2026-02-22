const pool = require('./config/pgPool');

async function quickCheck() {
  try {
    // Find the in_progress schedule with its tickets
    const result = await pool.query(`
      SELECT 
        s.id as schedule_id,
        s.status as schedule_status,
        s.driver_id,
        s.bus_id,
        t.id as ticket_id,
        t.booking_ref,
        t.seat_number,
        t.status as ticket_status,
        u.full_name as passenger_name
      FROM schedules s
      LEFT JOIN tickets t ON s.id = t.schedule_id AND t.status IN ('CONFIRMED', 'CHECKED_IN')
      LEFT JOIN users u ON t.passenger_id = u.id
      WHERE s.status = 'in_progress'
      ORDER BY t.seat_number
      LIMIT 10
    `);

    console.log('\n🚀 IN-PROGRESS TRIP DETAILS:\n');
    
    if (result.rows.length === 0) {
      console.log('❌ No in_progress schedules found.');
      console.log('   Need to start a trip first!\n');
    } else {
      const schedule = result.rows[0];
      console.log(`Schedule ID: ${schedule.schedule_id}`);
      console.log(`Status: ${schedule.schedule_status}`);
      console.log(`Driver ID: ${schedule.driver_id || '❌ NOT ASSIGNED'}`);
      console.log(`Bus ID: ${schedule.bus_id || '❌ NOT ASSIGNED'}`);
      console.log('\nTickets for this schedule:');
      
      result.rows.forEach((row, idx) => {
        if (row.ticket_id) {
          console.log(`  ${idx + 1}. ${row.passenger_name} - Seat ${row.seat_number} - ${row.booking_ref}`);
          console.log(`     Ticket ID: ${row.ticket_id}`);
          console.log(`     Status: ${row.ticket_status}`);
        }
      });
      
      if (!result.rows[0].ticket_id) {
        console.log('  ❌ No tickets found for this schedule!');
      }
    }

    // Check driver assignments
    const assignments = await pool.query(`
      SELECT 
        d.id as driver_id,
        d.name as driver_name,
        d.user_id,
        da.bus_id,
        b.plate_number
      FROM drivers d
      LEFT JOIN driver_assignments da ON d.id = da.driver_id AND da.unassigned_at IS NULL
      LEFT JOIN buses b ON da.bus_id = b.id
      LIMIT 10
    `);

    console.log('\n👨‍✈️ DRIVERS:\n');
    assignments.rows.forEach((d, idx) => {
      console.log(`${idx + 1}. ${d.driver_name} (Driver ID: ${d.driver_id}, User ID: ${d.user_id})`);
      console.log(`   Assigned to Bus: ${d.plate_number || '❌ NOT ASSIGNED'} (Bus ID: ${d.bus_id || 'none'})`);
    });

    console.log('\n📝 SOLUTION:');
    console.log('   1. Make sure you are logged in as a driver');
    console.log('   2. The schedule needs a driver_id assigned');
    console.log('   3. The driver must be assigned to a bus');
    console.log('   4. The schedule status must be "in_progress"');
    console.log('   5. Then you can scan tickets for that schedule\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

quickCheck();
