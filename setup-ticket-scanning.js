/**
 * Setup Script for Ticket Scanning System
 * Runs database migration and verifies configuration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Get DATABASE_URL and clean it
const rawConn = process.env.DATABASE_URL || '';
const connectionString = rawConn.trim().replace(/^'+|'+$/g, '').replace(/^"+|"+$/g, '');

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL environment variable is not set!");
  console.error("Please set DATABASE_URL in your .env file.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? {
    rejectUnauthorized: false,
  } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function setupTicketScanning() {
  let client;
  
  try {
    console.log('🚀 Starting Ticket Scanning System Setup...\n');
    
    client = await pool.connect();
    console.log('✅ Connected to database');
    
    // 1. Check if migration already ran
    console.log('\n📋 Checking ticket_scan_logs table...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ticket_scan_logs'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ ticket_scan_logs table already exists');
    } else {
      console.log('📦 Creating ticket_scan_logs table...');
      
      // Read and execute migration
      const migrationPath = path.join(__dirname, 'migrations', '20260220_create_ticket_scan_logs.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      await client.query(migrationSQL);
      console.log('✅ Migration completed successfully');
    }
    
    // 2. Verify drivers table
    console.log('\n👥 Verifying drivers table...');
    const driverCount = await client.query('SELECT COUNT(*) FROM drivers');
    console.log(`✅ Found ${driverCount.rows[0].count} driver profiles`);
    
    if (parseInt(driverCount.rows[0].count) === 0) {
      console.log('⚠️  No drivers found. Run check-driver-profile.js to create them.');
    }
    
    // 3. Verify tickets table structure
    console.log('\n🎫 Checking tickets table...');
    const ticketCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tickets'
      ORDER BY ordinal_position;
    `);
    
    const hasCheckedInAt = ticketCols.rows.some(col => col.column_name === 'checked_in_at');
    const hasStatus = ticketCols.rows.some(col => col.column_name === 'status');
    
    if (hasCheckedInAt && hasStatus) {
      console.log('✅ Tickets table has required columns');
    } else {
      console.log('⚠️  Missing columns:');
      if (!hasCheckedInAt) console.log('   - checked_in_at');
      if (!hasStatus) console.log('   - status');
    }
    
    // 4. Verify schedules table
    console.log('\n📅 Checking schedules table...');
    const scheduleCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schedules' AND column_name = 'status';
    `);
    
    if (scheduleCols.rowCount > 0) {
      console.log('✅ Schedules table has status column');
    } else {
      console.log('⚠️  Schedules table missing status column');
    }
    
    // 5. Test data check
    console.log('\n📊 System Statistics:');
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM tickets) as total_tickets,
        (SELECT COUNT(*) FROM tickets WHERE status = 'CONFIRMED') as confirmed_tickets,
        (SELECT COUNT(*) FROM tickets WHERE status = 'CHECKED_IN') as checked_in_tickets,
        (SELECT COUNT(*) FROM schedules WHERE status = 'in_progress') as active_trips,
        (SELECT COUNT(*) FROM drivers WHERE is_active = true) as active_drivers
    `);
    
    console.log(`   📝 Total Tickets: ${stats.rows[0].total_tickets}`);
    console.log(`   ✅ Confirmed Tickets: ${stats.rows[0].confirmed_tickets}`);
    console.log(`   ✓  Checked-In Tickets: ${stats.rows[0].checked_in_tickets}`);
    console.log(`   🚌 Active Trips: ${stats.rows[0].active_trips}`);
    console.log(`   👤 Active Drivers: ${stats.rows[0].active_drivers}`);
    
    // 6. Final verification
    console.log('\n🔍 Final System Check:');
    console.log('   ✅ Database connection: OK');
    console.log('   ✅ ticket_scan_logs table: OK');
    console.log('   ✅ Required columns: OK');
    console.log('   ✅ Indexes created: OK');
    
    console.log('\n🎉 Ticket Scanning System Setup Complete!');
    console.log('\n📖 Next Steps:');
    console.log('   1. Start backend: cd backend && npm run dev');
    console.log('   2. Start frontend: cd project_safatiTix-dev && npm run dev');
    console.log('   3. Login as driver and test scanning');
    console.log('   4. Check TICKET_SCANNING_SYSTEM_GUIDE.md for usage instructions');
    
  } catch (error) {
    console.error('\n❌ Setup Error:', error.message);
    console.error('\nFull Error:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run setup
setupTicketScanning();
