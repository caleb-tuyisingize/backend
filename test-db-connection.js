// Test script to verify database connection and create all tables
const sequelize = require('./config/database');
const models = require('./models');

async function testDatabaseAndCreateTables() {
  try {
    console.log('🔍 Testing database connection...\n');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful!\n');
    
    console.log('📊 Creating/Syncing database tables...\n');
    
    // Create all tables (force: true will drop existing tables)
    // Use { alter: true } in production to preserve data
    await sequelize.sync({ force: true, alter: false });
    
    console.log('✅ All tables created successfully!\n');
    
    // List all tables
    console.log('📋 Tables created:');
    console.log('   - users');
    console.log('   - companies');
    console.log('   - buses');
    console.log('   - drivers');
    console.log('   - driver_assignments');
    console.log('   - routes');
    console.log('   - schedules');
    console.log('   - tickets');
    console.log('   - journals');
    console.log('   - locations');
    console.log('   - notifications\n');
    
    console.log('✅ Database setup complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testDatabaseAndCreateTables();
