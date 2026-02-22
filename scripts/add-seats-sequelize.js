require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Seat, Bus } = require('../models');

const busId = process.argv[2] || '3222e65c-2109-4872-a648-40ee2288c3f7';
const capacity = parseInt(process.argv[3]) || 30;

async function addSeats() {
  try {
    console.log(`\n🪑 Adding ${capacity} seats to bus ${busId}...\n`);
    
    // Get bus info
    const bus = await Bus.findByPk(busId);
   if (!bus) {
      console.log('❌ Bus not found!');
      process.exit(1);
    }
    
    console.log(`Found bus: ${bus.plate_number} (capacity: ${bus.capacity}, company: ${bus.company_id})`);
    
    // Check existing
    const existing = await Seat.count({ where: { bus_id: busId } });
    if (existing > 0) {
      console.log(`\n⚠️  Bus already has ${existing} seats!`);
      console.log('Skipping...\n');
      process.exit(0);
    }
    
    console.log(`\n✨ Creating ${capacity} seats...\n`);
    
    // Create seats in 2-2 layout
    const seats = [];
    let seatNumber = 1;
    const seatsPerRow = 4;
    const rows = Math.ceil(capacity / seatsPerRow);
    
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= seatsPerRow && seatNumber <= capacity; col++) {
        const isLeft = col <= 2;
        const side = isLeft ? 'L' : 'R';
        const positionInSide = isLeft ? col : col - 2;
        const isWindow = positionInSide === 1;
        
        // Mark seat #1 as driver seat
        const isDriver = seatNumber === 1;
        
        seats.push({
          bus_id: busId,
          company_id: bus.company_id,
          seat_number: String(seatNumber),
          row: row,
          col: positionInSide,
          side: side,
          is_window: isWindow,
          is_driver: isDriver,
          meta: { layout: '2-2' }
        });
        
        seatNumber++;
      }
    }
    
    // Insert seats using Sequelize bulkCreate
    console.log(`Inserting ${seats.length} seats...`);
    const created = await Seat.bulkCreate(seats);
    console.log(`\n✅ Successfully created ${created.length} seats!\n`);
    
    // Verify
    const total = await Seat.count({ where: { bus_id: busId } });
    console.log(`✅ Verification: Bus now has ${total} seats\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addSeats();
