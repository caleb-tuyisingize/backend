const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/pgPool');

async function checkSeats() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT COUNT(*) as count
      FROM seats
      WHERE bus_id = '3222e65c-2109-4872-a648-40ee2288c3f7'
    `);
    console.log(`\n✅ Bus RAH123 has ${result.rows[0].count} seats\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSeats();
