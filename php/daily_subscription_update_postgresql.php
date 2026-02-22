<?php
/**
 * =====================================================
 * SafariTix Daily Subscription Update Cron Job - PostgreSQL
 * =====================================================
 * 
 * This script should run daily via cron to automatically update
 * all subscription statuses and send notifications
 * 
 * Cron Schedule: 0 0 * * * (midnight daily)
 * 
 * Setup:
 * 1. Make executable: chmod +x daily_subscription_update_postgresql.php
 * 2. Add to crontab: crontab -e
 * 3. Add line: 0 0 * * * /usr/bin/php /path/to/daily_subscription_update_postgresql.php
 * 
 * What it does:
 * - Checks all active subscriptions
 * - Updates statuses based on current date
 * - Sends notifications for status changes
 * - Logs execution summary
 */

require_once __DIR__ . '/SubscriptionManagerPostgreSQL.php';
require_once __DIR__ . '/../config/pgPool.php';  // PostgreSQL connection

// Start execution timer
$startTime = microtime(true);

echo "=====================================================\n";
echo "SafariTix Daily Subscription Update - PostgreSQL\n";
echo "Started: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

try {
    global $pgPool;
    
    // Initialize subscription manager
    $subscriptionManager = new SubscriptionManager($pgPool);
    
    // Fetch all users with active subscriptions (exclude fully EXPIRED)
    // We check EXPIRED ones too in case they need grace period transition
    $sql = "SELECT 
                u.id, 
                u.email, 
                u.name,
                s.status::TEXT as status,
                s.plan_name::TEXT as plan_name,
                s.is_trial,
                s.trial_end_date,
                s.end_date
            FROM users u
            INNER JOIN subscriptions s ON u.id = s.user_id
            ORDER BY u.email";
    
    $stmt = $pgPool->query($sql);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found {$users} users with subscriptions\n\n";
    
    // Initialize statistics counters
    $stats = [
        'total' => count($users),
        'updated' => 0,
        'unchanged' => 0,
        'errors' => 0,
        'trial_expiring_soon' => 0,
        'trial_expired' => 0,
        'entered_grace_period' => 0,
        'fully_expired' => 0
    ];
    
    // Process each user
    foreach ($users as $user) {
        try {
            $oldStatus = $user['status'];
            
            echo "Processing: {$user['email']} (Current: {$oldStatus})\n";
            
            // Check and update subscription status
            $result = $subscriptionManager->checkAndUpdateSubscription($user['id']);
            
            if (!$result['success']) {
                // Failed to update
                $stats['errors']++;
                echo "  ❌ Error: {$result['error']}\n\n";
                continue;
            }
            
            $newStatus = $result['new_status'];
            $statusChanged = $result['status_changed'];
            
            if ($statusChanged) {
                // Status changed - send appropriate notification
                $stats['updated']++;
                echo "  ✓ Status changed: {$oldStatus} → {$newStatus}\n";
                
                // Handle status-specific actions and notifications
                switch ($newStatus) {
                    case 'TRIAL_EXPIRING':
                        // Trial is expiring (3 days or less)
                        $stats['trial_expiring_soon']++;
                        sendTrialExpiringNotification($user, $result['subscription']);
                        echo "  📧 Sent trial expiring notification\n";
                        break;
                        
                    case 'TRIAL_EXPIRED':
                        // Trial has expired
                        $stats['trial_expired']++;
                        sendTrialExpiredNotification($user, $result['subscription']);
                        echo "  📧 Sent trial expired notification\n";
                        break;
                        
                    case 'GRACE_PERIOD':
                        // Entered grace period (7 days after expiry)
                        $stats['entered_grace_period']++;
                        sendGracePeriodNotification($user, $result['subscription']);
                        echo "  📧 Sent grace period notification\n";
                        break;
                        
                    case 'EXPIRED':
                        // Fully expired (grace period ended)
                        $stats['fully_expired']++;
                        sendSubscriptionExpiredNotification($user, $result['subscription']);
                        echo "  📧 Sent subscription expired notification\n";
                        
                        // Optionally disable user access or mark account as inactive
                        disableUserAccess($user['id']);
                        break;
                }
                
            } else {
                // Status unchanged
                $stats['unchanged']++;
                echo "  ⚪ No change\n";
            }
            
            echo "\n";
            
        } catch (Exception $e) {
            // Error processing this user
            $stats['errors']++;
            echo "  ❌ Exception: {$e->getMessage()}\n\n";
            
            // Log error to file
            error_log("Subscription update error for user {$user['id']}: {$e->getMessage()}");
        }
    }
    
    // Calculate execution time
    $endTime = microtime(true);
    $executionTime = round($endTime - $startTime, 2);
    
    // Print summary
    echo "=====================================================\n";
    echo "Update Summary\n";
    echo "=====================================================\n";
    echo "Total Users:              {$stats['total']}\n";
    echo "Statuses Updated:         {$stats['updated']}\n";
    echo "Unchanged:                {$stats['unchanged']}\n";
    echo "Errors:                   {$stats['errors']}\n";
    echo "-----------------------------------------------------\n";
    echo "Trials Expiring Soon:     {$stats['trial_expiring_soon']}\n";
    echo "Trials Expired:           {$stats['trial_expired']}\n";
    echo "Entered Grace Period:     {$stats['entered_grace_period']}\n";
    echo "Fully Expired:            {$stats['fully_expired']}\n";
    echo "-----------------------------------------------------\n";
    echo "Execution Time:           {$executionTime}s\n";
    echo "Completed:                " . date('Y-m-d H:i:s') . "\n";
    echo "=====================================================\n";
    
    // Log execution to database for monitoring
    logCronExecution($stats, $executionTime);
    
    // Send admin alert if there were errors
    if ($stats['errors'] > 0) {
        sendAdminAlert($stats);
    }
    
    exit(0);  // Success
    
} catch (Exception $e) {
    // Fatal error - couldn't complete cron job
    echo "\n❌❌❌ FATAL ERROR ❌❌❌\n";
    echo "Error: {$e->getMessage()}\n";
    echo "File: {$e->getFile()}\n";
    echo "Line: {$e->getLine()}\n\n";
    
    // Log fatal error
    error_log("FATAL: Daily subscription update failed: {$e->getMessage()}");
    
    // Send admin alert
    sendAdminAlert([
        'fatal_error' => true,
        'error_message' => $e->getMessage()
    ]);
    
    exit(1);  // Failure
}

