/**
 * Script to create the payments table directly using PostgreSQL
 * Run this if the table doesn't exist: node backend/scripts/create-payments-table.js
 */
require('dotenv').config();
const pool = require('../config/pgPool');

async function createPaymentsTable() {
  let client;
  
  try {
    console.log('🔄 Connecting to database...');
    client = await pool.connect();
    
    console.log('📋 Creating payments table...');
    
    // Create payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        schedule_id UUID NOT NULL,
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('mobile_money', 'airtel_money', 'card_payment')),
        phone_or_card VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
        transaction_ref VARCHAR(255) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create indexes
    console.log('📋 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_schedule_id ON payments(schedule_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_payments_transaction_ref ON payments(transaction_ref);
    `);
    
    // Add foreign key constraints if tables exist
    try {
      // Check if constraint already exists before adding
      const checkUserFK = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'payments' 
        AND constraint_name = 'fk_payments_user_id'
      `);
      
      if (checkUserFK.rows.length === 0) {
        await client.query(`
          ALTER TABLE payments
          ADD CONSTRAINT fk_payments_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        `);
      }
      
      const checkScheduleFK = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'payments' 
        AND constraint_name = 'fk_payments_schedule_id'
      `);
      
      if (checkScheduleFK.rows.length === 0) {
        await client.query(`
          ALTER TABLE payments
          ADD CONSTRAINT fk_payments_schedule_id
          FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
        `);
      }
      
      console.log('✅ Foreign key constraints added');
    } catch (error) {
      console.log('⚠️  Could not add foreign key constraints (tables may not exist yet):', error.message);
    }
    
    // Update tickets table to add payment_id if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE tickets
        ADD COLUMN IF NOT EXISTS payment_id UUID;
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tickets_payment_id ON tickets(payment_id);
      `);
      
      // Check if constraint already exists before adding
      const checkTicketFK = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'tickets' 
        AND constraint_name = 'fk_tickets_payment_id'
      `);
      
      if (checkTicketFK.rows.length === 0) {
        await client.query(`
          ALTER TABLE tickets
          ADD CONSTRAINT fk_tickets_payment_id
          FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
        `);
      }
      
      console.log('✅ Updated tickets table with payment_id');
    } catch (error) {
      console.log('⚠️  Could not update tickets table:', error.message);
    }
    
    client.release();
    
    console.log('\n✅ Payments table created successfully!');
    console.log('📊 Table structure:');
    console.log('   - id (UUID, Primary Key)');
    console.log('   - user_id (UUID, Foreign Key to users)');
    console.log('   - schedule_id (UUID, Foreign Key to schedules)');
    console.log('   - payment_method (ENUM: mobile_money, airtel_money, card_payment)');
    console.log('   - phone_or_card (VARCHAR)');
    console.log('   - amount (DECIMAL)');
    console.log('   - status (ENUM: PENDING, SUCCESS, FAILED)');
    console.log('   - transaction_ref (VARCHAR, Unique)');
    console.log('   - created_at, updated_at (Timestamps)');
    
    process.exit(0);
  } catch (error) {
    if (client) client.release();
    console.error('❌ Error creating payments table:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

createPaymentsTable();

