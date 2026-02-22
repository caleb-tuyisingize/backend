<?php
/**
 * =====================================================
 * PostgreSQL Database Connection Pool
 * =====================================================
 * 
 * This file establishes a PDO connection to PostgreSQL
 * Used by SubscriptionManager and other backend services
 * 
 * Make sure to update the connection settings below!
 */

// PostgreSQL Connection Settings
$host = 'localhost';          // Database host (usually localhost)
$port = '5432';               // PostgreSQL default port
$dbname = 'safatitix';        // Your database name
$user = 'postgres';           // PostgreSQL username
$password = 'postgres';       // ⚠️ CHANGE THIS to your actual password!

try {
    // Create PDO connection to PostgreSQL
    $pgPool = new PDO(
        "pgsql:host=$host;port=$port;dbname=$dbname",
        $user,
        $password,
        [
            // Throw exceptions on errors (easier debugging)
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            
            // Return associative arrays by default
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            
            // Don't emulate prepares (better for PostgreSQL)
            PDO::ATTR_EMULATE_PREPARES => false,
            
            // Use persistent connections (better performance)
            PDO::ATTR_PERSISTENT => true
        ]
    );
    
    // Test connection
    $pgPool->query('SELECT NOW()');
    
    // Connection successful!
    // You can uncomment this for debugging:
    // error_log("PostgreSQL connected: {$dbname}@{$host}:{$port}");
    
} catch (PDOException $e) {
    // Connection failed - log error and die
    error_log("PostgreSQL Connection Failed: " . $e->getMessage());
    
    // Show user-friendly error
    die(json_encode([
        'error' => 'Database connection failed',
        'message' => 'Unable to connect to database. Please check server configuration.',
        'debug' => $e->getMessage() // Remove this in production!
    ]));
}

?>
