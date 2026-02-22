require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testSeatAvailability() {
  try {
    console.log('🔍 Checking seat availability for Kigali → Gisenyi schedules...\n');
    
    // Get schedules for Kigali → Gisenyi
    const query = `
      SELECT 
        s.id,
        s.schedule_date,
        s.departure_time,
        s.status,
        s.bus_id,
        s.available_seats as direct_available_seats,
        s.booked_seats as direct_booked_seats,
        r.origin,
        r.destination,
        (SELECT COUNT(*) FROM seats WHERE bus_id = s.bus_id) as total_seats_in_bus,
        (SELECT COUNT(*) FROM seats WHERE bus_id = s.bus_id AND (is_driver = true)) as driver_seats,
        (SELECT COUNT(*) FROM seats WHERE bus_id = s.bus_id AND (is_driver = false OR is_driver IS NULL)) as passenger_seats,
        (SELECT COUNT(*) FROM tickets WHERE schedule_id = s.id AND status IN ('CONFIRMED', 'CHECKED_IN')) as confirmed_tickets,
        (
          COALESCE(
            (SELECT COUNT(*) FROM seats 
             WHERE bus_id = s.bus_id 
             AND (is_driver = false OR is_driver IS NULL)),
            0
          ) - COALESCE(
            (SELECT COUNT(*) FROM tickets 
             WHERE schedule_id = s.id 
             AND status IN ('CONFIRMED', 'CHECKED_IN')),
            0
          )
        ) as calculated_available_seats
      FROM schedules s
      INNER JOIN routes r ON s.route_id = r.id
      WHERE r.origin ILIKE '%Kigali%'
        AND r.destination ILIKE '%Gisenyi%'
      ORDER BY s.schedule_date ASC
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ No schedules found for Kigali → Gisenyi');
      return;
    }
    
    console.log(`Found ${result.rows.length} schedules for Kigali → Gisenyi:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`📅 Schedule ${index + 1}:`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Date: ${row.schedule_date}`);
      console.log(`   Time: ${row.departure_time}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Bus ID: ${row.bus_id}`);
      console.log(`   ───────────────────────────────────────`);
      console.log(`   📊 Seat Counts:`);
      console.log(`      Total seats in bus: ${row.total_seats_in_bus}`);
      console.log(`      Driver seats: ${row.driver_seats}`);
      console.log(`      Passenger seats: ${row.passenger_seats}`);
      console.log(`      Confirmed tickets: ${row.confirmed_tickets}`);
      console.log(`   ───────────────────────────────────────`);
      console.log(`   💺 Availability:`);
      console.log(`      Direct available_seats column: ${row.direct_available_seats}`);
      console.log(`      Direct booked_seats column: ${row.direct_booked_seats}`);
      console.log(`      Calculated available: ${row.calculated_available_seats}`);
      console.log(`      ✅ Would appear in search: ${row.calculated_available_seats > 0 ? 'YES' : 'NO'}`);
      console.log('');
    });
    
    // Check if seats table exists and has data
    console.log('📋 Checking seats table...');
    const seatsQuery = `SELECT bus_id, COUNT(*) as seat_count FROM seats GROUP BY bus_id`;
    const seatsResult = await pool.query(seatsQuery);
    
    if (seatsResult.rows.length === 0) {
      console.log('❌ WARNING: No seats found in seats table!');
      console.log('   This might be why search returns 0 results.');
      console.log('   You need to populate the seats table for each bus.');
    } else {
      console.log(`✅ Found seats for ${seatsResult.rows.length} buses:`);
      seatsResult.rows.forEach(row => {
        console.log(`   Bus ${row.bus_id}: ${row.seat_count} seats`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testSeatAvailability();
