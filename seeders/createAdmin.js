require('dotenv').config();
const sequelize = require('../config/database');
const { User } = require('../models');

async function createAdminUser() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Check if admin exists
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user with fixed credentials
    const adminUser = await User.create({
      full_name: 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@safaritix.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      role: 'admin',
      email_verified: true,
      is_active: true,
      phone_number: process.env.ADMIN_PHONE || '+254700000000'
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email:', adminUser.email);
    console.log('⚠️  Please change the default password after first login');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await sequelize.close();
  }
}

createAdminUser();
