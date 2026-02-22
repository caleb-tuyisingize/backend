/**
 * Add Seats to Bus
 * 
 * Creates seat records for a bus that has none
 * Default layout: 2-2 configuration (Left, Right)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { v4: uuidv4 } = require('uuid');

const pool = require('../config/pgPool');

const busId = process.argv[2];
const capacity = parseInt(process.argv[3]) || 30;

if (!busId) {
  console.log('Usage: node add-seats-to-bus.js <bus_id> [capacity]');
  console.log('Example: node add-seats-to-bus.js 3222e65c-2109-4872-a648-40ee2288c3f7 30');
  process.exit(1);
}

async function addSeats() {
  const client = await pool.connect();
  try {
    console.log(`\n🪑 Adding ${capacity} seats to bus ${busId}...\n`);
    
    // Check if bus exists
    const busResult = await client.query(`
      SELECT id, plate_number, capacity, company_id
      FROM buses
      WHERE id = $1
    `, [busId]);
    
    if (busResult.rows.length === 0) {
      console.log('❌ Bus not found!');
      return;
    }
    
    const bus = busResult.rows[0];
    console.log(`Found bus: ${bus.plate_number} (capacity: ${bus.capacity}, company: ${bus.company_id})`);
    
    // Check existing seats
    const existingResult = await client.query(`
      SELECT COUNT(*) as count
      FROM seats
      WHERE bus_id = $1
    `, [busId]);
    
    const existingCount = parseInt(existingResult.rows[0].count);
    if (existingCount > 0) {
      console.log(`\n⚠️  Bus already has ${existingCount} seats!`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question('Delete existing seats and recreate? (yes/no): ', async (answer) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          await client.query('DELETE FROM seats WHERE bus_id = $1', [busId]);
          console.log('✅ Deleted existing seats');
          readline.close();
          await createSeats(client, busId, bus.company_id, capacity);
          await pool.end();
        } else {
          console.log('❌ Cancelled');
          readline.close();
          await pool.end();
          process.exit(0);
        }
      });
    } else {
      await createSeats(client, busId, bus.company_id, capacity);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
  }
}

async function createSeats(client, busId, companyId, capacity) {
  console.log(`\n✨ Creating ${capacity} seats...\n`);
  
  // Standard bus layout: 2-2 configuration
  // Row 1: Driver, empty
  // Rows 2-8+: 2 seats left, 2 seats right per row
  
  const seats = [];
  let seatNumber = 1;
  
  // Create seats in rows (4 seats per row for standard bus)
  const seatsPerRow = 4;
  const rows = Math.ceil(capacity / seatsPerRow);
  
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= seatsPerRow && seatNumber <= capacity; col++) {
      const isLeft = col <= 2;
      const side = isLeft ? 'L' : 'R';
      const positionInSide = isLeft ? col : col - 2;
      const isWindow = positionInSide === 1;
      
      seats.push({
        id: uuidv4(),
        seatNumber,
        row,
        col: positionInSide,
        side,
        isWindow
      });
      
      seatNumber++;
    }
  }
  
  // Insert seats
  let inserted = 0;
  const now = new Date();
  for (const seat of seats) {
    try {
      await client.query(`
        INSERT INTO seats (id, bus_id, company_id, seat_number, row, col, side, is_window, meta, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        seat.id,
        busId,
        companyId,
        seat.seatNumber,
        seat.row,
        seat.col,
        seat.side,
        seat.isWindow,
        JSON.stringify({ layout: '2-2' }),
        now,
        now
      ]);
      inserted++;
      
      if (inserted % 10 === 0) {
        process.stdout.write(`  Progress: ${inserted}/${seats.length} seats created...\r`);
      }
    } catch (error) {
      console.error(`Failed to insert seat ${seat.seatNumber}:`, error.message);
    }
  }
  
  console.log(`\n\n✅ Successfully created ${inserted} seats!`);
  
  // Verify
  const verifyResult = await client.query(`
    SELECT COUNT(*) as count
    FROM seats
    WHERE bus_id = $1
  `, [busId]);
  
  console.log(`✅ Verification: Bus now has ${verifyResult.rows[0].count} seats\n`);
  
  await pool.end();
  process.exit(0);
}

addSeats();
