const sequelize = require('../config/database');

const run = async () => {
  console.log('Running safe migrations against existing Postgres DB');

  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Create seats table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS seats (
        id uuid PRIMARY KEY,
        bus_id uuid NOT NULL,
        company_id uuid NOT NULL,
        seat_number varchar NOT NULL,
        row integer,
        col integer,
        side varchar(4),
        is_window boolean DEFAULT false,
        meta jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    console.log('Ensured seats table');

    // Ensure unique index on seats(bus_id, seat_number)
    await sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE c.relkind = 'i' AND c.relname = 'seats_bus_id_seat_number_idx'
        ) THEN
          CREATE UNIQUE INDEX seats_bus_id_seat_number_idx ON seats (bus_id, seat_number);
        END IF;
      END$$;
    `);

    // Create seat_locks table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS seat_locks (
        id uuid PRIMARY KEY,
        schedule_id uuid NOT NULL,
        company_id uuid NOT NULL,
        seat_number varchar NOT NULL,
        passenger_id uuid NOT NULL,
        ticket_id uuid,
        expires_at timestamptz NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'ACTIVE',
        meta jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    console.log('Ensured seat_locks table');

    // Ensure partial unique index to prevent multiple ACTIVE locks per schedule+seat
    await sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'seat_locks_one_active_per_seat'
        ) THEN
          CREATE UNIQUE INDEX seat_locks_one_active_per_seat ON seat_locks (schedule_id, seat_number) WHERE status = 'ACTIVE';
        END IF;
      END$$;
    `);
    console.log('Ensured partial unique index on seat_locks');

    // Add lock_id column to tickets if missing
    await sequelize.query(`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS lock_id uuid;
    `);
    console.log('Ensured tickets.lock_id column');

    // Safely add enum values to tickets.status enum if they don't already exist
    // Fetch the enum type name for tickets.status and add missing labels
    await sequelize.query(`
      DO $$
      DECLARE
        type_name text;
        labels text[] := ARRAY['PENDING_PAYMENT','CONFIRMED','CANCELLED','EXPIRED','CHECKED_IN'];
        lbl text;
      BEGIN
        SELECT udt_name INTO type_name FROM information_schema.columns WHERE table_name='tickets' AND column_name='status' LIMIT 1;
        IF type_name IS NULL THEN
          RAISE NOTICE 'tickets.status column not found - skipping enum migration';
        ELSE
          FOREACH lbl IN ARRAY labels LOOP
            IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = type_name AND e.enumlabel = lbl) THEN
              EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, lbl);
            END IF;
          END LOOP;
        END IF;
      END$$;
    `);
    console.log('Ensured ticket status enum labels');

    console.log('Safe migration completed');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err.message || err);
    process.exit(1);
  }
};

run();
