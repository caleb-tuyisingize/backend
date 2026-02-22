const pool = require('./config/pgPool');

async function assignDriverToBus() {
  try {
    // Get the in_progress schedule details
    const scheduleResult = await pool.query(`
      SELECT 
        s.id as schedule_id,
        s.driver_id,
        s.bus_id,
        d.name as driver_name,
        d.user_id,
        d.company_id
      FROM schedules s
      INNER JOIN drivers d ON s.driver_id = d.id
      WHERE s.status = 'in_progress'
      LIMIT 1
    `);

    if (scheduleResult.rows.length === 0) {
      console.log('❌ No in_progress schedule found');
      return;
    }

    const schedule = scheduleResult.rows[0];
    console.log('\n📋 Schedule Details:');
    console.log(`   Schedule ID: ${schedule.schedule_id}`);
    console.log(`   Driver: ${schedule.driver_name} (ID: ${schedule.driver_id})`);
    console.log(`   User ID: ${schedule.user_id}`);
    console.log(`   Bus ID: ${schedule.bus_id}`);
    console.log(`   Company ID: ${schedule.company_id}`);

    // Check if assignment already exists
    const existingAssignment = await pool.query(`
      SELECT id FROM driver_assignments
      WHERE driver_id = $1 AND bus_id = $2 AND unassigned_at IS NULL
    `, [schedule.driver_id, schedule.bus_id]);

    if (existingAssignment.rows.length > 0) {
      console.log('\n✅ Driver is already assigned to this bus!');
      return;
    }

    // Create driver assignment
    const result = await pool.query(`
      INSERT INTO driver_assignments (id, driver_id, bus_id, company_id, assigned_at, assigned_by, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW(), $4, NOW(), NOW())
      RETURNING id, assigned_at
    `, [schedule.driver_id, schedule.bus_id, schedule.company_id, schedule.user_id || schedule.driver_id]);

    console.log('\n✅ Driver assigned to bus successfully!');
    console.log(`   Assignment ID: ${result.rows[0].id}`);
    console.log(`   Assigned at: ${result.rows[0].assigned_at}`);
    console.log('\n🎫 You can now scan tickets for this trip!');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

assignDriverToBus();
