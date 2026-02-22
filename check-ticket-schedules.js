const pool = require('./config/pgPool');

async function checkTicketSchedules() {
  try {
    // Check tickets and their schedules
    const ticketsResult = await pool.query(`
      SELECT 
        t.id as ticket_id,
        t.booking_ref,
        t.seat_number,
        t.status as ticket_status,
        t.schedule_id,
        s.schedule_date,
        s.status as schedule_status,
        s.driver_id,
        u.full_name as passenger_name,
        d.name as driver_name
      FROM tickets t
      INNER JOIN schedules s ON t.schedule_id = s.id
      INNER JOIN users u ON t.passenger_id = u.id
      LEFT JOIN drivers d ON s.driver_id = d.id
      WHERE t.status IN ('CONFIRMED', 'CHECKED_IN')
        AND s.schedule_date >= CURRENT_DATE - INTERVAL '1 day'
      ORDER BY s.schedule_date DESC, t.seat_number
      LIMIT 20
    `);

    console.log('\n🎫 Recent Tickets:\n');
    console.log('═'.repeat(120));
    
    if (ticketsResult.rows.length === 0) {
      console.log('No confirmed or checked-in tickets found for recent schedules.');
    } else {
      ticketsResult.rows.forEach((t, idx) => {
        console.log(`${idx + 1}. Ticket ID: ${t.ticket_id}`);
        console.log(`   Booking Ref: ${t.booking_ref} | Seat: ${t.seat_number} | Passenger: ${t.passenger_name}`);
        console.log(`   Ticket Status: ${t.ticket_status} | Schedule Status: ${t.schedule_status}`);
        console.log(`   Schedule ID: ${t.schedule_id}`);
        console.log(`   Driver: ${t.driver_name || 'NOT ASSIGNED'} (ID: ${t.driver_id || 'none'})`);
        console.log('─'.repeat(120));
      });
    }

    // Check driver assignments
    const assignmentsResult = await pool.query(`
      SELECT 
        da.id,
        da.driver_id,
        da.bus_id,
        d.name as driver_name,
        d.user_id as driver_user_id,
        b.plate_number,
        da.assigned_at,
        da.unassigned_at
      FROM driver_assignments da
      INNER JOIN drivers d ON da.driver_id = d.id
      INNER JOIN buses b ON da.bus_id = b.id
      WHERE da.unassigned_at IS NULL
      ORDER BY da.assigned_at DESC
      LIMIT 10
    `);

    console.log('\n🚌 Active Driver-Bus Assignments:\n');
    console.log('═'.repeat(120));
    
    if (assignmentsResult.rows.length === 0) {
      console.log('⚠️  No active driver-bus assignments found!');
      console.log('   Drivers need to be assigned to buses to start trips.\n');
    } else {
      assignmentsResult.rows.forEach((a, idx) => {
        console.log(`${idx + 1}. Driver: ${a.driver_name} (ID: ${a.driver_id}, User ID: ${a.driver_user_id})`);
        console.log(`   Bus: ${a.plate_number} (ID: ${a.bus_id})`);
        console.log(`   Assigned: ${a.assigned_at}`);
        console.log('─'.repeat(120));
      });
    }

    // Check the in_progress schedule specifically
    const inProgressResult = await pool.query(`
      SELECT 
        s.id,
        s.schedule_date,
        s.departure_time,
        s.status,
        s.driver_id,
        s.bus_id,
        d.name as driver_name,
        b.plate_number,
        COUNT(t.id) as ticket_count
      FROM schedules s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN buses b ON s.bus_id = b.id
      LEFT JOIN tickets t ON s.id = t.schedule_id AND t.status IN ('CONFIRMED', 'CHECKED_IN')
      WHERE s.status = 'in_progress'
      GROUP BY s.id, s.schedule_date, s.departure_time, s.status, s.driver_id, s.bus_id, d.name, b.plate_number
    `);

    if (inProgressResult.rows.length > 0) {
      console.log('\n🚀 IN-PROGRESS Schedule:\n');
      console.log('═'.repeat(120));
      const trip = inProgressResult.rows[0];
      console.log(`Schedule ID: ${trip.id}`);
      console.log(`Date: ${trip.schedule_date} ${trip.departure_time}`);
      console.log(`Bus: ${trip.plate_number || 'Not assigned'} (ID: ${trip.bus_id || 'none'})`);
      console.log(`Driver: ${trip.driver_name || 'NOT ASSIGNED'} (ID: ${trip.driver_id || 'none'})`);
      console.log(`Tickets: ${trip.ticket_count}`);
      console.log('═'.repeat(120));
    }

    console.log('\n💡 Summary:');
    console.log('   - To scan tickets, the schedule must have status "in_progress"');
    console.log('   - The driver must be assigned to the bus for that schedule');
    console.log('   - Use the QR code from a ticket that belongs to an in_progress schedule\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTicketSchedules();
