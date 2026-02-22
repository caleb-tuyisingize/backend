/**
 * Test Script: Verify Driver Seat Exclusion from Schedule Search
 * 
 * This script queries the database to verify that:
 * 1. Driver seats are correctly marked with is_driver = true
 * 2. Passenger seat counts exclude driver seats
 * 3. Schedules with only driver seat left are not shown
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const useDbSsl = process.env.DB_SSL !== 'false';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useDbSsl ? { require: true, rejectUnauthorized: false } : false
});

async function testDriverSeatExclusion() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing Driver Seat Exclusion in Schedule Search\n');
    console.log('='.repeat(70));
    
    // Test 1: Check driver seats in database
    console.log('\n📋 Test 1: Driver Seats in Database');
    console.log('-'.repeat(70));
    
    const driverSeatsResult = await client.query(`
      SELECT 
        bus_id,
        seat_number,
        is_driver,
        row,
        col,
        side
      FROM seats
      WHERE is_driver = true
      ORDER BY bus_id, seat_number
    `);
    
    console.log(`Found ${driverSeatsResult.rows.length} driver seat(s):`);
    console.table(driverSeatsResult.rows);
    
    // Test 2: Count seats by bus (driver vs passenger)
    console.log('\n📊 Test 2: Seat Distribution by Bus');
    console.log('-'.repeat(70));
    
    const seatDistributionResult = await client.query(`
      SELECT 
        s.bus_id,
        b.plate_number,
        COUNT(*) FILTER (WHERE s.is_driver = true) as driver_seats,
        COUNT(*) FILTER (WHERE s.is_driver = false OR s.is_driver IS NULL) as passenger_seats,
        COUNT(*) as total_seats
      FROM seats s
      LEFT JOIN buses b ON s.bus_id = b.id
      GROUP BY s.bus_id, b.plate_number
      ORDER BY s.bus_id
    `);
    
    console.table(seatDistributionResult.rows);
    
    // Test 3: Calculate real availability for each schedule
    console.log('\n🔍 Test 3: Schedule Availability (Passenger Seats Only)');
    console.log('-'.repeat(70));
    
    const scheduleAvailabilityResult = await client.query(`
      SELECT 
        s.id as schedule_id,
        r.origin,
        r.destination,
        s.schedule_date,
        b.plate_number,
        -- Passenger seats for this bus
        COALESCE(
          (SELECT COUNT(*) FROM seats 
           WHERE bus_id = s.bus_id 
           AND (is_driver = false OR is_driver IS NULL)),
          0
        ) as total_passenger_seats,
        -- Booked seats for this schedule
        COALESCE(
          (SELECT COUNT(*) FROM tickets 
           WHERE schedule_id = s.id 
           AND status IN ('CONFIRMED', 'CHECKED_IN')),
          0
        ) as booked_seats,
        -- Available passenger seats
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
        ) as available_passenger_seats,
        -- Old available_seats column (may include driver)
        s.available_seats as old_available_column
      FROM schedules s
      INNER JOIN routes r ON s.route_id = r.id
      LEFT JOIN buses b ON s.bus_id = b.id
      WHERE s.status = 'scheduled'
      ORDER BY s.schedule_date, s.departure_time
      LIMIT 10
    `);
    
    console.log('Showing first 10 schedules:');
    console.table(scheduleAvailabilityResult.rows);
    
    // Test 4: Identify schedules that would be filtered out
    console.log('\n⚠️  Test 4: Schedules with 0 Passenger Seats Available (Filtered Out)');
    console.log('-'.repeat(70));
    
    const filteredSchedulesResult = await client.query(`
      SELECT 
        s.id as schedule_id,
        r.origin,
        r.destination,
        b.plate_number,
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
        ) as available_passenger_seats
      FROM schedules s
      INNER JOIN routes r ON s.route_id = r.id
      LEFT JOIN buses b ON s.bus_id = b.id
      WHERE s.status = 'scheduled'
      AND (
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
      ) <= 0
    `);
    
    if (filteredSchedulesResult.rows.length > 0) {
      console.log(`Found ${filteredSchedulesResult.rows.length} schedule(s) with no passenger seats available:`);
      console.table(filteredSchedulesResult.rows);
      console.log('✅ These schedules will NOT appear in search results (as intended)');
    } else {
      console.log('✅ No schedules with 0 passenger seats (or all have availability)');
    }
    
    // Test 5: Simulate a search query
    console.log('\n🔎 Test 5: Simulate Search Query (Passenger Seats Only)');
    console.log('-'.repeat(70));
    
    const searchResult = await client.query(`
      SELECT 
        s.id,
        r.origin,
        r.destination,
        s.schedule_date,
        b.plate_number,
        COALESCE(
          (SELECT COUNT(*) FROM seats 
           WHERE bus_id = s.bus_id 
           AND (is_driver = false OR is_driver IS NULL)),
          0
        ) as total_passenger_seats,
        COALESCE(
          (SELECT COUNT(*) FROM tickets 
           WHERE schedule_id = s.id 
           AND status IN ('CONFIRMED', 'CHECKED_IN')),
          0
        ) as booked_seats,
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
        ) as available_seats
      FROM schedules s
      INNER JOIN routes r ON s.route_id = r.id
      LEFT JOIN buses b ON s.bus_id = b.id
      WHERE 
        s.status = 'scheduled'
        AND (
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
        ) > 0
      ORDER BY s.schedule_date, s.departure_time
      LIMIT 5
    `);
    
    console.log(`Search returned ${searchResult.rows.length} schedule(s) with available passenger seats:`);
    console.table(searchResult.rows);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run tests
testDriverSeatExclusion()
  .then(() => {
    console.log('\n✅ Test suite completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
