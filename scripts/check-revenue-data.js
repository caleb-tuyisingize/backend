const { Ticket, User, Route, Schedule } = require('../models');

async function checkRevenueData() {
  try {
    console.log('\n=== REVENUE DATA CHECK ===\n');

    // Check total tickets
    const totalTickets = await Ticket.count();
    console.log(`📊 Total Tickets in DB: ${totalTickets}`);

    // Check by status
    const confirmedCount = await Ticket.count({ where: { status: 'CONFIRMED' } });
    const checkedInCount = await Ticket.count({ where: { status: 'CHECKED_IN' } });
    const pendingPaymentCount = await Ticket.count({ where: { status: 'PENDING_PAYMENT' } });
    const cancelledCount = await Ticket.count({ where: { status: 'CANCELLED' } });
    
    console.log(`   ✓ CONFIRMED: ${confirmedCount}`);
    console.log(`   ✓ CHECKED_IN: ${checkedInCount}`);
    console.log(`   ⏳ PENDING_PAYMENT: ${pendingPaymentCount}`);
    console.log(`   ✗ CANCELLED: ${cancelledCount}`);

    // Get sample tickets
    if (totalTickets > 0) {
      console.log('\n📋 Sample Tickets:');
      const sampleTickets = await Ticket.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [
          { model: User, as: 'user', attributes: ['firstName', 'lastName'] },
          { 
            model: Schedule,
            as: 'schedule',
            include: [{ model: Route, as: 'route' }]
          }
        ]
      });

      sampleTickets.forEach((ticket, index) => {
        const passenger = ticket.user 
          ? `${ticket.user.firstName} ${ticket.user.lastName}` 
          : 'Unknown';
        const route = ticket.schedule?.route 
          ? `${ticket.schedule.route.origin} → ${ticket.schedule.route.destination}`
          : 'No route';
        
        console.log(`\n   ${index + 1}. Booking: ${ticket.bookingReference || 'N/A'}`);
        console.log(`      Passenger: ${passenger}`);
        console.log(`      Route: ${route}`);
        console.log(`      Price: KES ${ticket.price || 0}`);
        console.log(`      Status: ${ticket.status}`);
        console.log(`      Created: ${ticket.createdAt?.toLocaleDateString() || 'N/A'}`);
      });
    }

    // Calculate revenue
    const revenueTickets = await Ticket.findAll({
      where: { status: ['CONFIRMED', 'CHECKED_IN'] }
    });

    const totalRevenue = revenueTickets.reduce((sum, t) => sum + parseFloat(t.price || 0), 0);
    console.log(`\n💰 Total Revenue: KES ${totalRevenue.toLocaleString()}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRevenueData();