// =====================================================
// Notification Functions
// =====================================================

/**
 * Send notification when trial is expiring (3 days or less)
 */
function sendTrialExpiringNotification($user, $subscription) {
    global $pgPool;
    
    $daysLeft = ceil((strtotime($subscription['trial_end_date']) - time()) / 86400);
    $planName = $subscription['plan_name'];
    
    $subject = "Your SafariTix Trial Expires in {$daysLeft} Day(s)";
    $message = "
        Hi {$user['name']},
        
        Your {$planName} trial expires in {$daysLeft} day(s).
        
        Upgrade now to continue enjoying all features:
        - Unlimited access to your current features
        - No service interruption
        - Priority support
        
        Upgrade here: https://safatitix.com/subscription/upgrade
        
        Questions? Contact support@safatitix.com
        
        Best regards,
        SafariTix Team
    ";
    
    // Send email
    sendEmail($user['email'], $subject, $message);
    
    // Send SMS
    sendSMS($user['phone'] ?? null, "SafariTix: Your trial expires in {$daysLeft} day(s). Upgrade at safatitix.com/upgrade");
    
    // Create in-app notification
    createInAppNotification($user['id'], 'trial_expiring', $subject, $message);
}

/**
 * Send notification when trial has expired
 */
function sendTrialExpiredNotification($user, $subscription) {
    $subject = "Your SafariTix Trial Has Ended";
    $message = "
        Hi {$user['name']},
        
        Your trial period has ended. To continue using SafariTix, please upgrade to a paid plan.
        
        Choose your plan:
        - Starter: RWF 50,000/month (5 buses)
        - Growth: RWF 150,000/month (20 buses + GPS)
        - Enterprise: RWF 250,000/month (unlimited)
        
        Upgrade here: https://safatitix.com/subscription/upgrade
        
        Your data is safe and will be available once you upgrade.
        
        Best regards,
        SafariTix Team
    ";
    
    sendEmail($user['email'], $subject, $message);
    sendSMS($user['phone'] ?? null, "SafariTix: Your trial has ended. Upgrade at safatitix.com/upgrade");
    createInAppNotification($user['id'], 'trial_expired', $subject, $message);
}

/**
 * Send notification when entering grace period
 */
function sendGracePeriodNotification($user, $subscription) {
    $endDate = date('M d, Y', strtotime($subscription['end_date']));
    
    $subject = "SafariTix Subscription Expired - 7 Day Grace Period";
    $message = "
        Hi {$user['name']},
        
        Your SafariTix subscription expired on {$endDate}.
        
        You now have 7 days of limited access to basic features.
        After the grace period, your account will be fully suspended.
        
        Renew now to restore full access:
        https://safatitix.com/subscription/renew
        
        Need help? Contact support@safatitix.com
        
        Best regards,
        SafariTix Team
    ";
    
    sendEmail($user['email'], $subject, $message);
    sendSMS($user['phone'] ?? null, "SafariTix: Your subscription expired. 7-day grace period active. Renew at safatitix.com/renew");
    createInAppNotification($user['id'], 'grace_period', $subject, $message);
}

