<?php
/**
 * =====================================================
 * Daily Subscription Status Update Cron Job
 * =====================================================
 * 
 * Run this script daily via cron to automatically update
 * all subscription statuses based on their dates.
 * 
 * Cron schedule: 0 0 * * * (Midnight every day)
 * 
 * Command:
 * 0 0 * * * php /path/to/safaritix/backend/php/daily_subscription_update.php >> /var/log/subscription_updates.log 2>&1
 */

// Set execution time limit (for large datasets)
set_time_limit(300); // 5 minutes

// Load dependencies
require_once __DIR__ . '/SubscriptionManager.php';
require_once __DIR__ . '/../config/database.php';

// Start logging
$startTime = microtime(true);
echo "\n========================================\n";
echo "SafariTix Subscription Update\n";
echo "Started: " . date('Y-m-d H:i:s') . "\n";
echo "========================================\n\n";

try {
    // Get database connection
    global $db;
    
    if (!$db) {
        throw new Exception('Database connection not available');
    }
    
    // Get all users with subscriptions
    $sql = "SELECT DISTINCT s.user_id, u.email, u.name, s.status as current_status
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE s.status NOT IN ('EXPIRED')
            ORDER BY s.end_date ASC";
    
    $stmt = $db->query($sql);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($users) . " active subscriptions to check\n\n";
    
    // Initialize counters
    $stats = [
        'total' => count($users),
        'updated' => 0,
        'unchanged' => 0,
        'errors' => 0,
        'trial_expired' => 0,
        'entered_grace_period' => 0,
        'fully_expired' => 0,
        'trial_expiring_soon' => 0
    ];
    
    // Initialize subscription manager
    $subscriptionManager = new SubscriptionManager($db);
    
    // Process each user
    foreach ($users as $user) {
        try {
            // Check and update subscription
            $result = $subscriptionManager->checkAndUpdateSubscription($user['user_id']);
            
            if ($result['success']) {
                if ($result['status_changed']) {
                    // Status changed - log it
                    echo "✓ Updated: {$user['email']}\n";
                    echo "  From: {$result['old_status']}\n";
                    echo "  To:   {$result['new_status']}\n\n";
                    
                    $stats['updated']++;
                    
                    // Track specific status changes
                    switch ($result['new_status']) {
                        case 'TRIAL_EXPIRED':
                            $stats['trial_expired']++;
                            sendTrialExpiredNotification($user);
                            break;
                        case 'TRIAL_EXPIRING':
                            $stats['trial_expiring_soon']++;
                            sendTrialExpiringNotification($user);
                            break;
                        case 'GRACE_PERIOD':
                            $stats['entered_grace_period']++;
                            sendGracePeriodNotification($user);
                            break;
                        case 'EXPIRED':
                            $stats['fully_expired']++;
                            sendSubscriptionExpiredNotification($user);
                            break;
                    }
                } else {
                    // No change
                    $stats['unchanged']++;
                }
            } else {
                // Error occurred
                echo "✗ Error: {$user['email']}\n";
                echo "  Message: {$result['error']}\n\n";
                $stats['errors']++;
            }
            
        } catch (Exception $e) {
            echo "✗ Exception for {$user['email']}: {$e->getMessage()}\n\n";
            $stats['errors']++;
        }
        
        // Small delay to prevent database overload
        usleep(10000); // 0.01 seconds
    }
    
    // Print summary
    $endTime = microtime(true);
    $duration = round($endTime - $startTime, 2);
    
    echo "\n========================================\n";
    echo "Update Summary\n";
    echo "========================================\n";
    echo "Total subscriptions checked: {$stats['total']}\n";
    echo "Updated: {$stats['updated']}\n";
    echo "Unchanged: {$stats['unchanged']}\n";
    echo "Errors: {$stats['errors']}\n";
    echo "\nStatus Changes:\n";
    echo "  - Trials expired: {$stats['trial_expired']}\n";
    echo "  - Trials expiring soon: {$stats['trial_expiring_soon']}\n";
    echo "  - Entered grace period: {$stats['entered_grace_period']}\n";
    echo "  - Fully expired: {$stats['fully_expired']}\n";
    echo "\nExecution time: {$duration} seconds\n";
    echo "Completed: " . date('Y-m-d H:i:s') . "\n";
    echo "========================================\n\n";
    
    // Log to database
    logCronExecution($db, 'subscription_update', $stats, $duration);
    
} catch (Exception $e) {
    echo "\n✗✗✗ FATAL ERROR ✗✗✗\n";
    echo "Message: {$e->getMessage()}\n";
    echo "File: {$e->getFile()}\n";
    echo "Line: {$e->getLine()}\n\n";
    
    // Send alert to admins
    sendAdminAlert('Subscription Cron Job Failed', $e->getMessage());
    
    exit(1);
}

exit(0);

/**
 * =====================================================
 * NOTIFICATION FUNCTIONS
 * =====================================================
 */

/**
 * Send trial expiring notification
 */
function sendTrialExpiringNotification($user) {
    // Implement email/SMS notification
    // For now, just log it
    echo "  📧 Notification: Trial expiring soon for {$user['email']}\n";
    
    // TODO: Integrate with email service
    // sendEmail($user['email'], 'Your SafariTix trial is expiring soon', $message);
}

/**
 * Send trial expired notification
 */
function sendTrialExpiredNotification($user) {
    echo "  📧 Notification: Trial expired for {$user['email']}\n";
    
    // TODO: Send email with upgrade link
}

/**
 * Send grace period notification
 */
function sendGracePeriodNotification($user) {
    echo "  📧 Notification: Grace period started for {$user['email']}\n";
    
    // TODO: Send urgent renewal reminder
}

/**
 * Send subscription expired notification
 */
function sendSubscriptionExpiredNotification($user) {
    echo "  📧 Notification: Subscription expired for {$user['email']}\n";
    
    // TODO: Send reactivation email
}

/**
 * Send alert to admins
 */
function sendAdminAlert($subject, $message) {
    echo "  🚨 Admin alert: {$subject}\n";
    
    // TODO: Send email to admin team
}

/**
 * Log cron execution to database
 */
function logCronExecution($db, $jobName, $stats, $duration) {
    try {
        $sql = "INSERT INTO cron_logs (
            id, job_name, status, stats, duration_seconds, 
            executed_at, created_at
        ) VALUES (
            :id, :job_name, :status, :stats, :duration,
            NOW(), NOW()
        )";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'id' => generateUUID(),
            'job_name' => $jobName,
            'status' => $stats['errors'] > 0 ? 'completed_with_errors' : 'success',
            'stats' => json_encode($stats),
            'duration' => $duration
        ]);
        
    } catch (Exception $e) {
        // If logging fails, just echo the error
        echo "Warning: Could not log cron execution: {$e->getMessage()}\n";
    }
}

/**
 * Generate UUID
 */
function generateUUID() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff)
    );
}

?>
