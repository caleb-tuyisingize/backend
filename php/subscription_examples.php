<?php
/**
 * =====================================================
 * SafariTix Subscription System - Usage Examples
 * =====================================================
 * 
 * This file demonstrates how to integrate the subscription
 * system into SafariTix authentication and feature access.
 */

require_once 'SubscriptionManager.php';
require_once 'database.php'; // Your database connection file

/**
 * =====================================================
 * EXAMPLE 1: USER SIGNUP WITH AUTOMATIC TRIAL
 * =====================================================
 */
function handleUserSignup($email, $password, $name, $companyName) {
    global $db; // Your PDO database connection
    
    try {
        $db->beginTransaction();
        
        // 1. Create user account (your existing user creation logic)
        $userId = createUserAccount($email, $password, $name, $companyName);
        
        // 2. Create subscription (automatic trial or Enterprise for test user)
        $subscriptionManager = new SubscriptionManager($db);
        $subscriptionResult = $subscriptionManager->createTrialForNewUser($userId, $email);
        
        if (!$subscriptionResult['success']) {
            throw new Exception('Failed to create subscription: ' . $subscriptionResult['error']);
        }
        
        $db->commit();
        
        // Return success response
        return [
            'success' => true,
            'user_id' => $userId,
            'email' => $email,
            'subscription' => $subscriptionResult['subscription'],
            'message' => $subscriptionResult['message']
        ];
        
    } catch (Exception $e) {
        $db->rollBack();
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Helper function to create user account
 * (Replace with your actual user creation logic)
 */
function createUserAccount($email, $password, $name, $companyName) {
    global $db;
    
    $userId = generateUUID();
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    
    $sql = "INSERT INTO users (
        id, email, password, name, company_name, 
        role, subscription_status, subscription_plan,
        created_at, updated_at
    ) VALUES (
        :id, :email, :password, :name, :company_name,
        'company_admin', 'TRIAL_ACTIVE', 'Starter',
        NOW(), NOW()
    )";
    
    $stmt = $db->prepare($sql);
    $stmt->execute([
        'id' => $userId,
        'email' => $email,
        'password' => $hashedPassword,
        'name' => $name,
        'company_name' => $companyName
    ]);
    
    return $userId;
}

/**
 * =====================================================
 * EXAMPLE 2: USER LOGIN WITH SUBSCRIPTION CHECK
 * =====================================================
 */
function handleUserLogin($email, $password) {
    global $db;
    
    try {
        // 1. Verify user credentials (your existing logic)
        $user = authenticateUser($email, $password);
        
        if (!$user) {
            return [
                'success' => false,
                'error' => 'Invalid credentials'
            ];
        }
        
        // 2. Check and update subscription status
        $subscriptionManager = new SubscriptionManager($db);
        $subscriptionCheck = $subscriptionManager->checkAndUpdateSubscription($user['id']);
        
        if (!$subscriptionCheck['success']) {
            return [
                'success' => false,
                'error' => 'Failed to check subscription: ' . $subscriptionCheck['error']
            ];
        }
        
        $subscription = $subscriptionCheck['subscription'];
        
        // 3. Generate authentication token (JWT or session)
        $token = generateAuthToken($user['id'], $user['email'], $user['role']);
        
        // 4. Return user data with subscription info
        return [
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'name' => $user['name'],
                'role' => $user['role'],
                'company_name' => $user['company_name']
            ],
            'subscription' => [
                'plan' => $subscription['plan_name'],
                'status' => $subscription['status'],
                'is_trial' => (bool)$subscription['is_trial'],
                'end_date' => $subscription['end_date'],
                'days_remaining' => calculateDaysRemaining($subscription['end_date'])
            ],
            'subscription_status_changed' => $subscriptionCheck['status_changed'],
            'notifications' => generateSubscriptionNotifications($subscription)
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Helper function to authenticate user
 */
function authenticateUser($email, $password) {
    global $db;
    
    $sql = "SELECT * FROM users WHERE email = :email";
    $stmt = $db->prepare($sql);
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user && password_verify($password, $user['password'])) {
        return $user;
    }
    
    return null;
}

/**
 * Calculate days remaining until subscription ends
 */
function calculateDaysRemaining($endDate) {
    $now = new DateTime();
    $end = new DateTime($endDate);
    $interval = $now->diff($end);
    
    return $interval->invert ? 0 : $interval->days;
}

/**
 * Generate notifications based on subscription status
 */
function generateSubscriptionNotifications($subscription) {
    $notifications = [];
    
    switch ($subscription['status']) {
        case 'TRIAL_EXPIRING':
            $daysLeft = calculateDaysRemaining($subscription['end_date']);
            $notifications[] = [
                'type' => 'warning',
                'message' => "Your trial expires in {$daysLeft} days. Upgrade now to continue using SafariTix.",
                'action' => 'upgrade',
                'urgent' => true
            ];
            break;
            
        case 'TRIAL_EXPIRED':
            $notifications[] = [
                'type' => 'error',
                'message' => 'Your trial has expired. Please purchase a subscription to continue.',
                'action' => 'subscribe',
                'urgent' => true,
                'blocking' => true
            ];
            break;
            
        case 'GRACE_PERIOD':
            $daysLeft = calculateDaysRemaining(
                date('Y-m-d H:i:s', strtotime($subscription['end_date'] . ' +7 days'))
            );
            $notifications[] = [
                'type' => 'error',
                'message' => "Your subscription has expired. You have {$daysLeft} days to renew before access is suspended.",
                'action' => 'renew',
                'urgent' => true
            ];
            break;
            
        case 'EXPIRED':
            $notifications[] = [
                'type' => 'error',
                'message' => 'Your subscription has expired. Please renew to restore access.',
                'action' => 'renew',
                'urgent' => true,
                'blocking' => true
            ];
            break;
    }
    
    return $notifications;
}

/**
 * =====================================================
 * EXAMPLE 3: FEATURE GATING MIDDLEWARE
 * =====================================================
 */
function checkFeatureAccess($userId, $feature) {
    global $db;
    
    $subscriptionManager = new SubscriptionManager($db);
    $accessCheck = $subscriptionManager->canAccessFeature($userId, $feature);
    
    if (!$accessCheck['allowed']) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'Feature not available',
            'reason' => $accessCheck['reason'],
            'current_plan' => $accessCheck['plan'] ?? null,
            'upgrade_required' => true
        ]);
        exit;
    }
    
    return true;
}

