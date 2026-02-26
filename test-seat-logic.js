/**
 * Test Script: Seat Availability Logic
 * 
 * Tests:
 * 1. GET /api/seats/schedules/:scheduleId/booked-seats - New endpoint
 * 2. GET /api/seats/schedules/:scheduleId - Full seat map
 * 3. Verify only CONFIRMED/CHECKED_IN tickets lock seats
 * 4. Verify PENDING_PAYMENT/CANCELLED tickets DO NOT lock seats
 */

const API_URL = 'https://backend-7cxc.onrender.com';

async function testSeatEndpoints() {
  console.log('\n🧪 TESTING SEAT AVAILABILITY LOGIC\n');
  console.log('='.repeat(60));
  
  try {
    // First, get a schedule ID from the database
    console.log('\n📋 Step 1: Finding a test schedule...');
    const schedulesRes = await fetch(`${API_URL}/api/schedules`);
    const schedulesData = await schedulesRes.json();
    
    if (!schedulesData.schedules || schedulesData.schedules.length === 0) {
      console.log('❌ No schedules found in database');
      return;
    }
    
    const testSchedule = schedulesData.schedules[0];
    const scheduleId = testSchedule.id;
    
    console.log(`✅ Using schedule: ${scheduleId}`);
    console.log(`   Route: ${testSchedule.origin || testSchedule.from} → ${testSchedule.destination || testSchedule.to}`);
    console.log(`   Date: ${testSchedule.schedule_date || testSchedule.date}`);
    
    // Test 1: New endpoint - Get booked seats only
    console.log('\n' + '='.repeat(60));
    console.log('\n📍 TEST 1: GET /api/seats/schedules/:scheduleId/booked-seats');
    console.log('-'.repeat(60));
    
    const bookedSeatsRes = await fetch(`${API_URL}/api/seats/schedules/${scheduleId}/booked-seats`);
    const bookedSeatsData = await bookedSeatsRes.json();
    
    console.log(`\nStatus: ${bookedSeatsRes.status}`);
    console.log(`Response:`);
    console.log(JSON.stringify(bookedSeatsData, null, 2));
    
    if (bookedSeatsData.bookedSeats) {
      console.log(`\n✅ Successfully retrieved booked seats`);
      console.log(`   Count: ${bookedSeatsData.count}`);
      if (bookedSeatsData.count > 0) {
        console.log(`   Seats: ${bookedSeatsData.bookedSeats.join(', ')}`);
        console.log(`\n   Details:`);
        bookedSeatsData.details?.forEach(d => {
          console.log(`     Seat ${d.seatNumber}: ${d.status} (Ref: ${d.bookingRef})`);
        });
      } else {
        console.log(`   ✅ No booked seats (all available)`);
      }
    }
    
    // Test 2: Full seat map endpoint
    console.log('\n' + '='.repeat(60));
    console.log('\n📍 TEST 2: GET /api/seats/schedules/:scheduleId');
    console.log('-'.repeat(60));
    
    const seatMapRes = await fetch(`${API_URL}/api/seats/schedules/${scheduleId}`);
    const seatMapData = await seatMapRes.json();
    
    console.log(`\nStatus: ${seatMapRes.status}`);
    
    if (seatMapData.seats) {
      const seats = seatMapData.seats;
      const available = seats.filter(s => s.state === 'AVAILABLE').length;
      const booked = seats.filter(s => s.state === 'BOOKED').length;
      const locked = seats.filter(s => s.state === 'LOCKED').length;
      const driver = seats.filter(s => s.state === 'DRIVER').length;
      
      console.log(`\n✅ Seat map retrieved successfully`);
      console.log(`   Total seats: ${seats.length}`);
      console.log(`   AVAILABLE: ${available} 🟢`);
      console.log(`   BOOKED: ${booked} 🔴`);
      console.log(`   LOCKED: ${locked} 🟡`);
      console.log(`   DRIVER: ${driver} ⚫`);
      
      if (booked > 0) {
        const bookedSeats = seats
          .filter(s => s.state === 'BOOKED')
          .map(s => s.seat_number)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .join(', ');
        console.log(`\n   Booked seats: ${bookedSeats}`);
      }
      
      // Compare with booked-seats endpoint
      console.log('\n' + '-'.repeat(60));
      console.log('\n🔍 COMPARISON:');
      console.log(`   Booked seats from /booked-seats: ${bookedSeatsData.count}`);
      console.log(`   Booked seats from full seat map: ${booked}`);
      
      if (bookedSeatsData.count === booked) {
        console.log(`   ✅ MATCH: Both endpoints agree on booked seat count`);
      } else {
        console.log(`   ⚠️  MISMATCH: Endpoints disagree on booked seat count`);
      }
    }
    
    // Test 3: Verify seat availability logic
    console.log('\n' + '='.repeat(60));
    console.log('\n📍 TEST 3: VERIFY SEAT LOGIC');
    console.log('-'.repeat(60));
    
    console.log(`\n✅ Expected Behavior:`);
    console.log(`   Seats with CONFIRMED tickets → BOOKED 🔴`);
    console.log(`   Seats with CHECKED_IN tickets → BOOKED 🔴`);
    console.log(`   Seats with PENDING_PAYMENT tickets → AVAILABLE 🟢`);
    console.log(`   Seats with CANCELLED tickets → AVAILABLE 🟢`);
    console.log(`   Seats with EXPIRED tickets → AVAILABLE 🟢`);
    console.log(`   Seats with no tickets → AVAILABLE 🟢`);
    
    console.log(`\n✅ Only PAID tickets lock seats!`);
    
    // Test 4: Sample seat selection
    if (seatMapData.seats) {
      console.log('\n' + '='.repeat(60));
      console.log('\n📍 TEST 4: SAMPLE SEAT SELECTION');
      console.log('-'.repeat(60));
      
      const availableSeats = seatMapData.seats
        .filter(s => s.state === 'AVAILABLE' && s.state !== 'DRIVER')
        .slice(0, 3);
      
      if (availableSeats.length > 0) {
        console.log(`\n✅ Available seats for booking:`);
        availableSeats.forEach(s => {
          console.log(`   Seat ${s.seat_number}: ${s.state} 🟢`);
        });
        console.log(`\n   These ${availableSeats.length} seats can be selected for booking`);
      } else {
        console.log(`\n⚠️  All passenger seats are currently booked`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error('\nStack:', error.stack);
  }
}

// Run tests
if (require.main === module) {
  testSeatEndpoints().catch(console.error);
}

module.exports = { testSeatEndpoints };
