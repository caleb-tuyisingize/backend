<?php
/**
 * =====================================================
 * SafariTix Subscription Management System
 * =====================================================
 * 
 * This class handles all subscription-related operations including:
 * - Creating trials for new users
 * - Checking and updating subscription status
 * - Feature gating based on plan
 * - Enterprise test user assignment
 * 
 * @author SafariTix Development Team
 * @version 1.0.0
 */

class SubscriptionManager {
    
    private $db;
    private $testUserEmail = 'mugisha@gmail.com';
    
    // Subscription status constants
    const STATUS_TRIAL_ACTIVE = 'TRIAL_ACTIVE';
    const STATUS_TRIAL_EXPIRING = 'TRIAL_EXPIRING';
    const STATUS_TRIAL_EXPIRED = 'TRIAL_EXPIRED';
    const STATUS_ACTIVE = 'ACTIVE';
    const STATUS_GRACE_PERIOD = 'GRACE_PERIOD';
    const STATUS_EXPIRED = 'EXPIRED';
    
    // Plan names
    const PLAN_STARTER = 'Starter';
    const PLAN_GROWTH = 'Growth';
    const PLAN_ENTERPRISE = 'Enterprise';
    
    /**
     * Constructor
     * 
     * @param PDO $db Database connection
     */
    public function __construct($db) {
        $this->db = $db;
    }
    
    /**
     * =====================================================
     * USER SIGNUP - CREATE TRIAL SUBSCRIPTION
     * =====================================================
     * 
     * Called when a new user registers. Automatically creates
     * a 14-day trial subscription on Starter plan.
     * 
     * Special case: mugisha@gmail.com gets Enterprise ACTIVE for 30 days
     * 
     * @param string $userId User ID (UUID)
     * @param string $userEmail User email address
     * @return array Subscription details
     */
    public function createTrialForNewUser($userId, $userEmail) {
        try {
            $this->db->beginTransaction();
            
            // Check if this is the test user
            $isTestUser = strtolower($userEmail) === strtolower($this->testUserEmail);
            
            if ($isTestUser) {
                // Create Enterprise ACTIVE subscription for test user
                $subscriptionData = $this->createEnterpriseTestSubscription($userId);
            } else {
                // Create standard trial subscription on Starter plan
                $subscriptionData = $this->createStandardTrial($userId);
            }
            
            // Log the subscription creation
            $this->logSubscriptionHistory(
                $subscriptionData['id'],
                $userId,
                $subscriptionData['plan_name'],
                'CREATED',
                null,
                $subscriptionData['status'],
                null,
                $subscriptionData['plan_name'],
                null,
                $isTestUser ? 'Test user - Enterprise access granted' : 'New user trial created'
            );
            
            $this->db->commit();
            
            return [
                'success' => true,
                'subscription' => $subscriptionData,
                'message' => $isTestUser 
                    ? 'Enterprise test subscription activated for 30 days' 
                    : '14-day trial subscription created on Starter plan'
            ];
            
        } catch (Exception $e) {
            $this->db->rollBack();
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Create standard trial subscription (Starter plan, 14 days)
     * 
     * @param string $userId User ID
     * @return array Subscription data
     */
    private function createStandardTrial($userId) {
        $subscriptionId = $this->generateUUID();
        $now = new DateTime();
        $trialEndDate = clone $now;
        $trialEndDate->modify('+14 days');
        
        $sql = "INSERT INTO subscriptions (
            id, user_id, plan_name, status, is_trial,
            trial_start_date, trial_end_date,
            start_date, end_date,
            auto_renew, created_at, updated_at
        ) VALUES (
            :id, :user_id, :plan_name, :status, :is_trial,
            :trial_start_date, :trial_end_date,
            :start_date, :end_date,
            :auto_renew, NOW(), NOW()
        )";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'id' => $subscriptionId,
            'user_id' => $userId,
            'plan_name' => self::PLAN_STARTER,
            'status' => self::STATUS_TRIAL_ACTIVE,
            'is_trial' => 1,
            'trial_start_date' => $now->format('Y-m-d H:i:s'),
            'trial_end_date' => $trialEndDate->format('Y-m-d H:i:s'),
            'start_date' => $now->format('Y-m-d H:i:s'),
            'end_date' => $trialEndDate->format('Y-m-d H:i:s'),
            'auto_renew' => 0
        ]);
        
