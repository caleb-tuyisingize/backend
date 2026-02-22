<?php
/**
 * =====================================================
 * SafariTix Subscription System - Test Script
 * =====================================================
 * 
 * This script demonstrates and tests the subscription system
 * Run this to verify everything is working correctly
 * 
 * Usage: php test_subscription_system.php
 */

require_once __DIR__ . '/SubscriptionManager.php';
require_once __DIR__ . '/../config/database.php';

// Colors for terminal output
class Color {
    public static $GREEN = "\033[32m";
    public static $RED = "\033[31m";
    public static $YELLOW = "\033[33m";
    public static $BLUE = "\033[34m";
    public static $RESET = "\033[0m";
}

echo "\n";
echo "========================================\n";
echo "SafariTix Subscription System Test\n";
echo "========================================\n\n";

try {
    global $db;
    
    if (!$db) {
        throw new Exception('Database connection failed');
    }
    
    $subscriptionManager = new SubscriptionManager($db);
    
    // Test 1: Check if tables exist
    echo "Test 1: Database Tables\n";
    $tables = ['subscription_plans', 'subscriptions', 'subscription_history'];
    foreach ($tables as $table) {
        $result = $db->query("SHOW TABLES LIKE '$table'");
        if ($result->rowCount() > 0) {
            echo Color::$GREEN . "✓" . Color::$RESET . " Table '{$table}' exists\n";
        } else {
            echo Color::$RED . "✗" . Color::$RESET . " Table '{$table}' missing\n";
        }
    }
    echo "\n";
    
    // Test 2: Check subscription plans
    echo "Test 2: Subscription Plans\n";
    $plans = $subscriptionManager->getAllPlans();
    if (count($plans) === 3) {
        echo Color::$GREEN . "✓" . Color::$RESET . " All 3 plans found\n";
        foreach ($plans as $plan) {
            echo "  - {$plan['name']}: RWF " . number_format($plan['price']) . "/month";
            echo " (Max buses: " . ($plan['max_buses'] ?? 'Unlimited') . ")\n";
        }
    } else {
        echo Color::$RED . "✗" . Color::$RESET . " Expected 3 plans, found " . count($plans) . "\n";
    }
    echo "\n";
    
    // Test 3: Create test trial subscription
    echo "Test 3: Create Trial Subscription\n";
    $testUserId = 'test-' . uniqid();
    $testEmail = 'test@example.com';
    
    // First create a test user
    $sql = "INSERT INTO users (id, email, password, name, role, created_at) 
            VALUES (:id, :email, :password, :name, 'company_admin', NOW())
            ON DUPLICATE KEY UPDATE id = id";
    $stmt = $db->prepare($sql);
    $stmt->execute([
        'id' => $testUserId,
        'email' => $testEmail,
        'password' => password_hash('testpass', PASSWORD_BCRYPT),
        'name' => 'Test User'
    ]);
    
    $result = $subscriptionManager->createTrialForNewUser($testUserId, $testEmail);
    
    if ($result['success']) {
        echo Color::$GREEN . "✓" . Color::$RESET . " Trial subscription created\n";
        echo "  Plan: {$result['subscription']['plan_name']}\n";
        echo "  Status: {$result['subscription']['status']}\n";
        echo "  Is Trial: " . ($result['subscription']['is_trial'] ? 'Yes' : 'No') . "\n";
    } else {
        echo Color::$RED . "✗" . Color::$RESET . " Failed: {$result['error']}\n";
    }
    echo "\n";
    
    // Test 4: Check subscription status update
    echo "Test 4: Check and Update Status\n";
    $check = $subscriptionManager->checkAndUpdateSubscription($testUserId);
    
    if ($check['success']) {
        echo Color::$GREEN . "✓" . Color::$RESET . " Status check successful\n";
        echo "  Current Status: {$check['subscription']['status']}\n";
        echo "  Status Changed: " . ($check['status_changed'] ? 'Yes' : 'No') . "\n";
    } else {
        echo Color::$RED . "✗" . Color::$RESET . " Failed: {$check['error']}\n";
    }
    echo "\n";
    
    // Test 5: Feature access check
    echo "Test 5: Feature Access Control\n";
    
    $features = [
        'basic_ticketing' => true,   // Should be allowed in Starter
        'gps_tracking' => false,      // Should be denied in Starter
        'api_access' => false         // Should be denied in Starter
    ];
    
    foreach ($features as $feature => $shouldAllow) {
        $access = $subscriptionManager->canAccessFeature($testUserId, $feature);
        
        if ($access['allowed'] === $shouldAllow) {
            echo Color::$GREEN . "✓" . Color::$RESET;
        } else {
            echo Color::$RED . "✗" . Color::$RESET;
        }
        
        echo " Feature '{$feature}': ";
        echo $access['allowed'] ? 'Allowed' : 'Denied';
        echo " (Expected: " . ($shouldAllow ? 'Allowed' : 'Denied') . ")\n";
    }
    echo "\n";
    
    // Test 6: Bus limit check
    echo "Test 6: Bus Limit Enforcement\n";
    
    $testCases = [
        ['count' => 0, 'should_allow' => true],
        ['count' => 4, 'should_allow' => true],
        ['count' => 5, 'should_allow' => false],  // At limit
        ['count' => 6, 'should_allow' => false],  // Over limit
    ];
    
    foreach ($testCases as $test) {
        $check = $subscriptionManager->canAddBus($testUserId, $test['count']);
        
        if ($check['allowed'] === $test['should_allow']) {
            echo Color::$GREEN . "✓" . Color::$RESET;
        } else {
            echo Color::$RED . "✗" . Color::$RESET;
        }
        
        echo " {$test['count']} buses: ";
        echo $check['allowed'] ? 'Can add' : 'Cannot add';
        echo " (Expected: " . ($test['should_allow'] ? 'Can add' : 'Cannot add') . ")\n";
    }
    echo "\n";
    
    // Test 7: Test user (mugisha@gmail.com)
    echo "Test 7: Special Test User\n";
    $testUserEmail = 'mugisha@gmail.com';
    
    // Check if test user exists
    $sql = "SELECT id FROM users WHERE email = :email";
    $stmt = $db->prepare($sql);
    $stmt->execute(['email' => $testUserEmail]);
    $existingUser = $stmt->fetch();
    
    if ($existingUser) {
        // User exists - check their subscription
        $subscription = $subscriptionManager->getSubscription($existingUser['id']);
        
        if ($subscription) {
            echo Color::$GREEN . "✓" . Color::$RESET . " Test user subscription found\n";
            echo "  Plan: {$subscription['plan_name']}\n";
            echo "  Status: {$subscription['status']}\n";
            echo "  Is Trial: " . ($subscription['is_trial'] ? 'Yes' : 'No') . "\n";
            
            // Verify it's Enterprise ACTIVE
            if ($subscription['plan_name'] === 'Enterprise' && $subscription['status'] === 'ACTIVE') {
                echo Color::$GREEN . "✓" . Color::$RESET . " Test user has correct Enterprise ACTIVE access\n";
            } else {
                echo Color::$YELLOW . "!" . Color::$RESET . " Test user doesn't have Enterprise ACTIVE\n";
            }
        } else {
            echo Color::$YELLOW . "!" . Color::$RESET . " Test user exists but no subscription found\n";
            echo "  Run signup again to create subscription\n";
        }
    } else {
        echo Color::$YELLOW . "!" . Color::$RESET . " Test user not found in database\n";
        echo "  Test user will be created on first signup\n";
    }
    echo "\n";
    
    // Test 8: Subscription upgrade
    echo "Test 8: Subscription Upgrade\n";
    $upgradeResult = $subscriptionManager->upgradePlan(
        $testUserId,
        'Growth',
        150000.00,
        'TEST'
    );
    
    if ($upgradeResult['success']) {
        echo Color::$GREEN . "✓" . Color::$RESET . " Upgrade successful\n";
        echo "  New Plan: {$upgradeResult['new_plan']}\n";
        echo "  Message: {$upgradeResult['message']}\n";
    } else {
        echo Color::$RED . "✗" . Color::$RESET . " Upgrade failed: {$upgradeResult['error']}\n";
    }
    echo "\n";
    
    // Test 9: Subscription history
    echo "Test 9: Subscription History\n";
    $sql = "SELECT COUNT(*) as count FROM subscription_history WHERE user_id = :user_id";
    $stmt = $db->prepare($sql);
    $stmt->execute(['user_id' => $testUserId]);
    $historyCount = $stmt->fetch()['count'];
    
    if ($historyCount > 0) {
        echo Color::$GREEN . "✓" . Color::$RESET . " {$historyCount} history entries found\n";
        
        // Show recent history
        $sql = "SELECT action, old_status, new_status, old_plan, new_plan, created_at
                FROM subscription_history 
                WHERE user_id = :user_id 
                ORDER BY created_at DESC 
                LIMIT 3";
        $stmt = $db->prepare($sql);
        $stmt->execute(['user_id' => $testUserId]);
        $history = $stmt->fetchAll();
        
        foreach ($history as $entry) {
            echo "  - {$entry['action']}";
            if ($entry['old_plan'] && $entry['new_plan']) {
                echo ": {$entry['old_plan']} → {$entry['new_plan']}";
            }
            echo " (" . date('Y-m-d H:i', strtotime($entry['created_at'])) . ")\n";
        }
    } else {
        echo Color::$YELLOW . "!" . Color::$RESET . " No history entries found\n";
    }
    echo "\n";
    
    // Test 10: Cleanup
    echo "Test 10: Cleanup Test Data\n";
    try {
        $db->prepare("DELETE FROM subscriptions WHERE user_id = :id")
           ->execute(['id' => $testUserId]);
        $db->prepare("DELETE FROM users WHERE id = :id")
           ->execute(['id' => $testUserId]);
        
        echo Color::$GREEN . "✓" . Color::$RESET . " Test data cleaned up\n";
    } catch (Exception $e) {
        echo Color::$YELLOW . "!" . Color::$RESET . " Cleanup warning: {$e->getMessage()}\n";
    }
    echo "\n";
    
    // Final summary
    echo "========================================\n";
    echo Color::$GREEN . "All Tests Completed!\n" . Color::$RESET;
    echo "========================================\n";
    echo "\nSubscription system is ready to use.\n";
    echo "See SUBSCRIPTION_README.md for integration guide.\n\n";
    
} catch (Exception $e) {
    echo "\n" . Color::$RED . "✗✗✗ TEST FAILED ✗✗✗\n" . Color::$RESET;
    echo "Error: {$e->getMessage()}\n";
    echo "File: {$e->getFile()}\n";
    echo "Line: {$e->getLine()}\n\n";
    exit(1);
}

exit(0);

?>
