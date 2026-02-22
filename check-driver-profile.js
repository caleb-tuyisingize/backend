const pool = require('./config/pgPool');

async function checkDriverProfile() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Checking driver profiles...\n');
    
    // Get all users with driver role
    const usersQuery = await client.query(`
      SELECT id, full_name, email, role, company_id
      FROM users
      WHERE role = 'driver'
      ORDER BY full_name
    `);
    
    console.log(`Found ${usersQuery.rowCount} users with driver role:\n`);
    
    for (const user of usersQuery.rows) {
      console.log(`📋 User: ${user.full_name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Company: ${user.company_id || 'None'}`);
      
      // Check if driver profile exists
      const driverQuery = await client.query(
        'SELECT id, license_number, phone FROM drivers WHERE user_id = $1',
        [user.id]
      );
      
      if (driverQuery.rowCount > 0) {
        const driver = driverQuery.rows[0];
        console.log(`   ✅ Driver Profile: EXISTS (ID: ${driver.id})`);
        console.log(`      License: ${driver.license_number || 'Not set'}`);
        console.log(`      Phone: ${driver.phone || 'Not set'}`);
      } else {
        console.log(`   ❌ Driver Profile: MISSING`);
        console.log(`   🔧 Creating driver profile...`);
        
        // Generate a unique license number
        const timestamp = Date.now().toString().slice(-6);
        const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        const uniqueLicense = `DRV-${timestamp}-${randomSuffix}`;
        
        // Create missing driver profile with UUID and timestamps
        // Use NULL for phone to avoid unique constraint violation
        const insertQuery = await client.query(
          `INSERT INTO drivers (id, user_id, company_id, name, phone, license_number, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, NULL, $4, $5, NOW(), NOW())
           RETURNING id`,
          [
            user.id,
            user.company_id,
            user.full_name,
            uniqueLicense, // Unique license
            true
          ]
        );
        
        console.log(`   ✅ Created driver profile (ID: ${insertQuery.rows[0].id})`);
        console.log(`      License: ${uniqueLicense}`);
      }
      
      console.log('');
    }
    
    console.log('✨ Driver profile check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkDriverProfile();
