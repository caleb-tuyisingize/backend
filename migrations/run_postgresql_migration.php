<?php
/**
 * =====================================================
 * PostgreSQL Migration Runner (No psql needed!)
 * =====================================================
 * 
 * This script runs the PostgreSQL migration using PHP PDO
 * Use this if you don't have psql in your PATH
 * 
 * Usage: php migrations/run_postgresql_migration.php
 */

echo "\n";
echo "========================================\n";
echo "SafariTix PostgreSQL Migration Runner\n";
echo "========================================\n\n";

// PostgreSQL connection settings
$host = 'localhost';
$port = '5432';
$dbname = 'safatitix';
$user = 'postgres';
$password = 'postgres';  // Change this to your password

echo "Connecting to PostgreSQL...\n";
echo "Host: {$host}:{$port}\n";
echo "Database: {$dbname}\n";
echo "User: {$user}\n\n";

try {
    // Connect to PostgreSQL
    $pdo = new PDO(
        "pgsql:host=$host;port=$port;dbname=$dbname",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
    
    echo "✓ Connected successfully!\n\n";
    
    // Read the migration file
    $migrationFile = __DIR__ . '/create-subscriptions-table-postgresql.sql';
    
    if (!file_exists($migrationFile)) {
        throw new Exception("Migration file not found: {$migrationFile}");
    }
    
    echo "Reading migration file...\n";
    $sql = file_get_contents($migrationFile);
    
    if ($sql === false) {
        throw new Exception("Failed to read migration file");
    }
    
    echo "✓ Migration file loaded (" . strlen($sql) . " bytes)\n\n";
    
    // Start transaction
    echo "Starting migration...\n";
    $pdo->beginTransaction();
    
    // Execute the migration
    // Note: PDO doesn't support multiple statements in one exec()
    // We need to split by semicolons and execute each statement
    
    // Remove comments and split by semicolons
    $statements = [];
    $lines = explode("\n", $sql);
    $currentStatement = '';
    $inFunction = false;
    
    foreach ($lines as $line) {
        $trimmed = trim($line);
        
        // Skip empty lines and comments
        if ($trimmed === '' || strpos($trimmed, '--') === 0) {
            continue;
        }
        
        // Track if we're inside a function definition
        if (stripos($trimmed, 'CREATE OR REPLACE FUNCTION') !== false || 
            stripos($trimmed, 'CREATE FUNCTION') !== false) {
            $inFunction = true;
        }
        
        $currentStatement .= $line . "\n";
        
        // Check for statement end
        if (strpos($trimmed, ';') !== false) {
            // If in function, only end when we see $$ LANGUAGE
            if ($inFunction) {
                if (stripos($trimmed, '$$ LANGUAGE') !== false || 
                    stripos($trimmed, '$$;') !== false) {
                    $statements[] = trim($currentStatement);
                    $currentStatement = '';
                    $inFunction = false;
                }
            } else {
                // Regular statement - split at semicolon
                $parts = explode(';', $currentStatement);
                foreach ($parts as $part) {
                    $part = trim($part);
                    if ($part !== '') {
                        $statements[] = $part;
                    }
                }
                $currentStatement = '';
            }
        }
    }
    
    // Add any remaining statement
    if (trim($currentStatement) !== '') {
        $statements[] = trim($currentStatement);
    }
    
    echo "Found " . count($statements) . " SQL statements to execute\n\n";
    
    $executed = 0;
    $errors = 0;
    
    foreach ($statements as $index => $statement) {
        try {
            // Skip empty statements
            if (trim($statement) === '') {
                continue;
            }
            
            // Show progress for long migrations
            if (strlen($statement) > 100) {
                $preview = substr($statement, 0, 60) . '...';
            } else {
                $preview = $statement;
            }
            
            echo "Executing statement " . ($index + 1) . "...\n";
            // echo "  Preview: " . str_replace("\n", " ", $preview) . "\n";
            
            $pdo->exec($statement);
            $executed++;
            echo "  ✓ Success\n";
            
        } catch (PDOException $e) {
            // Some errors are acceptable (like "type already exists")
            $errorMsg = $e->getMessage();
            
            if (strpos($errorMsg, 'already exists') !== false) {
                echo "  ⚠ Warning: " . $errorMsg . "\n";
            } else {
                echo "  ✗ Error: " . $errorMsg . "\n";
                $errors++;
            }
        }
    }
    
    echo "\n";
    
    // Commit transaction
    if ($errors === 0) {
        $pdo->commit();
        echo "✓ Migration completed successfully!\n";
        echo "Executed {$executed} statements\n\n";
    } else {
        $pdo->rollBack();
        echo "✗ Migration failed with {$errors} error(s)\n";
        echo "Transaction rolled back\n\n";
        exit(1);
    }
    
    // Verify tables were created
    echo "Verifying tables...\n";
    
    $tables = ['subscription_plans', 'subscriptions', 'subscription_history'];
    foreach ($tables as $table) {
        $stmt = $pdo->query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table')");
        $exists = $stmt->fetchColumn();
        
        if ($exists) {
            echo "  ✓ Table '{$table}' exists\n";
        } else {
            echo "  ✗ Table '{$table}' NOT found\n";
        }
    }
    
    echo "\n";
    
    // Verify types were created
    echo "Verifying custom types...\n";
    
    $types = ['subscription_plan_name', 'subscription_status', 'subscription_action'];
    foreach ($types as $type) {
        $stmt = $pdo->query("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = '$type')");
        $exists = $stmt->fetchColumn();
        
        if ($exists) {
            echo "  ✓ Type '{$type}' exists\n";
        } else {
            echo "  ✗ Type '{$type}' NOT found\n";
        }
    }
    
    echo "\n";
    
    // Check how many plans were created
    echo "Checking subscription plans...\n";
    $stmt = $pdo->query("SELECT COUNT(*) FROM subscription_plans");
    $planCount = $stmt->fetchColumn();
    
    if ($planCount == 3) {
        echo "  ✓ All 3 subscription plans created\n";
        
        // Show the plans
        $stmt = $pdo->query("SELECT name::TEXT, price, max_buses FROM subscription_plans ORDER BY price");
        $plans = $stmt->fetchAll();
        
        foreach ($plans as $plan) {
            echo "    - {$plan['name']}: RWF " . number_format($plan['price']);
            echo " (Max buses: " . ($plan['max_buses'] ?? 'Unlimited') . ")\n";
        }
    } else {
        echo "  ⚠ Warning: Found {$planCount} plans (expected 3)\n";
    }
    
    echo "\n";
    echo "========================================\n";
    echo "✓✓✓ MIGRATION SUCCESSFUL! ✓✓✓\n";
    echo "========================================\n";
    echo "\nNext step: Run test script\n";
    echo "php php/test_subscription_system_postgresql.php\n\n";
    
    exit(0);
    
} catch (PDOException $e) {
    echo "\n✗✗✗ DATABASE CONNECTION FAILED ✗✗✗\n";
    echo "Error: {$e->getMessage()}\n\n";
    echo "Common solutions:\n";
    echo "1. Check PostgreSQL is running\n";
    echo "2. Verify database 'safatitix' exists:\n";
    echo "   - Open pgAdmin\n";
    echo "   - Or run: CREATE DATABASE safatitix;\n";
    echo "3. Check username/password in this script (line 17-18)\n";
    echo "4. Verify host/port settings (line 15-16)\n\n";
    exit(1);
    
} catch (Exception $e) {
    echo "\n✗✗✗ ERROR ✗✗✗\n";
    echo "Error: {$e->getMessage()}\n";
    echo "File: {$e->getFile()}\n";
    echo "Line: {$e->getLine()}\n\n";
    exit(1);
}

?>
