require("dotenv").config();
const sequelize = require('../config/database');

async function checkBuses() {
  try {
    // Simple raw query to avoid association issues
    const [buses] = await sequelize.query(`
      SELECT 
        b.id,
        b.plate_number,
        b.model,
        b.status,
        d.name as driver_name,
        d.id as driver_id
      FROM buses b
      LEFT JOIN drivers d ON b.driver_id = d.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    console.log('\n🚌 AVAILABLE BUSES FOR GPS TRACKING TEST\n');
    console.log('=' .repeat(80));
    
    if (buses.length === 0) {
      console.log('❌ No buses found in database!');
      console.log('\n📝 You need to:');
      console.log('1. Login as company admin');
      console.log('2. Go to Buses page (/dashboard/company/buses)');
      console.log('3. Add at least one bus');
      console.log('4. Assign a driver to the bus');
      process.exit(0);
      return;
    }

    console.log(`Found ${buses.length} buses:\n`);

    buses.forEach((bus, index) => {
      console.log(`${index + 1}. 🚌 Bus ID: ${bus.id}`);
      console.log(`   📝 Plate: ${bus.plate_number}`);
      console.log(`   🚗 Model: ${bus.model}`);
      console.log(`   👤 Driver: ${bus.driver_name || '⚠️  NOT ASSIGNED'}`);
      console.log(`   📊 Status: ${bus.status}`);
      console.log('');
    });

    // Check for active tracking
    const [tracking] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM live_bus_locations 
      WHERE is_active = true
    `);

    console.log('=' .repeat(80));
    console.log(`\n📍 Active GPS Tracking: ${tracking[0].count} buses\n`);

    if (tracking[0].count === 0) {
      console.log('⚠️  NO BUSES ARE CURRENTLY TRACKING!\n');
      console.log('📝 TO START GPS TRACKING:\n');
      console.log('1. Copy a Bus ID from above (e.g., ' + (buses[0]?.id || 'xxxx-xxxx') + ')');
      console.log('2. Login as a driver who is assigned to that bus');
      console.log('3. Navigate to: /driver/dashboard/tracking');
      console.log('4. Paste the Bus ID in the input field');
      console.log('5. Click the green "Start Trip" button');
      console.log('6. Allow GPS access when browser prompts');
      console.log('7. Keep the tab open!\n');
      console.log('8. In another tab/browser, login as company admin');
      console.log('9. Go to: /dashboard/company/tracking');
      console.log('10. You should see the bus on the map within 10 seconds! 🎉\n');
    } else {
      console.log('✅ Buses are tracking! Check the live map.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkBuses();
