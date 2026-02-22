const sequelize = require('../config/database');
const { Company, User, Bus, Route, Schedule, Ticket, Driver } = require('../models');

async function seedCompanyDashboardData() {
  try {
    console.log('🌱 Seeding dashboard data for company...\n');

    // Target specific company ID - replace with your company ID
    const targetCompanyId = 'c3adadb9-5d49-45e9-8e40-fe8903a5e253';
    
    const company = await Company.findByPk(targetCompanyId);

    if (!company) {
      console.error(`❌ Company with ID ${targetCompanyId} not found.`);
      console.log('\n💡 Available companies:');
      const allCompanies = await Company.findAll({ attributes: ['id', 'name', 'status'] });
      allCompanies.forEach(c => console.log(`   - ${c.name} (${c.id}) - ${c.status}`));
      process.exit(1);
    }

    console.log(`✅ Found company: ${company.name} (${company.id})\n`);

    // 1. Create/Get a bus for the company
    let bus = await Bus.findOne({ where: { company_id: company.id } });
    if (!bus) {
      bus = await Bus.create({
        company_id: company.id,
        plate_number: `RAB-${Math.floor(Math.random() * 1000)}A`,
        model: 'Toyota Coaster',
        capacity: 30,
        seat_layout: '30',
        status: 'ACTIVE'
      });
      console.log(`✅ Created bus: ${bus.plate_number}`);
    } else {
      console.log(`✅ Using existing bus: ${bus.plate_number}`);
    }

    // 2. Create/Get a driver
    let driver = await Driver.findOne({ where: { company_id: company.id } });
    if (!driver) {
      driver = await Driver.create({
        company_id: company.id,
        name: 'John Doe',
        license_number: `DL-${Math.floor(Math.random() * 10000)}`,
        phone: '+250788123456',
        is_active: true
      });
      console.log(`✅ Created driver: ${driver.name}`);
    } else {
      console.log(`✅ Using existing driver: ${driver.name}`);
    }

    // 3. Create routes
    const routes = [
      { origin: 'Kigali', destination: 'Butare' },
      { origin: 'Kigali', destination: 'Gisenyi' },
      { origin: 'Butare', destination: 'Huye' },
    ];

    console.log('\n📍 Creating routes...');
    const createdRoutes = [];
    for (const routeData of routes) {
      let route = await Route.findOne({
        where: {
          company_id: company.id,
          origin: routeData.origin,
          destination: routeData.destination
        }
      });

      if (!route) {
        route = await Route.create({
          company_id: company.id,
          name: `${routeData.origin} - ${routeData.destination}`,
          origin: routeData.origin,
          destination: routeData.destination
        });
      }
      createdRoutes.push(route);
      console.log(`  ✓ ${route.origin} → ${route.destination}`);
    }

    // 4. Create schedules and tickets
    console.log('\n🎫 Creating schedules and tickets...');
    let totalTickets = 0;
    let totalRevenue = 0;

    // Create a commuter user for tickets
    let commuter = await User.findOne({ where: { role: 'commuter' } });
    if (!commuter) {
      commuter = await User.create({
        email: `commuter${Date.now()}@test.com`,
        password_hash: 'dummy_hash',
        role: 'commuter',
        full_name: 'Test Commuter',
        phone_number: '+250788999888',
        is_active: true
      });
      console.log(`✅ Created commuter: ${commuter.full_name}`);
    }

    // Create schedules for the last 14 days
    for (let i = 0; i < 14; i++) {
      try {
        const scheduleDate = new Date();
        scheduleDate.setDate(scheduleDate.getDate() - i);
        
        const route = createdRoutes[i % createdRoutes.length];
        const price = 5000 + Math.floor(Math.random() * 5000); // 5000-10000 RWF
        const ticketsToCreate = Math.floor(Math.random() * 15) + 5; // 5-20 tickets per schedule

        const departureTime = new Date(scheduleDate);
        departureTime.setHours(8 + Math.floor(i / 2), 0, 0, 0);

        const arrivalTime = new Date(departureTime);
        arrivalTime.setHours(departureTime.getHours() + 3);

        // Create schedule
        const schedule = await Schedule.create({
          bus_id: bus.id,
          route_id: route.id,
          driver_id: driver.id,
          company_id: company.id,
          schedule_date: scheduleDate.toISOString().split('T')[0],
          departure_time: departureTime,
          arrival_time: arrivalTime,
          price_per_seat: price,
          total_seats: bus.capacity,
          available_seats: bus.capacity - ticketsToCreate,
          booked_seats: ticketsToCreate,
          status: 'scheduled',
          ticket_status: 'OPEN',
          created_by: company.owner_id
        });

        // Create tickets for this schedule
        for (let j = 0; j < ticketsToCreate; j++) {
          const seatNumber = `${j + 1}`;
          // Create unique booking ref with timestamp and random string
          const bookingRef = `BK-${Date.now()}-${i}-${j}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          
          await new Promise(resolve => setTimeout(resolve, 2)); // Small delay to ensure unique timestamps
          
          const ticket = await Ticket.create({
            passenger_id: commuter.id,
            schedule_id: schedule.id,
            company_id: company.id,
            seat_number: seatNumber,
            booking_ref: bookingRef,
            price: price,
            status: 'CONFIRMED', // Mark as confirmed so it shows in dashboard
            booked_at: new Date(scheduleDate.getTime() - Math.random() * 24 * 60 * 60 * 1000),
            checked_in_at: Math.random() > 0.5 ? new Date(scheduleDate) : null
          });

          totalTickets++;
          totalRevenue += parseFloat(price);
        }

        console.log(`  ✓ Schedule ${i + 1}: ${route.origin} → ${route.destination} (${ticketsToCreate} tickets, ${price} RWF each)`);
      } catch (scheduleError) {
        console.error(`  ✗ Error creating schedule ${i + 1}:`, scheduleError.message);
        // Continue with next schedule
      }
    }

    console.log('\n✅ Dashboard seed data created successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Company: ${company.name}`);
    console.log(`   Total Tickets: ${totalTickets}`);
    console.log(`   Total Revenue: ${totalRevenue.toLocaleString()} RWF`);
    console.log(`   Average per Day: ${Math.round(totalRevenue / 14).toLocaleString()} RWF`);
    console.log('\n🎉 Now refresh your dashboard to see the data!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedCompanyDashboardData();
