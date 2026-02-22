#!/usr/bin/env node
// Safely list tables in the public schema
// Usage: node scripts/list-tables.js

require('dotenv').config();
const sequelize = require('../config/database');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database. Querying tables...');

    const [rows] = await sequelize.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;");
    if (!rows || rows.length === 0) {
      console.log('No tables found in public schema.');
      process.exit(0);
    }

    console.log('Tables in public schema:');
    for (const r of rows) {
      console.log(' -', r.tablename);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error listing tables:', err && err.stack ? err.stack : err);
    process.exit(1);
  } finally {
    try { await sequelize.close(); } catch (e) { /* ignore */ }
  }
})();
