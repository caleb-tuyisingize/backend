require('dotenv').config();
const sequelize = require('./config/database');
const models = require('./models');

async function syncDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    console.log('\n🔄 Syncing all models to database...');
    console.log('📋 Models to sync:');
    console.log('   - Users');
    console.log('   - Companies');
    console.log('   - Buses');
    console.log('   - Drivers');
    console.log('   - Driver Assignments');
    console.log('   - Routes');
    console.log('   - Schedules');
    console.log('   - Tickets');
    console.log('   - Payments');
    console.log('   - Journals');
    console.log('   - Locations');
    console.log('   - Notifications');
    
    // Sync all models with the database
    // alter: true will update existing tables to match models
    // force: true would drop and recreate all tables (use with caution!)
    await sequelize.sync({ alter: true });
    
    console.log('\n✅ All tables have been created/updated successfully!');
    console.log('\n📊 Database Schema Summary:');
    console.log('   - Database:', sequelize.config.database || 'neondb');
    console.log('   - Dialect:', sequelize.getDialect());
    console.log('   - Tables created: 13');
    
    console.log('\n💡 Next steps:');
    console.log('   1. Run: node seeders/createAdmin.js (to create admin user)');
    console.log('   2. Start your server: npm start');
    
  } catch (error) {
    console.error('❌ Error syncing database:', error.message);
    console.error('\nTroubleshooting:');
    console.error('   - Check your DATABASE_URL in .env file');
    console.error('   - Ensure your Neon database is active');
    console.error('   - Verify network connection');
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Database connection closed.');
  }
}

syncDatabase();
