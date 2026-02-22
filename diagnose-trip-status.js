require('dotenv').config();
const pool = require('./config/pgPool');

async function diagnoseTripStatus() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 DIAGNOSING TRIP STATUS ISSUE\n');
    
    // 1. Check all trips with their statuses
    console.log('1️⃣ All Trips:');
    const trips = await client.query(`
      SELECT 
        t.id,
        t.status,
        t.schedule_id,
        t.driver_id,
        d.user_id as driver_user_id,
        u.name as driver_name,
        t.started_at,
        t.created_at
      FROM trips t
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 10;
    `);
    
    if (trips.rows.length === 0) {
      console.log('  ❌ NO TRIPS FOUND IN DATABASE!\n');
    } else {
      trips.rows.forEach((t, i) => {
        console.log(`  ${i + 1}. Trip ${t.id.substring(0, 8)}...`);
        console.log(`     Status: ${t.status}`);
        console.log(`     Driver: ${t.driver_name || 'N/A'} (${t.driver_user_id || 'no user'})`);
        console.log(`     Schedule: ${t.schedule_id ? t.schedule_id.substring(0, 8) + '...' : 'N/A'}`);
        console.log(`     Started: ${t.started_at || 'Not started'}`);
        console.log(`     Created: ${t.created_at}`);
        console.log();
      });
    }
    
    // 2. Check schedules with status
    console.log('\n2️⃣ Schedules (last 10):');
    const schedules = await client.query(`
      SELECT 
        s.id,
        s.status,
        s.schedule_date::TEXT as date,
        s.departure_time::TEXT as departure,
        s.available_seats,
        COUNT(DISTINCT t.id) as ticket_count,
        COUNT(DISTINCT tr.id) as trip_count
      FROM schedules s
      LEFT JOIN tickets t ON s.id = t.schedule_id
      LEFT JOIN trips tr ON s.id = tr.schedule_id
      GROUP BY s.id, s.status, s.schedule_date, s.departure_time, s.available_seats
      ORDER BY s.created_at DESC
      LIMIT 10;
    `);
    
    schedules.rows.forEach((s, i) => {
      console.log(`  ${i + 1}. Schedule ${s.id.substring(0, 8)}...`);
      console.log(`     Status: ${s.status}`);
      console.log(`     Date: ${s.date} ${s.departure}`);
      console.log(`     Tickets: ${s.ticket_count} | Trips: ${s.trip_count}`);
      console.log();
    });
    
    // 3. Check ticket assignments
    console.log('\n3️⃣ Ticket "MUGENZI" (Seat 1):');
    const mugenziTicket = await client.query(`
      SELECT 
        t.id,
        t.qr_code,
        t.seat_number,
        t.status,
        t.schedule_id,
        t.passenger_name,
        s.status as schedule_status,
        s.schedule_date::TEXT as schedule_date,
        s.departure_time::TEXT as departure_time,
        tr.id as trip_id,
        tr.status as trip_status
      FROM tickets t
      LEFT JOIN schedules s ON t.schedule_id = s.id
      LEFT JOIN trips tr ON s.id = tr.schedule_id
      WHERE t.passenger_name ILIKE '%MUGENZI%'
        AND t.seat_number = 1
      ORDER BY t.created_at DESC
      LIMIT 3;
    `);
    
    if (mugenziTicket.rows.length === 0) {
      console.log('  ❌ No ticket found for MUGENZI Seat 1\n');
    } else {
      mugenziTicket.rows.forEach((t, i) => {
        console.log(`  ${i + 1}. Ticket ${t.id.substring(0, 8)}...`);
        console.log(`     Passenger: ${t.passenger_name} | Seat: ${t.seat_number}`);
        console.log(`     Ticket Status: ${t.status}`);
        console.log(`     Schedule: ${t.schedule_id ? t.schedule_id.substring(0, 8) + '...' : 'N/A'}`);
        console.log(`     Schedule Status: ${t.schedule_status || 'N/A'}`);
        console.log(`     Schedule Date: ${t.schedule_date} ${t.departure_time}`);
        console.log(`     Trip: ${t.trip_id ? t.trip_id.substring(0, 8) + '...' : '❌ NO TRIP'}`);
        console.log(`     Trip Status: ${t.trip_status || '❌ NO TRIP'}`);
        console.log();
      });
    }
    
    // 4. Check driver assignments
    console.log('\n4️⃣ Driver Assignments:');
    const driverAssignments = await client.query(`
      SELECT 
        da.id,
        da.driver_id,
        da.schedule_id,
        u.name as driver_name,
        s.status as schedule_status,
        s.schedule_date::TEXT as schedule_date,
        s.departure_time::TEXT as departure_time
      FROM driver_assignments da
      JOIN drivers d ON da.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      JOIN schedules s ON da.schedule_id = s.id
      ORDER BY s.schedule_date DESC, s.departure_time DESC
      LIMIT 5;
    `);
    
    if (driverAssignments.rows.length === 0) {
      console.log('  ❌ NO DRIVER ASSIGNMENTS FOUND!\n');
    } else {
      driverAssignments.rows.forEach((da, i) => {
        console.log(`  ${i + 1}. ${da.driver_name}`);
        console.log(`     Schedule: ${da.schedule_id.substring(0, 8)}... (${da.schedule_status})`);
        console.log(`     Date: ${da.schedule_date} ${da.departure_time}`);
        console.log();
      });
    }
    
    // 5. THE PROBLEM - Check if trip exists for the ticket's schedule
    console.log('\n5️⃣ IDENTIFYING THE PROBLEM:');
    const problem = await client.query(`
      SELECT 
        COUNT(DISTINCT t.id) as total_confirmed_tickets,
        COUNT(DISTINCT CASE WHEN tr.id IS NOT NULL THEN t.id END) as tickets_with_trip,
        COUNT(DISTINCT CASE WHEN tr.id IS NULL THEN t.id END) as tickets_without_trip,
        COUNT(DISTINCT CASE WHEN tr.status = 'in_progress' THEN t.id END) as tickets_with_active_trip
      FROM tickets t
      JOIN schedules s ON t.schedule_id = s.id
      LEFT JOIN trips tr ON s.id = tr.schedule_id
      WHERE t.status = 'CONFIRMED';
    `);
    
    const stats = problem.rows[0];
    console.log(`  Total CONFIRMED tickets: ${stats.total_confirmed_tickets}`);
    console.log(`  Tickets with ANY trip: ${stats.tickets_with_trip}`);
    console.log(`  Tickets WITHOUT trip: ${stats.tickets_without_trip} ⚠️`);
    console.log(`  Tickets with ACTIVE trip: ${stats.tickets_with_active_trip}`);
    
    if (Number(stats.tickets_without_trip) > 0) {
      console.log(`\n  🚨 PROBLEM FOUND: ${stats.tickets_without_trip} tickets have NO TRIP!`);
      console.log(`     Solution: Need to create trips for these schedules\n`);
    }
    
    // 6. Show schedules that need trips
    console.log('\n6️⃣ Schedules with CONFIRMED tickets but NO TRIP:');
    const needsTrip = await client.query(`
      SELECT 
        s.id,
        s.status,
        s.schedule_date::TEXT as date,
        s.departure_time::TEXT as departure,
        COUNT(t.id) as ticket_count,
        COALESCE(da.driver_id, 'N/A') as driver_id
      FROM schedules s
      JOIN tickets t ON s.id = t.schedule_id
      LEFT JOIN trips tr ON s.id = tr.schedule_id
      LEFT JOIN driver_assignments da ON s.id = da.schedule_id
      WHERE t.status = 'CONFIRMED'
        AND tr.id IS NULL
      GROUP BY s.id, s.status, s.schedule_date, s.departure_time, da.driver_id
      ORDER BY s.schedule_date, s.departure_time;
    `);
    
    if (needsTrip.rows.length === 0) {
      console.log('  ✅ All schedules with tickets have trips!\n');
    } else {
      console.log(`  Found ${needsTrip.rows.length} schedule(s) that need trips:\n`);
      needsTrip.rows.forEach((s, i) => {
        console.log(`  ${i + 1}. Schedule: ${s.id}`);
        console.log(`     Status: ${s.status}`);
        console.log(`     Date: ${s.date} ${s.departure}`);
        console.log(`     Tickets: ${s.ticket_count}`);
        console.log(`     Driver: ${s.driver_id}`);
        console.log();
      });
    }
    
    console.log('✅ Diagnosis complete!\n');
    
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseTripStatus().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
