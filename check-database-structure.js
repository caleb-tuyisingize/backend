require('dotenv').config();
const pool = require('./config/pgPool');

async function checkDatabaseStructure() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 CHECKING DATABASE STRUCTURE\n');
    
    // 1. List all tables
    console.log('1️⃣ All Tables:');
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    tables.rows.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.tablename}`);
    });
    
    // 2. Check if trips table exists
    const tripsExists = tables.rows.some(t => t.tablename === 'trips');
    console.log(`\n2️⃣ Trips table exists: ${tripsExists ? '✅ YES' : '❌ NO'}`);
    
    if (!tripsExists) {
      console.log('\n🚨 PROBLEM: The trips table is missing!');
      console.log('   This is why all scans fail with "Trip not active"\n');
    }
    
    // 3. Check for trip-related migrations
    console.log('\n3️⃣ Looking for trip migration files...');
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.includes('trip'))
        .sort();
      
      if (files.length === 0) {
        console.log('  ❌ No trip-related migration files found\n');
      } else {
        console.log(`  Found ${files.length} trip-related migration(s):`);
        files.forEach((f, i) => {
          console.log(`  ${i + 1}. ${f}`);
        });
      }
    }
    
    // 4. Check schedules table structure
    console.log('\n4️⃣ Schedules Table Structure:');
    const scheduleColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'schedules'
      ORDER BY ordinal_position;
    `);
    
    console.log('  Columns:');
    scheduleColumns.rows.forEach(col => {
      console.log(`    - ${col.column_name} (${col.data_type})`);
    });
    
    console.log('\n✅ Check complete!\n');
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabaseStructure().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
