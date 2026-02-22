<?php
/**
 * =====================================================
 * SafariTix Subscription Manager - PostgreSQL Version
 * =====================================================
 * 
 * Complete subscription management system for SafariTix bus ticketing platform
 * Handles trials, paid subscriptions, upgrades, feature gating, and status management
 * 
 * Features:
 * - Automatic 14-day trials for new users
 * - Special test user (mugisha@gmail.com) gets Enterprise ACTIVE for 30 days
 * - Six subscription statuses with automatic transitions
 * - Feature gating based on plan and status
 * - Bus limit enforcement
 * - Complete audit logging
 * - PostgreSQL compatible with proper types and queries
 * 
 * @author SafariTix Development Team
 * @version 2.0 (PostgreSQL)
 */

class SubscriptionManager {
    private $db;  // PDO database connection
    
    /**
     * Constructor - Initializes with database connection
     * 
     * @param PDO $db PostgreSQL database connection with PDO
     */
    public function __construct($db) {
        $this->db = $db;
    }
    
    /**
     * Create Trial Subscription for New User
     * 
     * Creates a 14-day trial on Starter plan for regular users
     * Special case: mugisha@gmail.com gets Enterprise ACTIVE for 30 days (not trial)
     * 
     * Call this immediately after user signup
     * 
     * @param string $userId User ID from users table
     * @param string $userEmail User's email address (for test user check)
     * @return array ['success' => bool, 'subscription' => array|null, 'error' => string|null]
     */
    public function createTrialForNewUser($userId, $userEmail) {
        try {
            // Check if user already has a subscription
            $sql = "SELECT id FROM subscriptions WHERE user_id = :user_id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['user_id' => $userId]);
            
            if ($stmt->fetch()) {
                // User already has a subscription - don't create another
                return [
                    'success' => false,
                    'error' => 'User already has a subscription'
                ];
            }
            
            // Check if this is the special test user
            $isTestUser = (strtolower($userEmail) === 'mugisha@gmail.com');
            
            if ($isTestUser) {
                // Test user gets Enterprise ACTIVE for 30 days (not trial)
                $planName = 'Enterprise';
                $isTrial = false;
                $status = 'ACTIVE';
                $trialStartDate = null;
                $trialEndDate = null;
                $startDate = date('Y-m-d H:i:s');  // Now
                $endDate = date('Y-m-d H:i:s', strtotime('+30 days'));  // 30 days from now
                $nextBillingDate = $endDate;  // Bill after 30 days
            } else {
                // Regular user gets 14-day Starter trial
                $planName = 'Starter';
                $isTrial = true;
                $status = 'TRIAL_ACTIVE';
                $trialStartDate = date('Y-m-d H:i:s');  // Now
                $trialEndDate = date('Y-m-d H:i:s', strtotime('+14 days'));  // 14 days from now
                $startDate = $trialStartDate;
                $endDate = $trialEndDate;
                $nextBillingDate = $trialEndDate;  // Bill when trial ends
            }
            
            // Insert the new subscription record
            $sql = "INSERT INTO subscriptions (
                        user_id, plan_name, status, is_trial,
                        trial_start_date, trial_end_date,
                        start_date, end_date, next_billing_date,
                        auto_renew, created_at, updated_at
                    ) VALUES (
                        :user_id, :plan_name::subscription_plan_name, :status::subscription_status, :is_trial,
                        :trial_start_date, :trial_end_date,
                        :start_date, :end_date, :next_billing_date,
                        TRUE, NOW(), NOW()
                    )
                    RETURNING id, user_id, plan_name::TEXT, status::TEXT, is_trial, 
                              trial_start_date, trial_end_date, start_date, end_date";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'user_id' => $userId,
                'plan_name' => $planName,
                'status' => $status,
                'is_trial' => $isTrial ? 'true' : 'false',
                'trial_start_date' => $trialStartDate,
                'trial_end_date' => $trialEndDate,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'next_billing_date' => $nextBillingDate
            ]);
            
            $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Update the user's subscription_status column
            $sql = "UPDATE users 
                    SET subscription_status = :status::subscription_status, 
                        updated_at = NOW() 
                    WHERE id = :user_id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'status' => $status,
                'user_id' => $userId
            ]);
            
            // Log the creation in subscription_history
            $sql = "INSERT INTO subscription_history (
                        user_id, subscription_id, action, 
                        new_status, new_plan, notes
                    ) VALUES (
                        :user_id, :subscription_id, 'CREATED'::subscription_action,
                        :new_status::subscription_status, :new_plan::subscription_plan_name, :notes
                    )";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'user_id' => $userId,
                'subscription_id' => $subscription['id'],
                'new_status' => $status,
                'new_plan' => $planName,
                'notes' => $isTestUser ? 'Test user - Enterprise ACTIVE 30 days' : '14-day trial created'
            ]);
            
            return [
                'success' => true,
                'subscription' => $subscription,
                'message' => $isTestUser ? 
                    'Test user subscription created - Enterprise ACTIVE for 30 days' : 
                    '14-day trial subscription created'
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Check and Update Subscription Status
     * 
     * Calculates the correct subscription status based on current date and subscription dates
     * Updates status if changed and logs to history
     * 
     * Should be called:
     * - On every user login
     * - By daily cron job for all users
     * 
     * @param string $userId User ID to check
     * @return array ['success' => bool, 'subscription' => array, 'status_changed' => bool, 'old_status' => string, 'new_status' => string]
     */
    public function checkAndUpdateSubscription($userId) {
        try {
            // Call the PostgreSQL function to update status
            $sql = "SELECT * FROM update_subscription_status(:user_id)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['user_id' => $userId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Fetch the updated subscription
            $subscription = $this->getSubscription($userId);
            
            if (!$subscription) {
                return [
                    'success' => false,
                    'error' => 'Subscription not found'
                ];
            }
            
            return [
                'success' => true,
                'subscription' => $subscription,
                'status_changed' => $result['status_changed'] ?? false,
                'old_status' => $result['old_status'] ?? null,
                'new_status' => $result['new_status'] ?? $subscription['status']
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Get User's Current Subscription
     * 
     * Fetches the complete subscription record including plan details
     * 
     * @param string $userId User ID
     * @return array|null Subscription record or null if not found
     */
    public function getSubscription($userId) {
        try {
            $sql = "SELECT 
                        s.id,
                        s.user_id,
                        s.plan_name::TEXT as plan_name,
                        s.status::TEXT as status,
                        s.is_trial,
                        s.trial_start_date,
                        s.trial_end_date,
                        s.start_date,
                        s.end_date,
                        s.next_billing_date,
                        s.auto_renew,
                        s.payment_method,
                        s.last_payment_amount,
                        s.last_payment_date,
                        s.created_at,
                        s.updated_at,
                        sp.price,
                        sp.max_buses,
                        sp.features,
                        sp.trial_days,
                        sp.grace_period_days
                    FROM subscriptions s
                    JOIN subscription_plans sp ON s.plan_name::TEXT = sp.name::TEXT
                    WHERE s.user_id = :user_id";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['user_id' => $userId]);
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
            
        } catch (Exception $e) {
            return null;
        }
    }
    
    /**
     * Can User Access Feature?
     * 
     * Checks if user's current plan and status allow access to a specific feature
     * Returns false for expired/trial_expired statuses
     * 
     * Call this before allowing access to any premium feature
     * 
     * @param string $userId User ID
     * @param string $feature Feature name (e.g., 'gps_tracking', 'api_access')
     * @return array ['allowed' => bool, 'reason' => string, 'upgrade_required' => string|null]
     */
    public function canAccessFeature($userId, $feature) {
        try {
            // Get user's subscription
            $subscription = $this->getSubscription($userId);
            
            if (!$subscription) {
                return [
                    'allowed' => false,
                    'reason' => 'No active subscription',
                    'upgrade_required' => 'Starter'
                ];
            }
            
            // Check if subscription status allows any access
            $status = $subscription['status'];
            
            // EXPIRED and TRIAL_EXPIRED users have no access
            if ($status === 'EXPIRED' || $status === 'TRIAL_EXPIRED') {
                return [
                    'allowed' => false,
                    'reason' => 'Subscription expired - payment required',
                    'upgrade_required' => null,
                    'requires_payment' => true
                ];
            }
            
            // GRACE_PERIOD users have limited access (basic features only)
            if ($status === 'GRACE_PERIOD') {
                $basicFeatures = ['basic_ticketing', 'mobile_app_access'];
                
                if (!in_array($feature, $basicFeatures)) {
                    return [
                        'allowed' => false,
                        'reason' => 'Grace period - limited to basic features. Please renew subscription.',
                        'upgrade_required' => null,
                        'requires_payment' => true
                    ];
                }
            }
            
            // Check if feature is in user's plan
            $planFeatures = $subscription['features'];
            
            // PostgreSQL returns array as string, need to parse it
            if (is_string($planFeatures)) {
                // Convert PostgreSQL array string to PHP array
                $planFeatures = str_replace(['{', '}', '"'], '', $planFeatures);
                $planFeatures = explode(',', $planFeatures);
            }
            
            if (in_array($feature, $planFeatures)) {
                return [
                    'allowed' => true,
                    'reason' => 'Feature included in plan'
                ];
            }
            
            // Feature not in plan - determine which plan is needed
            $requiredPlan = $this->getRequiredPlanForFeature($feature);
            
            return [
                'allowed' => false,
                'reason' => "Feature not included in {$subscription['plan_name']} plan",
                'upgrade_required' => $requiredPlan,
                'current_plan' => $subscription['plan_name']
            ];
            
        } catch (Exception $e) {
            return [
                'allowed' => false,
                'reason' => 'Error checking feature access: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Get Required Plan for Feature
     * 
     * Determines which plan level is needed for a specific feature
     * 
     * @param string $feature Feature name
     * @return string Plan name (Starter, Growth, or Enterprise)
     */
    private function getRequiredPlanForFeature($feature) {
        // Define feature matrix - maps features to minimum required plan
        $featureMatrix = [
            // Starter features (RWF 50k)
            'basic_ticketing' => 'Starter',
            'basic_reporting' => 'Starter',
            'email_support' => 'Starter',
            'mobile_app_access' => 'Starter',
            
            // Growth features (RWF 150k)
            'advanced_ticketing' => 'Growth',
            'gps_tracking' => 'Growth',
            'driver_accounts' => 'Growth',
            'advanced_analytics' => 'Growth',
            'route_optimization' => 'Growth',
            'qr_code_scanning' => 'Growth',
            'priority_support' => 'Growth',
            'custom_branding' => 'Growth',
            
            // Enterprise features (RWF 250k)
            'api_access' => 'Enterprise',
            'webhook_integration' => 'Enterprise',
            'white_label' => 'Enterprise',
            'dedicated_support' => 'Enterprise',
            'sla_guarantee' => 'Enterprise',
            'custom_integrations' => 'Enterprise',
            'priority_onboarding' => 'Enterprise',
            'data_export' => 'Enterprise'
        ];
        
        return $featureMatrix[$feature] ?? 'Enterprise';
    }
    
    /**
     * Can User Add Another Bus?
     * 
     * Checks if user can add another bus based on their plan's bus limit
     * 
     * @param string $userId User ID
     * @param int $currentBusCount Current number of buses user has
     * @return array ['allowed' => bool, 'reason' => string, 'limit' => int|null, 'current' => int]
     */
    public function canAddBus($userId, $currentBusCount) {
        try {
            $subscription = $this->getSubscription($userId);
            
            if (!$subscription) {
                return [
                    'allowed' => false,
                    'reason' => 'No active subscription',
                    'current' => $currentBusCount
                ];
            }
            
            // Check if subscription is active
            $status = $subscription['status'];
            if ($status === 'EXPIRED' || $status === 'TRIAL_EXPIRED') {
                return [
                    'allowed' => false,
                    'reason' => 'Subscription expired',
                    'current' => $currentBusCount,
                    'requires_payment' => true
                ];
            }
            
            $maxBuses = $subscription['max_buses'];
            
            // NULL max_buses means unlimited (Enterprise plan)
            if ($maxBuses === null) {
                return [
                    'allowed' => true,
                    'reason' => 'Unlimited buses allowed',
                    'limit' => null,
                    'current' => $currentBusCount
                ];
            }
            
            // Check if under limit
            if ($currentBusCount < $maxBuses) {
                return [
                    'allowed' => true,
                    'reason' => 'Within bus limit',
                    'limit' => $maxBuses,
                    'current' => $currentBusCount,
                    'remaining' => $maxBuses - $currentBusCount
                ];
            }
            
            // At or over limit
            return [
                'allowed' => false,
                'reason' => "Bus limit reached ({$maxBuses} buses)",
                'limit' => $maxBuses,
                'current' => $currentBusCount,
                'upgrade_required' => $this->getNextPlanUp($subscription['plan_name'])
            ];
            
        } catch (Exception $e) {
            return [
                'allowed' => false,
                'reason' => 'Error checking bus limit: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Get Next Plan Up
     * 
     * Returns the next higher plan level
     * 
     * @param string $currentPlan Current plan name
     * @return string|null Next plan name or null if already on highest
     */
    private function getNextPlanUp($currentPlan) {
        $planHierarchy = ['Starter', 'Growth', 'Enterprise'];
        $currentIndex = array_search($currentPlan, $planHierarchy);
        
        if ($currentIndex === false || $currentIndex >= count($planHierarchy) - 1) {
            return null;  // Already on highest plan
        }
        
        return $planHierarchy[$currentIndex + 1];
    }
    
    /**
     * Upgrade/Downgrade Subscription Plan
     * 
     * Changes user's subscription to a different plan
     * Handles payment recording and date calculations
     * 
     * @param string $userId User ID
     * @param string $newPlan New plan name (Starter, Growth, Enterprise)
     * @param float $paymentAmount Amount paid
     * @param string $paymentMethod Payment method (M-PESA, Bank, etc.)
     * @return array ['success' => bool, 'message' => string, 'new_plan' => string]
     */
    public function upgradePlan($userId, $newPlan, $paymentAmount, $paymentMethod) {
        try {
            // Get current subscription
            $currentSubscription = $this->getSubscription($userId);
            
            if (!$currentSubscription) {
                return [
                    'success' => false,
                    'error' => 'No subscription found'
                ];
            }
            
            $oldPlan = $currentSubscription['plan_name'];
            $oldStatus = $currentSubscription['status'];
            
            // Get new plan details
            $sql = "SELECT * FROM subscription_plans WHERE name = :plan_name::subscription_plan_name";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['plan_name' => $newPlan]);
            $planDetails = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$planDetails) {
                return [
                    'success' => false,
                    'error' => 'Invalid plan name'
                ];
            }
            
            // Calculate new dates
            $startDate = date('Y-m-d H:i:s');
            $endDate = date('Y-m-d H:i:s', strtotime('+30 days'));  // 30 days from now
            $nextBillingDate = $endDate;
            
            // Determine action type
            $planHierarchy = ['Starter', 'Growth', 'Enterprise'];
            $oldPlanIndex = array_search($oldPlan, $planHierarchy);
            $newPlanIndex = array_search($newPlan, $planHierarchy);
            
            if ($newPlanIndex > $oldPlanIndex) {
                $action = 'UPGRADED';
                $message = "Subscription upgraded from {$oldPlan} to {$newPlan}";
            } elseif ($newPlanIndex < $oldPlanIndex) {
                $action = 'DOWNGRADED';
                $message = "Subscription downgraded from {$oldPlan} to {$newPlan}";
            } else {
                $action = 'RENEWED';
                $message = "Subscription renewed on {$newPlan} plan";
            }
            
            // Update subscription
            $sql = "UPDATE subscriptions SET
                        plan_name = :plan_name::subscription_plan_name,
                        status = 'ACTIVE'::subscription_status,
                        is_trial = FALSE,
                        trial_start_date = NULL,
                        trial_end_date = NULL,
                        start_date = :start_date,
                        end_date = :end_date,
                        next_billing_date = :next_billing_date,
                        payment_method = :payment_method,
                        last_payment_amount = :payment_amount,
                        last_payment_date = NOW(),
                        updated_at = NOW()
                    WHERE user_id = :user_id";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'plan_name' => $newPlan,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'next_billing_date' => $nextBillingDate,
                'payment_method' => $paymentMethod,
                'payment_amount' => $paymentAmount,
                'user_id' => $userId
            ]);
            
            // Update user's subscription_status
            $sql = "UPDATE users SET subscription_status = 'ACTIVE'::subscription_status WHERE id = :user_id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['user_id' => $userId]);
            
            // Log to history
            $sql = "INSERT INTO subscription_history (
                        user_id, subscription_id, action,
                        old_status, new_status,
                        old_plan, new_plan,
                        payment_amount, payment_method,
                        notes
                    ) VALUES (
                        :user_id, :subscription_id, :action::subscription_action,
                        :old_status::subscription_status, 'ACTIVE'::subscription_status,
                        :old_plan::subscription_plan_name, :new_plan::subscription_plan_name,
                        :payment_amount, :payment_method,
                        :notes
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'user_id' => $userId,
                'subscription_id' => $currentSubscription['id'],
                'action' => $action,
                'old_status' => $oldStatus,
                'old_plan' => $oldPlan,
                'new_plan' => $newPlan,
                'payment_amount' => $paymentAmount,
                'payment_method' => $paymentMethod,
                'notes' => $message
            ]);
            
            return [
                'success' => true,
                'message' => $message,
                'old_plan' => $oldPlan,
                'new_plan' => $newPlan,
                'action' => $action
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Get All Subscription Plans
     * 
     * Fetches all available plans with pricing and features
     * Use this to display plan options to users
     * 
     * @return array Array of plan records
     */
    public function getAllPlans() {
        try {
            $sql = "SELECT 
                        id,
                        name::TEXT as name,
                        price,
                        max_buses,
                        features,
                        trial_days,
                        grace_period_days
                    FROM subscription_plans
                    ORDER BY price ASC";
            
            $stmt = $this->db->query($sql);
            $plans = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Convert PostgreSQL array format to PHP arrays
            foreach ($plans as &$plan) {
                if (is_string($plan['features'])) {
                    $plan['features'] = str_replace(['{', '}', '"'], '', $plan['features']);
                    $plan['features'] = explode(',', $plan['features']);
                }
            }
            
            return $plans;
            
        } catch (Exception $e) {
            return [];
        }
    }
    
    /**
     * Get Subscription History
     * 
     * Fetches audit trail of subscription changes for a user
     * 
     * @param string $userId User ID
     * @param int $limit Maximum number of records to return
     * @return array Array of history records
     */
    public function getSubscriptionHistory($userId, $limit = 50) {
        try {
            $sql = "SELECT 
                        id,
                        action::TEXT as action,
                        old_status::TEXT as old_status,
                        new_status::TEXT as new_status,
                        old_plan::TEXT as old_plan,
                        new_plan::TEXT as new_plan,
                        payment_amount,
                        payment_method,
                        notes,
                        created_at
                    FROM subscription_history
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT :limit";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'user_id' => $userId,
                'limit' => $limit
            ]);
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (Exception $e) {
            return [];
        }
    }
}

?>
