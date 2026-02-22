const pool = require('./config/pgPool');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let client;
  
  try {
    console.log('\n🔧 Starting Schedule Time Column Migration...\n');
    console.log('This will fix the timezone conversion issue by changing:');
    console.log('  departure_time: TIMESTAMP WITH TIME ZONE → TIME WITHOUT TIME ZONE');
    console.log('  arrival_time: TIMESTAMP WITH TIME ZONE → TIME WITHOUT TIME ZONE\n');

    // Read migration SQL
    const migrationPath = path.join(__dirname, 'migrations', '20260221_fix_schedule_time_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Connect to database
    client = await pool.connect();
    console.log('✅ Connected to database\n');

    // Show before state
    console.log('📊 BEFORE Migration:');
    const beforeResult = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'schedules' 
        AND column_name IN ('departure_time', 'arrival_time')
      ORDER BY column_name
    `);
    
    if (beforeResult.rows.length > 0) {
      beforeResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('  ⚠️  Columns not found or already migrated');
    }

    // Show sample data before migration
    const sampleBefore = await client.query(`
      SELECT id, schedule_date, departure_time, arrival_time 
      FROM schedules 
      LIMIT 3
    `);
    
    if (sampleBefore.rows.length > 0) {
      console.log('\n📋 Sample data BEFORE migration:');
      sampleBefore.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Date: ${row.schedule_date} | Departure: ${row.departure_time} | Arrival: ${row.arrival_time}`);
      });
    }

    console.log('\n🔄 Running migration...\n');

    // Execute migration within a transaction
    await client.query('BEGIN');
    
    // Split SQL into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 0);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.includes('ALTER TABLE') || stmt.includes('UPDATE')) {
        console.log(`  Executing step ${i + 1}/${statements.length}...`);
        await client.query(stmt);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!\n');

    // Show after state
    console.log('📊 AFTER Migration:');
    const afterResult = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'schedules' 
        AND column_name IN ('departure_time', 'arrival_time')
      ORDER BY column_name
    `);
    
    afterResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Show sample data after migration
    const sampleAfter = await client.query(`
      SELECT id, schedule_date, departure_time, arrival_time 
      FROM schedules 
      LIMIT 3
    `);
    
    if (sampleAfter.rows.length > 0) {
      console.log('\n📋 Sample data AFTER migration:');
      sampleAfter.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Date: ${row.schedule_date} | Departure: ${row.departure_time} | Arrival: ${row.arrival_time}`);
      });
    }

    console.log('\n✅ SUCCESS! Times are now stored as-is without timezone conversion.');
    console.log('   Example: 15:35 will stay 15:35 (not converted to 13:35 in UTC)\n');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migration
runMigration();
