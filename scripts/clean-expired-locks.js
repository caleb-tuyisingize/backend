/**
 * Clean Expired Seat Locks
 * 
 * This script removes or expires old ACTIVE seat locks that may be causing
 * seats to incorrectly show as LOCKED.
 * 
 * Usage: node scripts/clean-expired-locks.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/pgPool');

async function checkActiveLocks() {
  const client = await pool.connect();
  try {
    console.log('\n🔍 Checking active seat locks...\n');
    
    const result = await client.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_count,
        COUNT(CASE WHEN expires_at >= NOW() THEN 1 END) as valid_count
      FROM seat_locks
      GROUP BY status
      ORDER BY status
    `);
    
    console.log('Seat Locks Summary:');
    console.table(result.rows);
    
    // Get detailed info on ACTIVE locks
    const activeResult = await client.query(`
      SELECT 
        id,
        seat_number,
        schedule_id,
        status,
        expires_at,
        CASE 
          WHEN expires_at < NOW() THEN 'EXPIRED'
          ELSE 'VALID'
        END as lock_validity,
        created_at
      FROM seat_locks
      WHERE status = 'ACTIVE'
      ORDER BY expires_at DESC
      LIMIT 20
    `);
    
    if (activeResult.rows.length > 0) {
      console.log('\n📋 Active Locks (showing up to 20):');
      console.table(activeResult.rows);
    } else {
      console.log('\n✅ No active locks found.');
    }
    
    return result.rows;
  } finally {
    client.release();
  }
}

async function expireOldLocks() {
  const client = await pool.connect();
  try {
    console.log('\n🧹 Expiring old ACTIVE locks that have passed their expiration time...\n');
    
    const result = await client.query(`
      UPDATE seat_locks
      SET status = 'EXPIRED'
      WHERE status = 'ACTIVE' 
        AND expires_at < NOW()
      RETURNING id, seat_number, schedule_id, expires_at
    `);
    
    if (result.rows.length > 0) {
      console.log(`✅ Expired ${result.rows.length} old locks:`);
      console.table(result.rows);
    } else {
      console.log('✅ No expired locks to clean up.');
    }
    
    return result.rows.length;
  } finally {
    client.release();
  }
}

async function releaseAllActiveLocks() {
  const client = await pool.connect();
  try {
    console.log('\n⚠️  FORCE RELEASING ALL ACTIVE LOCKS...\n');
    
    const result = await client.query(`
      UPDATE seat_locks
      SET status = 'RELEASED'
      WHERE status = 'ACTIVE'
      RETURNING id, seat_number, schedule_id, expires_at
    `);
    
    if (result.rows.length > 0) {
      console.log(`✅ Released ${result.rows.length} active locks:`);
      console.table(result.rows);
    } else {
      console.log('✅ No active locks to release.');
    }
    
    return result.rows.length;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    // Step 1: Check current state
    await checkActiveLocks();
    
    // Step 2: Expire old locks
    const expiredCount = await expireOldLocks();
    
    // Step 3: Check again
    if (expiredCount > 0) {
      console.log('\n📊 Updated lock status:');
      await checkActiveLocks();
    }
    
    // Ask if user wants to force release all active locks
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('\n❓ Do you want to FORCE RELEASE all remaining ACTIVE locks? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        await releaseAllActiveLocks();
        console.log('\n📊 Final lock status:');
        await checkActiveLocks();
      } else {
        console.log('\n✅ Skipped force release. Active locks remain unchanged.');
      }
      
      readline.close();
      await pool.end();
      console.log('\n✅ Done!');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

main();
