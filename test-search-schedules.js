/**
 * Test Script: Search Schedules Endpoint
 * 
 * This script tests the /api/schedules/search-pg endpoint
 * to verify it returns schedules correctly
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testSearchSchedules() {
  console.log('\n🔍 Testing Schedule Search Functionality...\n');

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Database connected successfully\n');

    // Test 1: Get all schedules (no filters)
    console.log('📋 TEST 1: Fetch ALL schedules from database');
    const allSchedules = await client.query(`
      SELECT 
        s.id,
        r.origin,
        r.destination,
        s.schedule_date,
        s.departure_time,
        s.status,
        s.price_per_seat,
        b.plate_number,
        c.name as company_name
      FROM schedules s
      LEFT JOIN routes r ON s.route_id = r.id
      LEFT JOIN buses b ON s.bus_id = b.id
      LEFT JOIN companies c ON s.company_id = c.id
      ORDER BY s.schedule_date DESC, s.departure_time DESC
      LIMIT 10
    `);

    console.log(`Found ${allSchedules.rows.length} schedules in database:`);
    allSchedules.rows.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.origin || 'N/A'} → ${s.destination || 'N/A'}`);
      console.log(`     Date: ${s.schedule_date || 'N/A'} | Time: ${s.departure_time || 'N/A'}`);
      console.log(`     Status: ${s.status} | Price: ${s.price_per_seat} | Bus: ${s.plate_number || 'N/A'}`);
      console.log('');
    });

    // Test 2: Search without date filter
    console.log('\n📋 TEST 2: Search without date (Kigali → Gisenyi)');
    const searchQuery1 = `
      SELECT 
        s.id,
        r.origin as from_location,
        r.destination as to_location,
        s.departure_time,
        s.schedule_date,
        s.arrival_time,
        s.price_per_seat as price,
        -- Calculate available passenger seats
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
      WHERE 
        r.origin ILIKE $1
        AND r.destination ILIKE $2
        AND s.status IN ('scheduled', 'in_progress')
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
      ORDER BY s.schedule_date ASC, s.departure_time ASC
    `;

    const result1 = await client.query(searchQuery1, ['%Kigali%', '%Gisenyi%']);
    console.log(`Results: ${result1.rows.length} schedules found`);
    result1.rows.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.from_location} → ${s.to_location}`);
      console.log(`     Date: ${s.schedule_date} | Time: ${new Date(s.departure_time).toLocaleTimeString()}`);
      console.log(`     Available: ${s.available_seats} seats | Price: RWF ${s.price}`);
      console.log('');
    });

    // Test 3: Search with date filter
    const testDate = '2026-02-21'; // Tomorrow's date
    console.log(`\n📋 TEST 3: Search with date filter (Date: ${testDate})`);
    
    const searchQuery2 = `
      SELECT 
        s.id,
        r.origin as from_location,
        r.destination as to_location,
        s.departure_time,
        s.schedule_date,
        s.price_per_seat as price,
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
      WHERE 
        r.origin ILIKE $1
        AND r.destination ILIKE $2
        AND s.schedule_date = $3
        AND s.status IN ('scheduled', 'in_progress')
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
      ORDER BY s.departure_time ASC
    `;

    const result2 = await client.query(searchQuery2, ['%Kigali%', '%Gisenyi%', testDate]);
    console.log(`Results: ${result2.rows.length} schedules found for ${testDate}`);
    result2.rows.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.from_location} → ${s.to_location}`);
      console.log(`     Date: ${s.schedule_date} | Time: ${new Date(s.departure_time).toLocaleTimeString()}`);
      console.log(`     Available: ${s.available_seats} seats | Price: RWF ${s.price}`);
      console.log('');
    });

    // Test 4: Check unique routes
    console.log('\n📋 TEST 4: Show all unique routes in database');
    const routesQuery = await client.query(`
      SELECT DISTINCT r.origin, r.destination
      FROM routes r
      INNER JOIN schedules s ON s.route_id = r.id
      ORDER BY r.origin, r.destination
    `);
    
    console.log(`Found ${routesQuery.rows.length} unique routes:`);
    routesQuery.rows.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.origin} → ${r.destination}`);
    });

    console.log('\n✅ All tests completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      detail: error.detail
    });
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run tests
testSearchSchedules();