/**
 * Send notification when subscription fully expires
 */
function sendSubscriptionExpiredNotification($user, $subscription) {
    $subject = "SafariTix Account Suspended - Immediate Action Required";
    $message = "
        Hi {$user['name']},
        
        Your SafariTix account has been suspended due to expired subscription.
        
        To restore access:
        1. Visit: https://safatitix.com/subscription/renew
        2. Choose a plan and complete payment
        3. Your access will be restored immediately
        
        Your data is safe and will be available once you renew.
        
        Questions? Contact support@safatitix.com or call +250 XXX XXX XXX
        
        Best regards,
        SafariTix Team
    ";
    
    sendEmail($user['email'], $subject, $message);
    sendSMS($user['phone'] ?? null, "SafariTix: Account suspended. Renew immediately at safatitix.com/renew");
    createInAppNotification($user['id'], 'subscription_expired', $subject, $message);
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Send email notification
 */
function sendEmail($to, $subject, $message) {
    // Implement with your email service (SendGrid, AWS SES, etc.)
    // For now, just use PHP's mail() function
    
    $headers = "From: SafariTix <noreply@safatitix.com>\r\n";
    $headers .= "Reply-To: support@safatitix.com\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    
    mail($to, $subject, $message, $headers);
}

/**
 * Send SMS notification
 */
function sendSMS($phone, $message) {
    if (!$phone) return;
    
    // Implement with your SMS service (Twilio, Africa's Talking, etc.)
    // Example: Africa's Talking API for Rwanda
    
    // $africastalking = new AfricasTalking($username, $apiKey);
    // $sms = $africastalking->sms();
    // $sms->send(['to' => $phone, 'message' => $message]);
}

/**
 * Create in-app notification
 */
function createInAppNotification($userId, $type, $title, $message) {
    global $pgPool;
    
    try {
        $sql = "INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
                VALUES (:id, :user_id, :type, :title, :message, FALSE, NOW())";
        
        $stmt = $pgPool->prepare($sql);
        $stmt->execute([
            'id' => uniqid('notif_', true),
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $message
        ]);
    } catch (Exception $e) {
        error_log("Failed to create notification: {$e->getMessage()}");
    }
}

/**
 * Disable user access for expired subscriptions
 */
function disableUserAccess($userId) {
    global $pgPool;
    
    try {
        // Mark user account as inactive
        $sql = "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = :user_id";
        $stmt = $pgPool->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        
        echo "  🔒 User access disabled\n";
    } catch (Exception $e) {
        error_log("Failed to disable user access: {$e->getMessage()}");
    }
}

/**
 * Log cron execution to database for monitoring
 */
function logCronExecution($stats, $executionTime) {
    global $pgPool;
    
    try {
        // Create cron_logs table if it doesn't exist
        $sql = "CREATE TABLE IF NOT EXISTS cron_logs (
                    id SERIAL PRIMARY KEY,
                    job_name VARCHAR(100) NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    stats JSONB,
                    execution_time NUMERIC(10, 2),
                    executed_at TIMESTAMP NOT NULL DEFAULT NOW()
                )";
        $pgPool->exec($sql);
        
        // Insert log entry
        $sql = "INSERT INTO cron_logs (job_name, status, stats, execution_time)
                VALUES (:job_name, :status, :stats, :execution_time)";
        
        $stmt = $pgPool->prepare($sql);
        $stmt->execute([
            'job_name' => 'daily_subscription_update',
            'status' => $stats['errors'] > 0 ? 'completed_with_errors' : 'success',
            'stats' => json_encode($stats),
            'execution_time' => $executionTime
        ]);
        
    } catch (Exception $e) {
        error_log("Failed to log cron execution: {$e->getMessage()}");
    }
}

/**
 * Send alert to admin about cron job issues
 */
function sendAdminAlert($stats) {
    $adminEmail = 'admin@safatitix.com';  // Change to your admin email
    
    if (isset($stats['fatal_error'])) {
        $subject = "URGENT: Subscription Cron Job Failed";
        $message = "The daily subscription update cron job encountered a fatal error:\n\n";
        $message .= "Error: {$stats['error_message']}\n\n";
        $message .= "Please investigate immediately.\n";
    } else {
        $subject = "Warning: Subscription Cron Job Completed with Errors";
        $message = "The daily subscription update cron job completed but encountered {$stats['errors']} error(s):\n\n";
        $message .= "Summary:\n";
        $message .= "Total Users: {$stats['total']}\n";
        $message .= "Updated: {$stats['updated']}\n";
        $message .= "Errors: {$stats['errors']}\n\n";
        $message .= "Check application logs for details.\n";
    }
    
    sendEmail($adminEmail, $subject, $message);
}

?>
