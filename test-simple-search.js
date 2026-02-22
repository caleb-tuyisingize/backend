require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function simpleTest() {
  try {
    console.log('🧪 Simple Search Test (Kigali → Gisenyi)\n');
    
    // Use the exact same query as in publicController.js with CASE WHEN fallback
    const query = `
      SELECT 
        s.id,
        r.origin,
        r.destination,
        s.schedule_date,
        s.available_seats as direct_available,
        (SELECT COUNT(*) FROM seats WHERE bus_id = s.bus_id) as total_bus_seats,
        (SELECT COUNT(*) FROM seats WHERE bus_id = s.bus_id AND (is_driver = false OR is_driver IS NULL)) as passenger_seats_count,
        (SELECT COUNT(*) FROM tickets WHERE schedule_id = s.id AND status IN ('CONFIRMED', 'CHECKED_IN')) as booked_count,
        CASE 
          WHEN (SELECT COUNT(*) FROM seats WHERE bus_id = s.bus_id) > 0 THEN
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
          ELSE
            s.available_seats
        END as calculated_available
      FROM schedules s
      INNER JOIN routes r ON s.route_id = r.id
      WHERE r.origin ILIKE $1
        AND r.destination ILIKE $2
        AND s.status IN ('scheduled', 'in_progress')
      ORDER BY s.schedule_date ASC
    `;
    
    const result = await pool.query(query, ['%Kigali%', '%Gisenyi%']);
    
    console.log(`Found ${result.rows.length} schedules:\n`);
    
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.origin} → ${row.destination}`);
      console.log(`   Date: ${row.schedule_date}`);
      console.log(`   Direct available_seats: ${row.direct_available}`);
      console.log(`   Total bus seats: ${row.total_bus_seats}`);
      console.log(`   Passenger seats: ${row.passenger_seats_count}`);
      console.log(`   Booked tickets: ${row.booked_count}`);
      console.log(`   Calculated available: ${row.calculated_available}`);
      console.log(`   Would pass > 0 check: ${row.calculated_available > 0 ? 'YES ✅' : 'NO ❌'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
  } finally {
    await pool.end();
  }
}

simpleTest();
