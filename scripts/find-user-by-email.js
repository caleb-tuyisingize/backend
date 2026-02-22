#!/usr/bin/env node
// Find users by exact or partial email
// Usage: node scripts/find-user-by-email.js <email-or-substring>

const { User } = require('../models');
const { Op } = require('sequelize');

(async () => {
  try {
    const q = process.argv[2];
    if (!q) {
      console.error('Usage: node scripts/find-user-by-email.js <email-or-substring>');
      process.exit(1);
    }

    const users = await User.findAll({
      where: {
        email: {
          [Op.iLike]: `%${q}%`
        }
      },
      attributes: ['id', 'email', 'full_name', 'role', 'company_id', 'is_active', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    if (!users || users.length === 0) {
      console.log('No users found matching:', q);
      process.exit(0);
    }

    console.log(`Found ${users.length} user(s):`);
    for (const u of users) {
      console.log(`${u.id}  |  ${u.email}  |  ${u.full_name || ''}  |  role=${u.role}  |  active=${u.is_active}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error finding users:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