/**
 * Example: Protect GPS tracking feature
 */
function getGPSTracking($userId, $busId) {
    // Check if user has access to GPS tracking
    checkFeatureAccess($userId, 'gps_tracking');
    
    // If we get here, user has access - proceed with feature
    // Your GPS tracking logic here
    return [
        'success' => true,
        'data' => [
            'bus_id' => $busId,
            'latitude' => -1.2921,
            'longitude' => 36.8219,
            'speed' => 60,
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ];
}

/**
 * Example: Check bus limit before adding new bus
 */
function addNewBus($userId, $busData) {
    global $db;
    
    // Get current bus count
    $sql = "SELECT COUNT(*) as count FROM buses WHERE company_id = :user_id";
    $stmt = $db->prepare($sql);
    $stmt->execute(['user_id' => $userId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $currentBusCount = $result['count'];
    
    // Check if user can add more buses
    $subscriptionManager = new SubscriptionManager($db);
    $busCheck = $subscriptionManager->canAddBus($userId, $currentBusCount);
    
    if (!$busCheck['allowed']) {
        return [
            'success' => false,
            'error' => $busCheck['reason'],
            'current_count' => $busCheck['current'],
            'limit' => $busCheck['limit'],
            'plan' => $busCheck['plan'],
            'upgrade_required' => true
        ];
    }
    
    // User can add bus - proceed with creation
    // Your bus creation logic here
    return [
        'success' => true,
        'message' => 'Bus added successfully',
        'bus_id' => 'new-bus-id'
    ];
}

/**
 * =====================================================
 * EXAMPLE 4: SUBSCRIPTION UPGRADE
 * =====================================================
 */
function upgradeSubscription($userId, $newPlan, $paymentData) {
    global $db;
    
    try {
        // 1. Process payment (integrate with M-PESA or payment gateway)
        $paymentResult = processPayment($paymentData);
        
        if (!$paymentResult['success']) {
            return [
                'success' => false,
                'error' => 'Payment failed: ' . $paymentResult['error']
            ];
        }
        
        // 2. Upgrade subscription
        $subscriptionManager = new SubscriptionManager($db);
        $upgradeResult = $subscriptionManager->upgradePlan(
            $userId,
            $newPlan,
            $paymentResult['amount'],
            $paymentResult['method']
        );
        
        if (!$upgradeResult['success']) {
            // Refund payment if upgrade failed
            refundPayment($paymentResult['transaction_id']);
            
            return [
                'success' => false,
                'error' => 'Upgrade failed: ' . $upgradeResult['error']
            ];
        }
        
        // 3. Return success
        return [
            'success' => true,
            'message' => $upgradeResult['message'],
            'new_plan' => $upgradeResult['new_plan'],
            'end_date' => $upgradeResult['end_date'],
            'transaction_id' => $paymentResult['transaction_id']
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Helper: Process payment (placeholder - integrate with actual payment gateway)
 */
function processPayment($paymentData) {
    // Integrate with M-PESA STK Push or Card payment gateway
    // This is a placeholder - replace with actual payment integration
    
    return [
        'success' => true,
        'transaction_id' => 'TXN-' . time(),
        'amount' => $paymentData['amount'],
        'method' => $paymentData['method']
    ];
}

/**
 * =====================================================
 * EXAMPLE 5: DAILY CRON JOB
 * =====================================================
 * 
 * Run this daily to update all subscription statuses
 */
function dailySubscriptionUpdate() {
    global $db;
    
    echo "Starting daily subscription update...\n";
    
    // Get all active subscriptions
    $sql = "SELECT DISTINCT user_id FROM subscriptions";
    $stmt = $db->query($sql);
    $userIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $subscriptionManager = new SubscriptionManager($db);
    $updated = 0;
    $errors = 0;
    
    foreach ($userIds as $userId) {
        $result = $subscriptionManager->checkAndUpdateSubscription($userId);
        
        if ($result['success']) {
            if ($result['status_changed']) {
                echo "Updated user {$userId}: {$result['old_status']} -> {$result['new_status']}\n";
                $updated++;
            }
        } else {
            echo "Error updating user {$userId}: {$result['error']}\n";
            $errors++;
        }
    }
    
    echo "Daily update complete. Updated: {$updated}, Errors: {$errors}\n";
}

/**
 * =====================================================
 * EXAMPLE 6: API ENDPOINT IMPLEMENTATIONS
 * =====================================================
 */

// POST /api/auth/signup
function apiSignup() {
    header('Content-Type: application/json');
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    $result = handleUserSignup(
        $data['email'],
        $data['password'],
        $data['name'],
        $data['company_name']
    );
    
    http_response_code($result['success'] ? 201 : 400);
    echo json_encode($result);
}

// POST /api/auth/login
function apiLogin() {
    header('Content-Type: application/json');
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    $result = handleUserLogin($data['email'], $data['password']);
    
    http_response_code($result['success'] ? 200 : 401);
    echo json_encode($result);
}

// GET /api/subscription
function apiGetSubscription($userId) {
    global $db;
    header('Content-Type: application/json');
    
    $subscriptionManager = new SubscriptionManager($db);
    $subscription = $subscriptionManager->getSubscription($userId);
    
    if ($subscription) {
        echo json_encode([
            'success' => true,
            'subscription' => $subscription
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'No subscription found'
        ]);
    }
}

// POST /api/subscription/upgrade
function apiUpgradeSubscription($userId) {
    header('Content-Type: application/json');
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    $result = upgradeSubscription($userId, $data['plan'], $data['payment']);
    
    http_response_code($result['success'] ? 200 : 400);
    echo json_encode($result);
}

// GET /api/subscription/plans
function apiGetPlans() {
    global $db;
    header('Content-Type: application/json');
    
    $subscriptionManager = new SubscriptionManager($db);
    $plans = $subscriptionManager->getAllPlans();
    
    echo json_encode([
        'success' => true,
        'plans' => $plans
    ]);
}

/**
 * =====================================================
 * UTILITY FUNCTIONS
 * =====================================================
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

function generateAuthToken($userId, $email, $role) {
    // Implement JWT token generation or session management
    // This is a placeholder
    return base64_encode(json_encode([
        'user_id' => $userId,
        'email' => $email,
        'role' => $role,
        'timestamp' => time()
    ]));
}

function refundPayment($transactionId) {
    // Implement payment refund logic
    // Placeholder
    return true;
}

?>
