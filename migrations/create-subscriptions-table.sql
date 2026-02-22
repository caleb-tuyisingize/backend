-- =====================================================
-- SafariTix Subscription System Database Schema
-- =====================================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS `subscription_history`;
DROP TABLE IF EXISTS `subscriptions`;
DROP TABLE IF EXISTS `subscription_plans`;

-- =====================================================
-- Table: subscription_plans
-- Stores the available subscription plan definitions
-- =====================================================
CREATE TABLE `subscription_plans` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` ENUM('Starter', 'Growth', 'Enterprise') NOT NULL UNIQUE,
  `price` DECIMAL(10, 2) NOT NULL COMMENT 'Monthly price in RWF',
  `max_buses` INT NULL COMMENT 'NULL means unlimited',
  `features` JSON NOT NULL COMMENT 'List of features available in this plan',
  `trial_days` INT DEFAULT 14 COMMENT 'Number of trial days for new users',
  `grace_period_days` INT DEFAULT 7 COMMENT 'Days after expiry before full suspension',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: subscriptions
-- Stores user subscription information
-- =====================================================
CREATE TABLE `subscriptions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `plan_name` ENUM('Starter', 'Growth', 'Enterprise') NOT NULL,
  `status` ENUM(
    'TRIAL_ACTIVE',      -- Trial is active
    'TRIAL_EXPIRING',    -- Trial expires in 3 days or less
    'TRIAL_EXPIRED',     -- Trial has ended, needs payment
    'ACTIVE',            -- Paid subscription is active
    'GRACE_PERIOD',      -- Subscription expired, in 7-day grace period
    'EXPIRED'            -- Subscription fully expired
  ) NOT NULL DEFAULT 'TRIAL_ACTIVE',
  `is_trial` BOOLEAN DEFAULT TRUE COMMENT 'Is this subscription a trial?',
  `trial_start_date` DATETIME NULL COMMENT 'When trial started',
  `trial_end_date` DATETIME NULL COMMENT 'When trial ends',
  `start_date` DATETIME NOT NULL COMMENT 'Current subscription period start',
  `end_date` DATETIME NOT NULL COMMENT 'Current subscription period end',
  `next_billing_date` DATETIME NULL COMMENT 'Next automatic billing date',
  `auto_renew` BOOLEAN DEFAULT FALSE COMMENT 'Auto-renew subscription?',
  `payment_method` VARCHAR(50) NULL COMMENT 'M-PESA, Card, etc',
  `last_payment_date` DATETIME NULL COMMENT 'Last successful payment',
  `last_payment_amount` DECIMAL(10, 2) NULL COMMENT 'Amount of last payment',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraint
  CONSTRAINT `fk_subscription_user` 
    FOREIGN KEY (`user_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  -- Ensure one active subscription per user
  UNIQUE KEY `unique_user_subscription` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: subscription_history
-- Tracks all subscription changes for audit trail
-- =====================================================
CREATE TABLE `subscription_history` (
  `id` VARCHAR(36) PRIMARY KEY,
  `subscription_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `plan_name` ENUM('Starter', 'Growth', 'Enterprise') NOT NULL,
  `action` ENUM(
    'CREATED',
    'UPGRADED',
    'DOWNGRADED',
    'RENEWED',
    'CANCELLED',
    'EXPIRED',
    'STATUS_CHANGED'
  ) NOT NULL,
  `old_status` VARCHAR(50) NULL,
  `new_status` VARCHAR(50) NULL,
  `old_plan` VARCHAR(50) NULL,
  `new_plan` VARCHAR(50) NULL,
  `amount` DECIMAL(10, 2) NULL COMMENT 'Payment amount if applicable',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraints
  CONSTRAINT `fk_history_subscription` 
    FOREIGN KEY (`subscription_id`) 
    REFERENCES `subscriptions`(`id`) 
    ON DELETE CASCADE,
  
  CONSTRAINT `fk_history_user` 
    FOREIGN KEY (`user_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  -- Index for faster queries
  INDEX `idx_user_history` (`user_id`, `created_at`),
  INDEX `idx_subscription_history` (`subscription_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Insert Default Subscription Plans
-- =====================================================
INSERT INTO `subscription_plans` (`id`, `name`, `price`, `max_buses`, `features`, `trial_days`, `grace_period_days`) VALUES
(
  UUID(),
  'Starter',
  50000.00,
  5,
  JSON_ARRAY(
    'Company profile',
    'Up to 5 buses',
    'Create schedules',
    'Seat management',
    'Basic ticket sales',
    'Manual driver assignment',
    'Daily revenue summary'
  ),
  14,
  7
),
(
  UUID(),
  'Growth',
  150000.00,
  20,
  JSON_ARRAY(
    'Everything in Starter',
    'Up to 20 buses',
    'Real-time GPS tracking',
    'Ticket cancellation rules',
    'Advanced revenue analytics',
    'Driver accounts',
    'Route performance statistics',
    'Priority support'
  ),
  14,
  7
),
(
  UUID(),
  'Enterprise',
  250000.00,
  NULL,
  JSON_ARRAY(
    'Everything in Growth',
    'Unlimited buses',
    'Multiple admin accounts',
    'Custom reports',
    'API access',
    'Dedicated support',
    'SLA uptime guarantee',
    'Custom integrations'
  ),
  14,
  7
);

-- =====================================================
-- Add subscription_status column to users table
-- (if it doesn't already exist)
-- =====================================================
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `subscription_status` VARCHAR(50) DEFAULT 'TRIAL_ACTIVE',
ADD COLUMN IF NOT EXISTS `subscription_plan` VARCHAR(50) DEFAULT 'Starter';

-- =====================================================
-- Create indexes for better performance
-- =====================================================
CREATE INDEX `idx_subscription_status` ON `subscriptions`(`status`);
CREATE INDEX `idx_subscription_end_date` ON `subscriptions`(`end_date`);
CREATE INDEX `idx_subscription_user_plan` ON `subscriptions`(`user_id`, `plan_name`);

-- =====================================================
-- Create stored procedure to update subscription status
-- =====================================================
DELIMITER $$

CREATE PROCEDURE `update_subscription_status`(IN p_user_id VARCHAR(36))
BEGIN
    DECLARE v_status VARCHAR(50);
    DECLARE v_end_date DATETIME;
    DECLARE v_is_trial BOOLEAN;
    DECLARE v_grace_end DATETIME;
    DECLARE v_now DATETIME;
    DECLARE v_days_until_expiry INT;
    
    SET v_now = NOW();
    
    -- Get subscription details
    SELECT status, end_date, is_trial
    INTO v_status, v_end_date, v_is_trial
    FROM subscriptions
    WHERE user_id = p_user_id;
    
    -- Calculate days until expiry
    SET v_days_until_expiry = DATEDIFF(v_end_date, v_now);
    
    -- Calculate grace period end date (7 days after end_date)
    SET v_grace_end = DATE_ADD(v_end_date, INTERVAL 7 DAY);
    
    -- Update status based on conditions
    IF v_is_trial = TRUE THEN
        -- Trial logic
        IF v_now < v_end_date THEN
            -- Trial is active
            IF v_days_until_expiry <= 3 THEN
                SET v_status = 'TRIAL_EXPIRING';
            ELSE
                SET v_status = 'TRIAL_ACTIVE';
            END IF;
        ELSE
            -- Trial has ended
            SET v_status = 'TRIAL_EXPIRED';
        END IF;
    ELSE
        -- Paid subscription logic
        IF v_now < v_end_date THEN
            SET v_status = 'ACTIVE';
        ELSEIF v_now < v_grace_end THEN
            SET v_status = 'GRACE_PERIOD';
        ELSE
            SET v_status = 'EXPIRED';
        END IF;
    END IF;
    
    -- Update the subscription
    UPDATE subscriptions
    SET status = v_status,
        updated_at = v_now
    WHERE user_id = p_user_id;
    
    -- Update user table for easy access
    UPDATE users
    SET subscription_status = v_status
    WHERE id = p_user_id;
    
END$$

DELIMITER ;

-- =====================================================
-- Create trigger to log subscription changes
-- =====================================================
DELIMITER $$

CREATE TRIGGER `after_subscription_update`
AFTER UPDATE ON `subscriptions`
FOR EACH ROW
BEGIN
    -- Only log if status or plan changed
    IF OLD.status != NEW.status OR OLD.plan_name != NEW.plan_name THEN
        INSERT INTO subscription_history (
            id,
            subscription_id,
            user_id,
            plan_name,
            action,
            old_status,
            new_status,
            old_plan,
            new_plan,
            created_at
        ) VALUES (
            UUID(),
            NEW.id,
            NEW.user_id,
            NEW.plan_name,
            'STATUS_CHANGED',
            OLD.status,
            NEW.status,
            OLD.plan_name,
            NEW.plan_name,
            NOW()
        );
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- End of Schema Definition
-- =====================================================
