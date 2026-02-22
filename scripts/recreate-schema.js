#!/usr/bin/env node
// Recreate entire DB schema (DESTROYING existing data) — REQUIRES explicit confirmation
// Usage (will NOT run without the word confirm):
//   node scripts/recreate-schema.js confirm

require('dotenv').config();
const sequelize = require('../config/database');
// Ensure models are loaded so sequelize.sync() knows about them
const models = require('../models');

(async () => {
  try {
    const arg = process.argv[2];
    if (arg !== 'confirm') {
      console.error('This script will DROP and recreate all tables.');
      console.error('To proceed, run: node scripts/recreate-schema.js confirm');
      process.exit(1);
    }

    console.log('⚠️  Confirmed. Recreating schema (this will DROP all tables)...');
    console.log('🔁 Authenticating to DB...');
    await sequelize.authenticate();
    console.log('🔒 Authentication successful. Starting sequelize.sync({ force: true })...');

    // Warn if sync takes too long
    const syncTimeout = setTimeout(() => {
      console.warn('⚠️ sequelize.sync is taking longer than 30s — still running...');
    }, 30000);

    await sequelize.sync({ force: true });
    clearTimeout(syncTimeout);
    console.log('🎉 sequelize.sync completed successfully');

    // List created tables for verification
    try {
      const [rows] = await sequelize.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;");
      console.log('Tables after sync:');
      rows.forEach(r => console.log(' -', r.tablename));
    } catch (listErr) {
      console.warn('Could not list tables after sync:', listErr && listErr.message ? listErr.message : listErr);
    }

    console.log('✅ Schema recreated (all tables dropped and recreated).');
    process.exit(0);
  } catch (err) {
    console.error('Error recreating schema:', err && err.stack ? err.stack : err);
    process.exit(2);
  } finally {
    try { await sequelize.close(); } catch (e) { /* ignore */ }
  }
})();
