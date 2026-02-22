require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Seat } = require('../models');

async function check() {
  try {
    const seats = await Seat.findAll({
      where: { bus_id: '3222e65c-2109-4872-a648-40ee2288c3f7' },
      limit: 5
    });
    
    console.log(`\n✅ Found ${seats.length} seats (showing first 5):\n`);
    seats.forEach(s => {
      console.log(`  Seat ${s.seat_number}: Row ${s.row}, Col ${s.col}, Side ${s.side}`);
    });
    
    const total = await Seat.count({
      where: { bus_id: '3222e65c-2109-4872-a648-40ee2288c3f7' }
    });
    
    console.log(`\n📊 Total seats for bus RAH123: ${total}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

check();
