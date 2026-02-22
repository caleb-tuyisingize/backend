const { Ticket } = require('../models');

async function quickCheck() {
  try {
    const tickets = await Ticket.findAll({ 
      attributes: ['id', 'booking_ref', 'status', 'price', 'booked_at'],
      limit: 20,
      order: [['booked_at', 'DESC']]
    });

    console.log('\n📊 TICKETS FOUND:', tickets.length);
    
    if (tickets.length > 0) {
      console.log('\nSample tickets:');
      tickets.forEach((t, i) => {
        console.log(`${i+1}. ${t.booking_ref} - Status: ${t.status} - RWF ${t.price} - ${new Date(t.booked_at).toLocaleDateString()}`);
      });

      const confirmed = tickets.filter(t => t.status === 'CONFIRMED' || t.status === 'CHECKED_IN');
      console.log(`\n✅ Confirmed/Checked-in tickets: ${confirmed.length}`);
      
      const totalRevenue = confirmed.reduce((sum, t) => sum + parseFloat(t.price || 0), 0);
      console.log(`💰 Total Revenue: RWF ${totalRevenue.toLocaleString()}`);
    } else {
      console.log('\n❌ NO TICKETS IN DATABASE');
      console.log('   You need to book some tickets first!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

quickCheck();
