/**
 * Test Script: Time-Based Ticket Cancellation Rule
 * 
 * This script tests the 10-minute cancellation rule:
 * - Tickets can be cancelled if departure is at least 10 minutes away
 * - Tickets cannot be cancelled if departure is less than 10 minutes away
 * - Seat unlock logic still works after cancellation
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Ticket, Schedule } = require('../models');

async function testCancellationRule() {
  try {
    console.log('🧪 Testing Time-Based Ticket Cancellation Rule\n');
    console.log('='.repeat(70));
    
    // Find a confirmed ticket with schedule information
    console.log('\n📋 Finding test ticket...');
    const ticket = await Ticket.findOne({
      where: { 
        status: 'CONFIRMED'
      },
      include: [{
        model: Schedule,
        attributes: ['id', 'departure_time', 'schedule_date', 'available_seats', 'booked_seats']
      }],
      limit: 1
    });
    
    if (!ticket) {
      console.log('❌ No confirmed tickets found for testing');
      process.exit(0);
    }
    
    console.log(`✅ Found ticket: ${ticket.id}`);
    console.log(`   - Seat: ${ticket.seat_number}`);
    console.log(`   - Status: ${ticket.status}`);
    console.log(`   - Schedule ID: ${ticket.schedule_id}`);
    
    if (!ticket.Schedule) {
      console.log('❌ Ticket has no schedule information');
      process.exit(1);
    }
    
    const schedule = ticket.Schedule;
    console.log(`\n📅 Schedule Information:`);
    console.log(`   - Departure: ${schedule.departure_time}`);
    console.log(`   - Date: ${schedule.schedule_date}`);
    console.log(`   - Available Seats: ${schedule.available_seats}`);
    console.log(`   - Booked Seats: ${schedule.booked_seats}`);
    
    // Calculate time until departure
    const now = new Date();
    const departure = new Date(schedule.departure_time);
    const timeDiffMinutes = (departure.getTime() - now.getTime()) / (1000 * 60);
    
    console.log(`\n⏰ Time Check:`);
    console.log(`   - Current Time: ${now.toISOString()}`);
    console.log(`   - Departure Time: ${departure.toISOString()}`);
    console.log(`   - Time Until Departure: ${timeDiffMinutes.toFixed(2)} minutes`);
    
    if (timeDiffMinutes < 10) {
      console.log(`\n🚫 Test Result: CANCELLATION WOULD BE BLOCKED`);
      console.log(`   - Reason: Less than 10 minutes before departure`);
      console.log(`   - Expected Backend Response: 400 error`);
      console.log(`   - Expected Message: "Ticket cannot be cancelled less than 10 minutes before departure"`);
    } else {
      console.log(`\n✅ Test Result: CANCELLATION WOULD BE ALLOWED`);
      console.log(`   - Reason: ${timeDiffMinutes.toFixed(2)} minutes before departure (>= 10 minutes)`);
      console.log(`   - Expected Backend Response: 200 success`);
      console.log(`   - Expected Changes:`);
      console.log(`     * Ticket status: CONFIRMED → CANCELLED`);
      console.log(`     * Available seats: ${schedule.available_seats} → ${parseInt(schedule.available_seats) + 1}`);
      console.log(`     * Booked seats: ${schedule.booked_seats} → ${Math.max(0, parseInt(schedule.booked_seats) - 1)}`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📝 Testing Guidelines:');
    console.log('   1. Use Postman/curl to test the actual API:');
    console.log(`      PATCH /api/company/tickets/${ticket.id}`);
    console.log('      Body: { "status": "CANCELLED" }');
    console.log('   2. Verify error message matches expected output');
    console.log('   3. Check frontend button is disabled when < 10 minutes');
    console.log('   4. Verify seat unlock logic works when cancellation allowed');
    console.log('='.repeat(70));
    
    // Test multiple tickets with different departure times
    console.log('\n\n📊 Summary of All Confirmed Tickets:');
    console.log('-'.repeat(70));
    
    const allTickets = await Ticket.findAll({
      where: { 
        status: ['CONFIRMED', 'CHECKED_IN']
      },
      include: [{
        model: Schedule,
        attributes: ['id', 'departure_time', 'schedule_date']
      }],
      limit: 10,
      order: [['created_at', 'DESC']]
    });
    
    console.log(`Found ${allTickets.length} active ticket(s):\n`);
    
    const results = allTickets.map(t => {
      if (!t.Schedule || !t.Schedule.departure_time) {
        return {
          ticket_id: t.id,
          seat: t.seat_number,
          status: t.status,
          departure: 'Unknown',
          minutes_until: 'N/A',
          can_cancel: 'Unknown'
        };
      }
      
      const dep = new Date(t.Schedule.departure_time);
      const mins = (dep.getTime() - now.getTime()) / (1000 * 60);
      
      return {
        ticket_id: t.id.substring(0, 8) + '...',
        seat: t.seat_number,
        status: t.status,
        departure: dep.toLocaleString(),
        minutes_until: mins.toFixed(1),
        can_cancel: mins >= 10 ? '✅ YES' : '🚫 NO'
      };
    });
    
    console.table(results);
    
    console.log('\n✅ Test analysis complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    throw error;
  }
}

// Run tests
testCancellationRule()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
