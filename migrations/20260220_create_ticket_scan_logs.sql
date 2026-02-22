-- Migration: Create ticket scan logs table for audit trail
-- Created: 2026-02-20
-- Purpose: Track all ticket scan attempts by drivers with timestamps

CREATE TABLE IF NOT EXISTS ticket_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    scan_status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    error_reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_ticket_id ON ticket_scan_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_driver_id ON ticket_scan_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_schedule_id ON ticket_scan_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_passenger_id ON ticket_scan_logs(passenger_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_scanned_at ON ticket_scan_logs(scanned_at);

-- Add comments
COMMENT ON TABLE ticket_scan_logs IS 'Audit trail for all ticket scan attempts';
COMMENT ON COLUMN ticket_scan_logs.scan_status IS 'SUCCESS, ALREADY_USED, CANCELLED, TRIP_NOT_ACTIVE, etc.';
COMMENT ON COLUMN ticket_scan_logs.error_reason IS 'Human-readable error message if scan failed';
