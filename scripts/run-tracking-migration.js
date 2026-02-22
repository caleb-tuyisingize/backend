require("dotenv").config();
const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');

async function runMigration() {
  try {
    console.log('🔄 Running live_bus_locations migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/create-live-bus-locations-simple.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await sequelize.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Created live_bus_locations table');
    console.log('   - Added indexes for performance');
    console.log('   - Enabled RLS policies');
    console.log('   - Added realtime subscription');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
