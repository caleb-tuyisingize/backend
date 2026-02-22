require("dotenv").config();
const { Bus, Driver, Company } = require('../models');

async function listBusesForTesting() {
  try {
    console.log('\n🚌 AVAILABLE BUSES FOR GPS TRACKING TEST\n');
    console.log('=' .repeat(80));
    
    const buses = await Bus.findAll({
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: ['id', 'name', 'phone'],
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    if (buses.length === 0) {
      console.log('❌ No buses found in database!');
      console.log('\nYou need to:');
      console.log('1. Login as company admin');
      console.log('2. Go to Buses page');
      console.log('3. Add at least one bus');
      console.log('4. Assign a driver to the bus');
      return;
    }

    console.log(`Found ${buses.length} buses:\n`);

    buses.forEach((bus, index) => {
      console.log(`${index + 1}. Bus ID: ${bus.id}`);
      console.log(`   Plate: ${bus.plate_number}`);
      console.log(`   Model: ${bus.model}`);
      console.log(`   Driver: ${bus.driver?.name || '⚠️  NOT ASSIGNED'}`);
      console.log(`   Status: ${bus.status}`);
      console.log('');
    });

    console.log('=' .repeat(80));
    console.log('\n📝 TO TEST GPS TRACKING:\n');
    console.log('1. Copy a Bus ID from above');
    console.log('2. Make sure that bus has a driver assigned');
    console.log('3. Login as that driver');
    console.log('4. Go to: /driver/dashboard/tracking');
    console.log('5. Paste the Bus ID and click "Start Trip"');
    console.log('6. Allow GPS access in your browser');
    console.log('7. Open company dashboard in another tab');
    console.log('8. Go to: /dashboard/company/tracking');
    console.log('9. You should see the bus on the map within 10 seconds!\n');

    // Check for drivers
    const drivers = await Driver.findAll({ limit: 5 });
    if (drivers.length > 0) {
      console.log('\n👤 AVAILABLE DRIVERS:\n');
      drivers.forEach((driver, index) => {
        console.log(`${index + 1}. ${driver.name} (ID: ${driver.id})`);
      });
    } else {
      console.log('\n⚠️  WARNING: No drivers found! Create a driver first.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listBusesForTesting();
