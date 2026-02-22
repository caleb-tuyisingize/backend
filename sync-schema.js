const sequelize = require('./config/database');
const models = require('./models');

const syncDatabase = async () => {
  try {
    console.log('Authenticating database...');
    await sequelize.authenticate();
    console.log('Database connected successfully');
    
    console.log('Syncing database schema...');
    await sequelize.sync({ alter: true });
    console.log('Database schema synchronized');
    // Create DB-level partial unique index for active seat locks (Postgres only)
    try {
      const dialect = sequelize.getDialect();
      if (dialect === 'postgres') {
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS seat_locks_one_active_per_seat ON seat_locks (schedule_id, seat_number) WHERE status = 'ACTIVE'`
        );
        console.log('Ensured partial unique index for active seat locks');
      }
    } catch (err) {
      console.warn('Could not create partial index for seat_locks:', err.message || err);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Failed to sync database:', error.message);
    process.exit(1);
  }
};

syncDatabase();