        // Update user table
        $this->updateUserSubscriptionStatus($userId, self::STATUS_TRIAL_ACTIVE, self::PLAN_STARTER);
        
        return [
            'id' => $subscriptionId,
            'user_id' => $userId,
            'plan_name' => self::PLAN_STARTER,
            'status' => self::STATUS_TRIAL_ACTIVE,
            'is_trial' => true,
            'start_date' => $now->format('Y-m-d H:i:s'),
            'end_date' => $trialEndDate->format('Y-m-d H:i:s')
        ];
    }
    
    /**
     * Create Enterprise ACTIVE subscription for test user (30 days)
     * 
     * @param string $userId User ID
     * @return array Subscription data
     */
    private function createEnterpriseTestSubscription($userId) {
        $subscriptionId = $this->generateUUID();
        $now = new DateTime();
        $endDate = clone $now;
        $endDate->modify('+30 days');
        
        $sql = "INSERT INTO subscriptions (
            id, user_id, plan_name, status, is_trial,
            trial_start_date, trial_end_date,
            start_date, end_date,
            auto_renew, last_payment_date, last_payment_amount,
            created_at, updated_at
        ) VALUES (
            :id, :user_id, :plan_name, :status, :is_trial,
            NULL, NULL,
            :start_date, :end_date,
            :auto_renew, :last_payment_date, :last_payment_amount,
            NOW(), NOW()
        )";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'id' => $subscriptionId,
            'user_id' => $userId,
            'plan_name' => self::PLAN_ENTERPRISE,
            'status' => self::STATUS_ACTIVE,
            'is_trial' => 0,
            'start_date' => $now->format('Y-m-d H:i:s'),
            'end_date' => $endDate->format('Y-m-d H:i:s'),
            'auto_renew' => 1,
            'last_payment_date' => $now->format('Y-m-d H:i:s'),
            'last_payment_amount' => 250000.00
        ]);
        
        // Update user table
        $this->updateUserSubscriptionStatus($userId, self::STATUS_ACTIVE, self::PLAN_ENTERPRISE);
        
        return [
            'id' => $subscriptionId,
            'user_id' => $userId,
            'plan_name' => self::PLAN_ENTERPRISE,
            'status' => self::STATUS_ACTIVE,
            'is_trial' => false,
            'start_date' => $now->format('Y-m-d H:i:s'),
            'end_date' => $endDate->format('Y-m-d H:i:s')
        ];
    }
    
    /**
     * =====================================================
     * LOGIN - CHECK AND UPDATE SUBSCRIPTION STATUS
     * =====================================================
     * 
     * Called on user login or daily cron job.
     * Automatically updates subscription status based on dates.
     * 
     * @param string $userId User ID
     * @return array Updated subscription details
     */
    public function checkAndUpdateSubscription($userId) {
        try {
            // Get current subscription
            $sql = "SELECT * FROM subscriptions WHERE user_id = :user_id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['user_id' => $userId]);
            $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$subscription) {
                return [
                    'success' => false,
                    'error' => 'No subscription found for user'
                ];
            }
            
            $oldStatus = $subscription['status'];
            $newStatus = $this->calculateSubscriptionStatus($subscription);
            
            // Update if status changed
            if ($oldStatus !== $newStatus) {
                $this->updateSubscriptionStatus($userId, $newStatus);
                
                // Log the status change
                $this->logSubscriptionHistory(
                    $subscription['id'],
                    $userId,
                    $subscription['plan_name'],
                    'STATUS_CHANGED',
                    $oldStatus,
                    $newStatus,
                    $subscription['plan_name'],
                    $subscription['plan_name'],
                    null,
                    "Automatic status update on login/check"
                );
            }
            
            // Fetch updated subscription
            $stmt->execute(['user_id' => $userId]);
            $updatedSubscription = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'subscription' => $updatedSubscription,
                'status_changed' => $oldStatus !== $newStatus,
                'old_status' => $oldStatus,
                'new_status' => $newStatus
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Calculate what the subscription status should be based on dates
     * 
     * @param array $subscription Current subscription data
     * @return string New status
     */
    private function calculateSubscriptionStatus($subscription) {
        $now = new DateTime();
        $endDate = new DateTime($subscription['end_date']);
        $graceEndDate = clone $endDate;
        $graceEndDate->modify('+7 days');
        
        // Calculate days until expiry
        $interval = $now->diff($endDate);
        $daysUntilExpiry = $interval->invert ? -$interval->days : $interval->days;
        
        if ($subscription['is_trial']) {
            // TRIAL LOGIC
            if ($now < $endDate) {
                // Trial is still active
                if ($daysUntilExpiry <= 3) {
                    return self::STATUS_TRIAL_EXPIRING;
                } else {
                    return self::STATUS_TRIAL_ACTIVE;
                }
            } else {
                // Trial has ended
                return self::STATUS_TRIAL_EXPIRED;
            }
        } else {
            // PAID SUBSCRIPTION LOGIC
            if ($now < $endDate) {
                // Subscription is active
                return self::STATUS_ACTIVE;
            } elseif ($now < $graceEndDate) {
                // In grace period (7 days after expiry)
                return self::STATUS_GRACE_PERIOD;
            } else {
                // Fully expired
                return self::STATUS_EXPIRED;
            }
        }
    }
    
    /**
     * Update subscription status in database
     * 
     * @param string $userId User ID
     * @param string $status New status
     */
    private function updateSubscriptionStatus($userId, $status) {
        $sql = "UPDATE subscriptions 
                SET status = :status, updated_at = NOW() 
                WHERE user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'status' => $status,
            'user_id' => $userId
        ]);
        
        // Also update user table for easy access
        $this->updateUserSubscriptionStatus($userId, $status, null);
    }
    
    /**
     * Update user table with subscription info
     * 
     * @param string $userId User ID
     * @param string $status Subscription status
     * @param string|null $plan Plan name (optional)
     */
    private function updateUserSubscriptionStatus($userId, $status, $plan = null) {
        if ($plan) {
            $sql = "UPDATE users 
                    SET subscription_status = :status, 
                        subscription_plan = :plan 
                    WHERE id = :user_id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'status' => $status,
                'plan' => $plan,
                'user_id' => $userId
            ]);
        } else {
            $sql = "UPDATE users 
                    SET subscription_status = :status 
                    WHERE id = :user_id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'status' => $status,
                'user_id' => $userId
            ]);
        }
    }
    
    /**
     * =====================================================
     * FEATURE GATING - CHECK ACCESS PERMISSIONS
     * =====================================================
     * 
     * Check if user has access to a specific feature based on
     * their subscription plan and status.
     * 
     * @param string $userId User ID
     * @param string $feature Feature name to check
     * @return array Access result
     */
    public function canAccessFeature($userId, $feature) {
        try {
            // Get user's subscription
            $sql = "SELECT s.*, sp.max_buses, sp.features 
                    FROM subscriptions s
                    JOIN subscription_plans sp ON s.plan_name = sp.name
                    WHERE s.user_id = :user_id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['user_id' => $userId]);
            $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$subscription) {
                return [
                    'allowed' => false,
                    'reason' => 'No active subscription'
                ];
            }
            
            // Check if subscription is in a valid state
            $validStatuses = [
                self::STATUS_TRIAL_ACTIVE,
                self::STATUS_TRIAL_EXPIRING,
                self::STATUS_ACTIVE,
                self::STATUS_GRACE_PERIOD
            ];
            
            if (!in_array($subscription['status'], $validStatuses)) {
                return [
                    'allowed' => false,
                    'reason' => 'Subscription expired',
                    'status' => $subscription['status']
                ];
            }
            
            // Check feature availability by plan
            $allowed = $this->isFeatureInPlan($subscription['plan_name'], $feature);
            
            return [
                'allowed' => $allowed,
                'plan' => $subscription['plan_name'],
                'status' => $subscription['status'],
                'reason' => $allowed ? 'Access granted' : 'Feature not available in your plan'
            ];
            
        } catch (Exception $e) {
            return [
                'allowed' => false,
                'reason' => 'Error checking feature access: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Check if a specific feature is available in a plan
     * 
     * @param string $planName Plan name
     * @param string $feature Feature to check
     * @return bool
     */
    private function isFeatureInPlan($planName, $feature) {
        // Define feature matrix
        $features = [
            self::PLAN_STARTER => [
                'basic_ticketing',
                'seat_management',
                'create_schedules',
                'company_profile',
                'manual_driver_assignment',
                'daily_revenue_summary',
                'max_buses' => 5
            ],
            self::PLAN_GROWTH => [
                'basic_ticketing',
                'seat_management',
                'create_schedules',
                'company_profile',
                'manual_driver_assignment',
                'daily_revenue_summary',
                'gps_tracking',
                'ticket_cancellation',
                'advanced_analytics',
                'driver_accounts',
                'route_performance',
                'priority_support',
                'max_buses' => 20
            ],
            self::PLAN_ENTERPRISE => [
                'basic_ticketing',
                'seat_management',
                'create_schedules',
                'company_profile',
                'manual_driver_assignment',
                'daily_revenue_summary',
                'gps_tracking',
                'ticket_cancellation',
                'advanced_analytics',
                'driver_accounts',
                'route_performance',
                'priority_support',
                'unlimited_buses',
                'multiple_admins',
                'custom_reports',
                'api_access',
                'dedicated_support',
                'sla_guarantee',
                'custom_integrations',
                'max_buses' => null // unlimited
            ]
        ];
        
        return isset($features[$planName]) && in_array($feature, $features[$planName]);
    }
    
    /**
     * Check if user can add more buses
     * 
     * @param string $userId User ID
     * @param int $currentBusCount Current number of buses
     * @return array Result
     */
    public function canAddBus($userId, $currentBusCount) {
        $sql = "SELECT s.plan_name, sp.max_buses
                FROM subscriptions s
                JOIN subscription_plans sp ON s.plan_name = sp.name
                WHERE s.user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            return [
                'allowed' => false,
                'reason' => 'No subscription found'
            ];
        }
        
        // Null max_buses means unlimited (Enterprise)
        if ($result['max_buses'] === null) {
            return [
                'allowed' => true,
                'reason' => 'Unlimited buses allowed',
                'plan' => $result['plan_name']
            ];
        }
        
        $allowed = $currentBusCount < $result['max_buses'];
        
        return [
            'allowed' => $allowed,
            'reason' => $allowed 
                ? "You can add more buses (limit: {$result['max_buses']})"
                : "Bus limit reached. Upgrade to add more buses.",
            'current' => $currentBusCount,
            'limit' => $result['max_buses'],
            'plan' => $result['plan_name']
        ];
    }
    
    /**
     * =====================================================
     * SUBSCRIPTION UPGRADE/DOWNGRADE
     * =====================================================
     * 
     * Upgrade or downgrade user's subscription plan
     * 
     * @param string $userId User ID
     * @param string $newPlan New plan name
     * @param float $amount Payment amount
     * @param string $paymentMethod Payment method
     * @return array Result
     */
    public function upgradePlan($userId, $newPlan, $amount, $paymentMethod = 'M-PESA') {
        try {
            $this->db->beginTransaction();
            
            // Get current subscription
            $sql = "SELECT * FROM subscriptions WHERE user_id = :user_id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['user_id' => $userId]);
            $currentSub = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$currentSub) {
                throw new Exception('No subscription found');
            }
            
            $oldPlan = $currentSub['plan_name'];
            $action = $this->getUpgradeAction($oldPlan, $newPlan);
            
            // Calculate new end date (30 days from now)
            $now = new DateTime();
            $endDate = clone $now;
            $endDate->modify('+30 days');
            
            // Update subscription
            $sql = "UPDATE subscriptions 
                    SET plan_name = :plan_name,
                        status = :status,
                        is_trial = 0,
                        start_date = :start_date,
                        end_date = :end_date,
                        last_payment_date = :payment_date,
                        last_payment_amount = :amount,
                        payment_method = :payment_method,
                        updated_at = NOW()
                    WHERE user_id = :user_id";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'plan_name' => $newPlan,
                'status' => self::STATUS_ACTIVE,
                'start_date' => $now->format('Y-m-d H:i:s'),
                'end_date' => $endDate->format('Y-m-d H:i:s'),
                'payment_date' => $now->format('Y-m-d H:i:s'),
                'amount' => $amount,
                'payment_method' => $paymentMethod,
                'user_id' => $userId
            ]);
            
            // Update user table
            $this->updateUserSubscriptionStatus($userId, self::STATUS_ACTIVE, $newPlan);
            
            // Log the change
            $this->logSubscriptionHistory(
                $currentSub['id'],
                $userId,
                $newPlan,
                $action,
                $currentSub['status'],
                self::STATUS_ACTIVE,
                $oldPlan,
                $newPlan,
                $amount,
                "Plan changed from {$oldPlan} to {$newPlan}"
            );
            
            $this->db->commit();
            
            return [
                'success' => true,
                'message' => "Successfully {$action} to {$newPlan} plan",
                'new_plan' => $newPlan,
                'end_date' => $endDate->format('Y-m-d H:i:s')
            ];
            
        } catch (Exception $e) {
            $this->db->rollBack();
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Determine if plan change is upgrade or downgrade
     * 
     * @param string $oldPlan Old plan name
     * @param string $newPlan New plan name
     * @return string Action type
     */
    private function getUpgradeAction($oldPlan, $newPlan) {
        $planLevels = [
            self::PLAN_STARTER => 1,
            self::PLAN_GROWTH => 2,
            self::PLAN_ENTERPRISE => 3
        ];
        
        $oldLevel = $planLevels[$oldPlan] ?? 0;
        $newLevel = $planLevels[$newPlan] ?? 0;
        
        if ($newLevel > $oldLevel) {
            return 'UPGRADED';
        } elseif ($newLevel < $oldLevel) {
            return 'DOWNGRADED';
        } else {
            return 'RENEWED';
        }
    }
    
    /**
     * =====================================================
     * SUBSCRIPTION HISTORY LOGGING
     * =====================================================
     * 
     * Log subscription changes for audit trail
     */
    private function logSubscriptionHistory(
        $subscriptionId, 
        $userId, 
        $planName, 
        $action,
        $oldStatus = null,
        $newStatus = null,
        $oldPlan = null,
        $newPlan = null,
        $amount = null,
        $notes = null
    ) {
        $sql = "INSERT INTO subscription_history (
            id, subscription_id, user_id, plan_name, action,
            old_status, new_status, old_plan, new_plan,
            amount, notes, created_at
        ) VALUES (
            :id, :subscription_id, :user_id, :plan_name, :action,
            :old_status, :new_status, :old_plan, :new_plan,
            :amount, :notes, NOW()
        )";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'id' => $this->generateUUID(),
            'subscription_id' => $subscriptionId,
            'user_id' => $userId,
            'plan_name' => $planName,
            'action' => $action,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'old_plan' => $oldPlan,
            'new_plan' => $newPlan,
            'amount' => $amount,
            'notes' => $notes
        ]);
    }
    
    /**
     * =====================================================
     * UTILITY FUNCTIONS
     * =====================================================
     */
    
    /**
     * Generate UUID v4
     * 
     * @return string UUID
     */
    private function generateUUID() {
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
    
    /**
     * Get subscription details for a user
     * 
     * @param string $userId User ID
     * @return array|null Subscription details
     */
    public function getSubscription($userId) {
        $sql = "SELECT s.*, sp.max_buses, sp.features, sp.price
                FROM subscriptions s
                JOIN subscription_plans sp ON s.plan_name = sp.name
                WHERE s.user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get all available subscription plans
     * 
     * @return array List of plans
     */
    public function getAllPlans() {
        $sql = "SELECT * FROM subscription_plans ORDER BY price ASC";
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

?>
