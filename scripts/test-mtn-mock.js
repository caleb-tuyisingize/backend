/**
 * Test MTN Mock Service
 * Demonstrates the mock payment flow
 */

require('dotenv').config();
const mtnService = require('../services/mtnMobileMoneyService');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║       MTN Mobile Money Mock Service Test                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

async function runMockTests() {
  try {
    // Test 1: Generate Access Token
    console.log('\n📝 Test 1: Generate Access Token');
    console.log('─────────────────────────────────────────────────\n');
    const token = await mtnService.generateAccessToken();
    console.log('Token:', token.substring(0, 30) + '...\n');

    // Test 2: Validate Phone Number
    console.log('\n📝 Test 2: Validate Phone Number');
    console.log('─────────────────────────────────────────────────\n');
    try {
      const validation = await mtnService.validateAccountHolder('250788123456', 'msisdn');
      console.log('✅ Phone validation result:', validation);
    } catch (error) {
      console.log('❌ Phone validation failed:', error.message);
    }

    // Test 3: Successful Payment
    console.log('\n📝 Test 3: Process Successful Payment');
    console.log('─────────────────────────────────────────────────\n');
    const paymentData1 = {
      amount: 50000,
      currency: 'EUR',
      externalId: `ticket_${Date.now()}`,
      payer: {
        partyIdType: 'MSISDN',
        partyId: '250788123456'
      },
      payerMessage: 'Payment for bus ticket',
      payeeNote: 'SafariTix booking payment'
    };
    
    const result1 = await mtnService.processPayment(paymentData1);
    console.log('Payment Result:', result1);

    // Test 4: Check Transaction Status
    console.log('\n📝 Test 4: Check Transaction Status');
    console.log('─────────────────────────────────────────────────\n');
    const status = await mtnService.checkTransactionStatus(result1.referenceId);
    console.log('Transaction Status:', status.status);
    console.log('Amount:', status.amount, status.currency);

    // Test 5: Failed Payment (Invalid Account)
    console.log('\n📝 Test 5: Test Failed Payment (Invalid Account)');
    console.log('─────────────────────────────────────────────────\n');
    const paymentData2 = {
      amount: 50000,
      currency: 'EUR',
      externalId: `ticket_${Date.now()}`,
      payer: {
        partyIdType: 'MSISDN',
        partyId: '250700000000' // Invalid account
      },
      payerMessage: 'Payment for bus ticket',
      payeeNote: 'SafariTix booking payment'
    };
    
    const result2 = await mtnService.processPayment(paymentData2);
    console.log('Payment Result:', result2);

    // Test 6: Get Account Balance
    console.log('\n📝 Test 6: Get Account Balance');
    console.log('─────────────────────────────────────────────────\n');
    const balance = await mtnService.getAccountBalance();
    console.log('Balance:', balance.availableBalance, balance.currency);

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Test Summary                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('✅ All mock service tests completed successfully!');
    console.log('\n📌 Mock Test Phone Numbers:');
    console.log('   • 250788123456 - Valid account (John Doe)');
    console.log('   • 250788123457 - Valid account (Jane Smith)');
    console.log('   • 250788123458 - Valid account (Bob Johnson)');
    console.log('   • 250700000000 - Invalid account (will fail)');
    console.log('   • Any ending in 999 - Will be pending');
    console.log('\n📌 To switch to real MTN API:');
    console.log('   1. Set MTN_USE_MOCK=false in .env');
    console.log('   2. Ensure valid MTN credentials are configured');
    console.log('   3. Subscribe to required products in MTN Portal\n');

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error);
  }
}

console.log('Mock Mode:', process.env.MTN_USE_MOCK === 'true' ? 'ENABLED ✅' : 'DISABLED');
console.log('\nStarting tests...\n');

runMockTests().catch(console.error);
