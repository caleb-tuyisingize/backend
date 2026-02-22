/**
 * MTN Payment Integration Test
 * 
 * This script tests the MTN Mobile Money payment service
 * Run with: node scripts/test-mtn-integration.js
 */

// Load environment variables
require('dotenv').config();

const mtnService = require('../services/mtnMobileMoneyService');

async function testMTNIntegration() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║         MTN Mobile Money Integration Test                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Test 1: Generate Access Token
    console.log('Test 1: Generate Access Token');
    console.log('─────────────────────────────────────────────────────────\n');
    
    try {
      const token = await mtnService.generateAccessToken();
      console.log('✅ Access token generated successfully');
      console.log(`   Token preview: ${token.substring(0, 20)}...\n`);
    } catch (error) {
      console.error('❌ Failed to generate token:', error.message);
      console.log('\n💡 Make sure your MTN credentials are set in .env file\n');
      return;
    }

    // Test 2: Validate Phone Number
    console.log('Test 2: Validate Phone Number');
    console.log('─────────────────────────────────────────────────────────\n');
    
    const testPhoneNumber = '250788123456';
    
    try {
      const validation = await mtnService.validateAccountHolder(testPhoneNumber);
      if (validation.isActive) {
        console.log(`✅ Phone number ${testPhoneNumber} is valid and active\n`);
      } else {
        console.log(`⚠️  Phone number ${testPhoneNumber} is not registered\n`);
      }
    } catch (error) {
      console.error('❌ Validation failed:', error.message, '\n');
    }

    // Test 3: Request to Pay
    console.log('Test 3: Initiate Payment Request');
    console.log('─────────────────────────────────────────────────────────\n');
    
    const paymentData = {
      amount: 5000,
      currency: 'RWF',
      phoneNumber: testPhoneNumber,
      externalId: `TEST-${Date.now()}`,
      payerMessage: 'SafariTix Test Payment',
      payeeNote: 'Test ticket booking'
    };
    
    console.log('Payment Details:');
    console.log(`  Amount: ${paymentData.amount} ${paymentData.currency}`);
    console.log(`  Phone: ${paymentData.phoneNumber}`);
    console.log(`  Reference: ${paymentData.externalId}\n`);
    
    try {
      const paymentResult = await mtnService.requestToPay(paymentData);
      
      if (paymentResult.success) {
        console.log('✅ Payment request initiated successfully');
        console.log(`   Reference ID: ${paymentResult.referenceId}`);
        console.log(`   Status: ${paymentResult.status}`);
        console.log(`   Message: ${paymentResult.message}\n`);
        
        // Test 4: Check Payment Status
        console.log('Test 4: Check Payment Status');
        console.log('─────────────────────────────────────────────────────────\n');
        console.log('⏳ Waiting 5 seconds before checking status...\n');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          const statusResult = await mtnService.checkTransactionStatus(paymentResult.referenceId);
          
          console.log('Payment Status:');
          console.log(`  Status: ${statusResult.status}`);
          console.log(`  Amount: ${statusResult.amount} ${statusResult.currency}`);
          
          if (statusResult.financialTransactionId) {
            console.log(`  Transaction ID: ${statusResult.financialTransactionId}`);
          }
          
          if (statusResult.status === 'PENDING') {
            console.log('\n💡 Payment is still pending. In sandbox, this is expected.');
            console.log('   In production, user would approve on their phone.\n');
          } else if (statusResult.status === 'SUCCESSFUL') {
            console.log('\n✅ Payment completed successfully!\n');
          } else if (statusResult.status === 'FAILED') {
            console.log(`\n❌ Payment failed. Reason: ${statusResult.reason}\n`);
          }
          
        } catch (error) {
          console.error('❌ Status check failed:', error.message, '\n');
        }
        
      } else {
        console.error('❌ Payment request failed\n');
      }
      
    } catch (error) {
      console.error('❌ Payment request failed:', error.message);
      
      if (error.message.includes('credentials')) {
        console.log('\n💡 TIP: Update your .env file with valid MTN credentials');
        console.log('   Run: node scripts/create-mtn-sandbox-user.js\n');
      }
    }

    // Test 5: Get Account Balance (Optional)
    console.log('\nTest 5: Get Account Balance');
    console.log('─────────────────────────────────────────────────────────\n');
    
    try {
      const balance = await mtnService.getAccountBalance();
      console.log('✅ Account Balance Retrieved:');
      console.log(`   Available: ${balance.availableBalance} ${balance.currency}\n`);
    } catch (error) {
      console.log('⚠️  Balance check not available (sandbox limitation)\n');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                   Test Completed                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log('Next Steps:');
  console.log('1. If tests passed, your MTN integration is ready!');
  console.log('2. Update your frontend to use the new payment endpoints');
  console.log('3. Test the complete flow: Frontend → Backend → MTN API');
  console.log('4. Read MTN_MOBILE_MONEY_GUIDE.md for detailed documentation\n');
}

// Run the test
testMTNIntegration().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
