const sequelize = require('../config/database');
const { Bus, Seat } = require('../models');

const pad = (n, width = 2) => n.toString().padStart(width, '0');

const generateSeatsForBus = async (bus) => {
  const capacity = bus.capacity || (bus.seat_layout === '25' ? 25 : bus.seat_layout === '50' ? 50 : 30);
  const rows = Math.ceil(capacity / 4);
  const seats = [];
  let seatIndex = 1;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < 4; c++) {
      if (seatIndex > capacity) break;
      const seat_number = pad(seatIndex);
      const side = c < 2 ? 'L' : 'R';
      const col = c < 2 ? c + 1 : c - 1;
      seats.push({ bus_id: bus.id, company_id: bus.company_id, seat_number, row: r, col, side, is_window: c % 2 === 0 });
      seatIndex++;
    }
  }
  return seats;
};

const seed = async () => {
  try {
    await sequelize.authenticate();
    const buses = await Bus.findAll();
    for (const bus of buses) {
      const existing = await Seat.count({ where: { bus_id: bus.id } });
      if (existing > 0) {
        console.log(`Bus ${bus.plate_number} already has ${existing} seats, skipping`);
        continue;
      }
      const seats = await generateSeatsForBus(bus);
      await Seat.bulkCreate(seats);
      console.log(`Created ${seats.length} seats for bus ${bus.plate_number}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Seat seeding failed', err);
    process.exit(1);
  }
};

seed();
