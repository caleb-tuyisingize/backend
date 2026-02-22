const { sequelize, Company, User } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const pending = await Company.findAll({ where: { status: 'pending' }, include: [{ model: User, as: 'owner' }] });

    console.log(`Found ${pending.length} pending company(ies)`);
    pending.forEach(c => {
      const obj = c.get({ plain: true });
      console.log('---');
      console.log('id:', obj.id);
      console.log('name:', obj.name);
      console.log('email:', obj.email);
      console.log('owner_id:', obj.owner_id);
      console.log('is_approved:', obj.is_approved);
      console.log('status:', obj.status);
      if (obj.owner) console.log('owner email:', obj.owner.email, 'owner active:', obj.owner.is_active);
    });
  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    await sequelize.close();
  }
})();
