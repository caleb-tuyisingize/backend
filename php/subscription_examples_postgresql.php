<?php
/**
 * =====================================================
 * SafariTix Subscription Integration Examples - PostgreSQL
 * =====================================================
 * 
 * This file demonstrates how to integrate the subscription system
 * into your existing SafariTix backend using PostgreSQL
 * 
 * Examples included:
 * 1. User Signup - Auto trial creation
 * 2. User Login - Status check and notifications
 * 3. Feature Gating - Middleware for protected features
 * 4. Adding Buses - Bus limit enforcement
 * 5. Subscription Upgrade - Payment and plan change
 * 6. Daily Status Update - Cron job integration
 */

require_once __DIR__ . '/SubscriptionManagerPostgreSQL.php';
require_once __DIR__ . '/../config/pgPool.php';  // PostgreSQL connection

// Initialize subscription manager with PostgreSQL connection
global $pgPool;
$subscriptionManager = new SubscriptionManager($pgPool);

// =====================================================
// Example 1: User Signup - Create Trial Subscription
// =====================================================
/**
 * Call this immediately after creating a new user account
 * Regular users get 14-day Starter trial
 * mugisha@gmail.com gets Enterprise ACTIVE for 30 days
 */
function handleUserSignup($userData) {
    global $pgPool, $subscriptionManager;
    
    try {
        // Begin transaction for atomic user + subscription creation
        $pgPool->beginTransaction();
        
        // Step 1: Create user account in users table
        $sql = "INSERT INTO users (id, email, password, name, role, created_at, updated_at)
                VALUES (:id, :email, :password, :name, :role, NOW(), NOW())
                RETURNING id, email";
        
        $stmt = $pgPool->prepare($sql);
        $userId = uniqid('user_', true);  // Generate unique user ID
        
        $stmt->execute([
            'id' => $userId,
            'email' => $userData['email'],
            'password' => password_hash($userData['password'], PASSWORD_BCRYPT),
            'name' => $userData['name'],
            'role' => 'company_admin'  // Default role for new signups
        ]);
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Step 2: Create trial subscription (or Enterprise for test user)
        $result = $subscriptionManager->createTrialForNewUser($user['id'], $user['email']);
        
        if (!$result['success']) {
            // Rollback if subscription creation fails
            $pgPool->rollBack();
            
            return [
                'success' => false,
                'error' => 'Failed to create subscription: ' . $result['error']
            ];
        }
        
        // Commit transaction - both user and subscription created successfully
        $pgPool->commit();
        
        return [
            'success' => true,
            'user' => $user,
            'subscription' => $result['subscription'],
            'message' => $result['message']
        ];
        
    } catch (Exception $e) {
        // Rollback on any error
        if ($pgPool->inTransaction()) {
            $pgPool->rollBack();
        }
        
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

// =====================================================
// Example 2: User Login - Check Subscription Status
// =====================================================
/**
 * Call this on every user login to check subscription status
 * Returns notifications if subscription status changed
 */
function handleUserLogin($email, $password) {
    global $pgPool, $subscriptionManager;
    
    try {
        // Step 1: Authenticate user
        $sql = "SELECT id, email, password, name, role FROM users WHERE email = :email";
        $stmt = $pgPool->prepare($sql);
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user || !password_verify($password, $user['password'])) {
            return [
                'success' => false,
                'error' => 'Invalid credentials'
            ];
        }
        
        // Step 2: Check and update subscription status
        $subscriptionCheck = $subscriptionManager->checkAndUpdateSubscription($user['id']);
        
        if (!$subscriptionCheck['success']) {
            return [
                'success' => false,
                'error' => 'Subscription check failed: ' . $subscriptionCheck['error']
            ];
        }
        
        // Step 3: Generate JWT token (your existing auth logic)
        $token = generateJWT($user);  // Your JWT generation function
        
        // Step 4: Generate notifications based on subscription status
        $notifications = generateSubscriptionNotifications($subscriptionCheck);
        
        return [
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'name' => $user['name'],
                'role' => $user['role']
            ],
            'subscription' => $subscriptionCheck['subscription'],
            'notifications' => $notifications,
            'status_changed' => $subscriptionCheck['status_changed']
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Generate user-friendly notifications based on subscription status
 */
function generateSubscriptionNotifications($subscriptionCheck) {
    $notifications = [];
    $status = $subscriptionCheck['subscription']['status'];
    $statusChanged = $subscriptionCheck['status_changed'];
    $subscription = $subscriptionCheck['subscription'];
    
    // Status-specific notifications
    switch ($status) {
        case 'TRIAL_EXPIRING':
            // Trial expires in 3 days or less
            $daysLeft = ceil((strtotime($subscription['trial_end_date']) - time()) / 86400);
            $notifications[] = [
                'type' => 'warning',
                'title' => 'Trial Expiring Soon',
                'message' => "Your trial ends in {$daysLeft} day(s). Upgrade now to continue using SafariTix.",
                'action' => 'Upgrade Now',
                'action_url' => '/subscription/upgrade'
            ];
            break;
            
        case 'TRIAL_EXPIRED':
            // Trial has ended
            $notifications[] = [
                'type' => 'error',
                'title' => 'Trial Expired',
                'message' => 'Your trial has ended. Please upgrade to a paid plan to continue.',
                'action' => 'Upgrade Now',
                'action_url' => '/subscription/upgrade',
                'blocking' => true  // Blocks access to most features
            ];
            break;
            
        case 'GRACE_PERIOD':
            // In 7-day grace period after subscription expiry
            $daysLeft = ceil((strtotime($subscription['end_date']) + (7 * 86400) - time()) / 86400);
            $notifications[] = [
                'type' => 'error',
                'title' => 'Subscription Expired - Grace Period',
                'message' => "Your subscription expired. You have {$daysLeft} day(s) of limited access remaining.",
                'action' => 'Renew Now',
                'action_url' => '/subscription/renew',
                'blocking' => false  // Limited access to basic features
            ];
            break;
            
        case 'EXPIRED':
            // Fully expired, no access
            $notifications[] = [
                'type' => 'error',
                'title' => 'Subscription Expired',
                'message' => 'Your subscription has expired. Renew now to restore access.',
                'action' => 'Renew Now',
                'action_url' => '/subscription/renew',
                'blocking' => true  // Blocks all access
            ];
            break;
            
        case 'TRIAL_ACTIVE':
            // Trial active - show remaining days
            if ($statusChanged) {
                $daysLeft = ceil((strtotime($subscription['trial_end_date']) - time()) / 86400);
                $notifications[] = [
                    'type' => 'info',
                    'title' => 'Trial Active',
                    'message' => "You have {$daysLeft} days left in your trial. Explore all features!",
                    'action' => 'View Plans',
                    'action_url' => '/subscription/plans'
                ];
            }
            break;
            
        case 'ACTIVE':
            // Paid subscription active - show next billing date
            if ($statusChanged) {
                $nextBilling = date('M d, Y', strtotime($subscription['next_billing_date']));
                $notifications[] = [
                    'type' => 'success',
                    'title' => 'Subscription Active',
                    'message' => "Your {$subscription['plan_name']} plan is active. Next billing: {$nextBilling}",
                    'action' => 'Manage Subscription',
                    'action_url' => '/subscription/manage'
                ];
            }
            break;
    }
    
    return $notifications;
}

// =====================================================
// Example 3: Feature Gating Middleware
// =====================================================
/**
 * Use this middleware to protect premium features
 * Returns 403 if user doesn't have access to the feature
 */
function checkFeatureAccess($userId, $feature) {
    global $subscriptionManager;
    
    // Check if user can access the feature
    $access = $subscriptionManager->canAccessFeature($userId, $feature);
    
    if (!$access['allowed']) {
        // User doesn't have access - return 403 error
        http_response_code(403);
        header('Content-Type: application/json');
        
        echo json_encode([
            'error' => 'Feature not available',
            'message' => $access['reason'],
            'upgrade_required' => $access['upgrade_required'] ?? null,
            'requires_payment' => $access['requires_payment'] ?? false,
            'current_plan' => $access['current_plan'] ?? null
        ]);
        
        exit;
    }
    
    // Access granted - continue
    return true;
}

/**
 * Example: Protect GPS tracking endpoint
 */
function getGPSTrackingData($userId, $busId) {
    // Check if user has access to GPS tracking
    checkFeatureAccess($userId, 'gps_tracking');
    
    // User has access - proceed with GPS tracking logic
    // ... your GPS tracking code here ...
    
    return [
        'success' => true,
        'gps_data' => [/* GPS data */]
    ];
}

/**
 * Example: Protect API access endpoint
 */
function handleAPIRequest($userId, $apiKey) {
    // Check if user has API access
    checkFeatureAccess($userId, 'api_access');
    
    // User has access - proceed with API logic
    // ... your API handling code here ...
    
    return [
        'success' => true,
        'data' => [/* API response */]
    ];
}

// =====================================================
// Example 4: Bus Limit Enforcement
// =====================================================
/**
 * Check bus limit before adding a new bus
 */
function addNewBus($userId, $busData) {
    global $pgPool, $subscriptionManager;
    
    try {
        // Step 1: Count user's current buses
        $sql = "SELECT COUNT(*) as bus_count FROM buses WHERE company_id = :user_id";
        $stmt = $pgPool->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $currentBusCount = $result['bus_count'];
        
        // Step 2: Check if user can add another bus
        $canAdd = $subscriptionManager->canAddBus($userId, $currentBusCount);
        
        if (!$canAdd['allowed']) {
            // User has reached bus limit
            return [
                'success' => false,
                'error' => $canAdd['reason'],
                'upgrade_required' => $canAdd['upgrade_required'] ?? null,
                'current_limit' => $canAdd['limit'],
                'current_count' => $canAdd['current']
            ];
        }
        
        // Step 3: User can add bus - proceed with creation
        $sql = "INSERT INTO buses (id, company_id, registration_number, model, capacity)
                VALUES (:id, :company_id, :registration_number, :model, :capacity)
                RETURNING id";
        
        $stmt = $pgPool->prepare($sql);
        $busId = uniqid('bus_', true);
        
        $stmt->execute([
            'id' => $busId,
            'company_id' => $userId,
            'registration_number' => $busData['registration_number'],
            'model' => $busData['model'],
            'capacity' => $busData['capacity']
        ]);
        
        return [
            'success' => true,
            'bus_id' => $busId,
            'message' => 'Bus added successfully',
            'remaining_slots' => $canAdd['remaining'] ?? null
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

// =====================================================
// Example 5: Upgrade Subscription
// =====================================================
/**
 * Handle subscription upgrade with M-PESA payment
 */
function upgradeSubscription($userId, $newPlan, $mpesaTransactionId) {
    global $subscriptionManager;
    
    try {
        // Step 1: Verify M-PESA payment (your M-PESA integration)
        $paymentVerification = verifyMpesaPayment($mpesaTransactionId);
        
        if (!$paymentVerification['success']) {
            return [
                'success' => false,
                'error' => 'Payment verification failed'
            ];
        }
        
        $paymentAmount = $paymentVerification['amount'];
        
        // Step 2: Upgrade subscription
        $result = $subscriptionManager->upgradePlan(
            $userId,
            $newPlan,
            $paymentAmount,
            'M-PESA'
        );
        
        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error']
            ];
        }
        
        // Step 3: Send confirmation email/SMS
        sendUpgradeConfirmation($userId, $result);
        
        return [
            'success' => true,
            'message' => $result['message'],
            'new_plan' => $result['new_plan'],
            'action' => $result['action']
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

// Placeholder for M-PESA verification (implement with actual M-PESA API)
function verifyMpesaPayment($transactionId) {
    // ... M-PESA API integration ...
    return [
        'success' => true,
        'amount' => 150000.00,
        'transaction_id' => $transactionId
    ];
}

// Placeholder for confirmation notification
function sendUpgradeConfirmation($userId, $upgradeResult) {
    // ... Send email/SMS ...
}

// =====================================================
// Example 6: Daily Subscription Update
// =====================================================
/**
 * Run this via cron job daily to update all subscription statuses
 * Cron schedule: 0 0 * * * (midnight daily)
 */
function dailySubscriptionUpdate() {
    global $pgPool, $subscriptionManager;
    
    try {
        // Fetch all users with non-EXPIRED subscriptions
        $sql = "SELECT u.id, u.email, s.status::TEXT as status
                FROM users u
                JOIN subscriptions s ON u.id = s.user_id
                WHERE s.status != 'EXPIRED'::subscription_status";
        
        $stmt = $pgPool->query($sql);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $stats = [
            'total' => count($users),
            'updated' => 0,
            'unchanged' => 0,
            'errors' => 0
        ];
        
        foreach ($users as $user) {
            try {
                // Check and update subscription status
                $result = $subscriptionManager->checkAndUpdateSubscription($user['id']);
                
                if ($result['success']) {
                    if ($result['status_changed']) {
                        $stats['updated']++;
                        
                        // Send notifications for status changes
                        $oldStatus = $result['old_status'];
                        $newStatus = $result['new_status'];
                        
                        // Trial expiring notification
                        if ($newStatus === 'TRIAL_EXPIRING') {
                            sendTrialExpiringNotification($user['id'], $user['email']);
                        }
                        
                        // Trial expired notification
                        if ($newStatus === 'TRIAL_EXPIRED') {
                            sendTrialExpiredNotification($user['id'], $user['email']);
                        }
                        
                        // Grace period notification
                        if ($newStatus === 'GRACE_PERIOD') {
                            sendGracePeriodNotification($user['id'], $user['email']);
                        }
                        
                        // Subscription expired notification
                        if ($newStatus === 'EXPIRED') {
                            sendSubscriptionExpiredNotification($user['id'], $user['email']);
                        }
                    } else {
                        $stats['unchanged']++;
                    }
                } else {
                    $stats['errors']++;
                }
                
            } catch (Exception $e) {
                $stats['errors']++;
                // Log error
                error_log("Subscription update failed for user {$user['id']}: {$e->getMessage()}");
            }
        }
        
        // Log summary
        error_log("Daily subscription update completed: " . json_encode($stats));
        
        return $stats;
        
    } catch (Exception $e) {
        error_log("Daily subscription update failed: {$e->getMessage()}");
        return null;
    }
}

// Notification functions (implement with actual email/SMS service)
function sendTrialExpiringNotification($userId, $email) {
    // ... Send email/SMS ...
}

function sendTrialExpiredNotification($userId, $email) {
    // ... Send email/SMS ...
}

function sendGracePeriodNotification($userId, $email) {
    // ... Send email/SMS ...
}

function sendSubscriptionExpiredNotification($userId, $email) {
    // ... Send email/SMS ...
}

// =====================================================
// API Endpoints (Express-style routing examples)
// =====================================================

/**
 * POST /api/auth/signup
 * Create new user account with trial subscription
 */
function apiSignup() {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $result = handleUserSignup([
        'email' => $data['email'],
        'password' => $data['password'],
        'name' => $data['name']
    ]);
    
    http_response_code($result['success'] ? 201 : 400);
    header('Content-Type: application/json');
    echo json_encode($result);
}

/**
 * POST /api/auth/login
 * Authenticate user and check subscription
 */
function apiLogin() {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $result = handleUserLogin($data['email'], $data['password']);
    
    http_response_code($result['success'] ? 200 : 401);
    header('Content-Type: application/json');
    echo json_encode($result);
}

/**
 * GET /api/subscription
 * Get current user's subscription details
 */
function apiGetSubscription($userId) {
    global $subscriptionManager;
    
    $subscription = $subscriptionManager->getSubscription($userId);
    
    if (!$subscription) {
        http_response_code(404);
        echo json_encode(['error' => 'Subscription not found']);
        return;
    }
    
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode(['subscription' => $subscription]);
}

/**
 * POST /api/subscription/upgrade
 * Upgrade subscription plan
 */
function apiUpgradeSubscription($userId) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $result = upgradeSubscription(
        $userId,
        $data['plan'],
        $data['mpesa_transaction_id']
    );
    
    http_response_code($result['success'] ? 200 : 400);
    header('Content-Type: application/json');
    echo json_encode($result);
}

/**
 * GET /api/subscription/plans
 * Get all available subscription plans
 */
function apiGetPlans() {
    global $subscriptionManager;
    
    $plans = $subscriptionManager->getAllPlans();
    
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode(['plans' => $plans]);
}

?>
