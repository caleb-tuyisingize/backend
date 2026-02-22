const pool = require('./config/pgPool');

async function fixAssignment() {
  try {
    // Get the in_progress schedule
    const scheduleResult = await pool.query(`
      SELECT 
        s.id as schedule_id,
        s.driver_id,
        s.bus_id,
        d.name as driver_name,
        d.company_id
      FROM schedules s
      INNER JOIN drivers d ON s.driver_id = d.id
      WHERE s.status = 'in_progress'
      LIMIT 1
    `);

    if (scheduleResult.rows.length === 0) {
      console.log('❌ No in_progress schedule found');
      await pool.end();
      return;
    }

    const schedule = scheduleResult.rows[0];

    // Find a company admin or any user from the same company
    const userResult = await pool.query(`
      SELECT id FROM users
      WHERE company_id = $1 AND role IN ('company_admin', 'admin')
      LIMIT 1
    `, [schedule.company_id]);

    if (userResult.rows.length === 0) {
      // Try any user from company
      const anyUserResult = await pool.query(`
        SELECT id FROM users WHERE company_id = $1 LIMIT 1
      `, [schedule.company_id]);
      
      if (anyUserResult.rows.length === 0) {
        console.log('❌ No users found for this company');
        await pool.end();
        return;
      }
      
      userResult.rows[0] = anyUserResult.rows[0];
    }

    const assignedBy = userResult.rows[0].id;

    // Check if assignment already exists
    const existingAssignment = await pool.query(`
      SELECT id FROM driver_assignments
      WHERE driver_id = $1 AND bus_id = $2 AND unassigned_at IS NULL
    `, [schedule.driver_id, schedule.bus_id]);

    if (existingAssignment.rows.length > 0) {
      console.log('\n✅ Driver is already assigned to this bus!');
      await pool.end();
      return;
    }

    // Create driver assignment
    const result = await pool.query(`
      INSERT INTO driver_assignments (id, driver_id, bus_id, company_id, assigned_at, assigned_by, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW(), $4, NOW(), NOW())
      RETURNING id, assigned_at
    `, [schedule.driver_id, schedule.bus_id, schedule.company_id, assignedBy]);

    console.log('\n✅ SUCCESS! Driver assigned to bus!');
    console.log(`   Assignment ID: ${result.rows[0].id}`);
    console.log(`   Driver: ${schedule.driver_name} (${schedule.driver_id})`);
    console.log(`   Bus ID: ${schedule.bus_id}`);
    console.log(`   Schedule ID: ${schedule.schedule_id}`);
    console.log('\n🎫 You can now scan tickets for this in_progress trip!');
    console.log(`\nTest with one of these ticket IDs from the schedule:`);
    
    const tickets = await pool.query(`
      SELECT id, booking_ref, seat_number, status
      FROM tickets
      WHERE schedule_id = $1 AND status = 'CONFIRMED'
      LIMIT 5
    `, [schedule.schedule_id]);
    
    tickets.rows.forEach((t, idx) => {
      console.log(`  ${idx + 1}. Ticket ID: ${t.id} | Ref: ${t.booking_ref} | Seat: ${t.seat_number}`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixAssignment();
