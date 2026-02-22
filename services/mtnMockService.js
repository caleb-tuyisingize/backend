/**
 * MTN Mobile Money Mock Service
 * Simulates MTN API responses for development/testing
 * 
 * This mock service provides the same interface as the real MTN service
 * but returns simulated responses, allowing development without MTN credentials.
 * 
 * To switch to real MTN:
 * - Set MTN_USE_MOCK=false in .env
 * - Ensure valid MTN credentials are configured
 */

const { v4: uuidv4 } = require('uuid');

// In-memory storage for mock transactions
const mockTransactions = new Map();
const mockAccounts = new Map();

// Mock test phone numbers with their statuses
const MOCK_PHONE_NUMBERS = {
  '250788123456': { status: 'active', name: 'John Doe', valid: true },
  '250788123457': { status: 'active', name: 'Jane Smith', valid: true },
  '250788123458': { status: 'active', name: 'Bob Johnson', valid: true },
  '250700000000': { status: 'inactive', name: 'Invalid User', valid: false },
};

/**
 * Generate mock access token
 * @returns {Promise<string>} Mock access token
 */
async function generateAccessToken() {
  console.log('🔧 [MOCK] Generating access token...');
  
  // Simulate API delay
  await delay(500);
  
  const mockToken = `mock_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log('✅ [MOCK] Access token generated');
  return mockToken;
}

/**
 * Request payment from customer (Mock)
 * @param {Object} paymentData - Payment request data
 * @returns {Promise<Object>} Payment initiation result
 */
async function requestToPay(paymentData) {
  const {
    amount,
    currency = 'EUR',
    externalId,
    payer,
    payerMessage,
    payeeNote
  } = paymentData;

  console.log('🔧 [MOCK] Processing payment request...');
  console.log('  Amount:', amount, currency);
  console.log('  Phone:', payer.partyId);
  
  // Simulate API delay
  await delay(1000);

  // Generate reference ID if not provided
  const referenceId = externalId || uuidv4();

  // Check if phone number is in our mock database
  const phoneNumber = payer.partyId;
  const account = MOCK_PHONE_NUMBERS[phoneNumber] || { 
    status: 'active', 
    name: 'Mock User', 
    valid: true 
  };

  // Determine payment status based on phone number
  let status = 'SUCCESSFUL';
  let reason = null;

  // Simulate different scenarios
  if (!account.valid) {
    status = 'FAILED';
    reason = 'PAYER_NOT_FOUND';
  } else if (amount > 1000000) {
    status = 'FAILED';
    reason = 'INSUFFICIENT_FUNDS';
  } else if (phoneNumber.endsWith('999')) {
    status = 'PENDING';
  }

  // Store mock transaction
  mockTransactions.set(referenceId, {
    referenceId,
    amount,
    currency,
    externalId,
    payer,
    payerMessage,
    payeeNote,
    status,
    reason,
    createdAt: new Date().toISOString(),
    completedAt: status !== 'PENDING' ? new Date().toISOString() : null
  });

  console.log(`✅ [MOCK] Payment ${status.toLowerCase()}: ${referenceId}`);

  return {
    referenceId,
    status,
    reason
  };
}

/**
 * Check transaction status (Mock)
 * @param {string} referenceId - Transaction reference ID
 * @returns {Promise<Object>} Transaction status
 */
async function checkTransactionStatus(referenceId) {
  console.log('🔧 [MOCK] Checking transaction status:', referenceId);
  
  // Simulate API delay
  await delay(300);

  const transaction = mockTransactions.get(referenceId);

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // If transaction was pending, mark it as successful after some time
  if (transaction.status === 'PENDING') {
    const timeSinceCreation = Date.now() - new Date(transaction.createdAt).getTime();
    if (timeSinceCreation > 5000) { // 5 seconds
      transaction.status = 'SUCCESSFUL';
      transaction.completedAt = new Date().toISOString();
    }
  }

  console.log(`✅ [MOCK] Transaction status: ${transaction.status}`);

  return {
    amount: transaction.amount,
    currency: transaction.currency,
    financialTransactionId: `mock_fin_${Date.now()}`,
    externalId: transaction.externalId,
    payer: transaction.payer,
    payerMessage: transaction.payerMessage,
    payeeNote: transaction.payeeNote,
    status: transaction.status,
    reason: transaction.reason,
    createdAt: transaction.createdAt,
    completedAt: transaction.completedAt
  };
}

/**
 * Validate account holder (Mock)
 * @param {string} accountHolderId - Phone number to validate
 * @param {string} accountHolderIdType - ID type (e.g., 'msisdn')
 * @returns {Promise<Object>} Account validation result
 */
async function validateAccountHolder(accountHolderId, accountHolderIdType = 'msisdn') {
  console.log('🔧 [MOCK] Validating account:', accountHolderId);
  
  // Simulate API delay
  await delay(500);

  const account = MOCK_PHONE_NUMBERS[accountHolderId];

  if (account && account.valid) {
    console.log('✅ [MOCK] Account is valid');
    return {
      result: true,
      accountHolder: {
        name: account.name,
        partyId: accountHolderId,
        partyIdType: accountHolderIdType
      }
    };
  }

  console.log('❌ [MOCK] Account not found or invalid');
  throw new Error('Account not found or invalid');
}

/**
 * Get account balance (Mock)
 * @returns {Promise<Object>} Account balance information
 */
async function getAccountBalance() {
  console.log('🔧 [MOCK] Fetching account balance...');
  
  // Simulate API delay
  await delay(500);

  const balance = {
    availableBalance: '5000000',
    currency: 'EUR'
  };

  console.log('✅ [MOCK] Account balance retrieved');
  return balance;
}

/**
 * Process complete payment flow (Mock)
 * Convenience function that handles the full payment process
 * 
 * @param {Object} paymentData - Payment details
 * @returns {Promise<Object>} Payment result
 */
async function processPayment(paymentData) {
  try {
    console.log('\n🔧 [MOCK] === Starting Mock MTN Payment Process ===\n');

    // Step 1: Generate access token
    await generateAccessToken();

    // Step 2: Request payment
    const paymentResult = await requestToPay(paymentData);

    // Step 3: Check status if needed
    if (paymentResult.status === 'PENDING') {
      console.log('⏳ [MOCK] Payment is pending, will check status...');
      await delay(2000);
      const statusResult = await checkTransactionStatus(paymentResult.referenceId);
      paymentResult.status = statusResult.status;
    }

    console.log('\n✅ [MOCK] === Payment Process Complete ===\n');

    return {
      success: paymentResult.status === 'SUCCESSFUL',
      referenceId: paymentResult.referenceId,
      status: paymentResult.status,
      reason: paymentResult.reason,
      message: paymentResult.status === 'SUCCESSFUL' 
        ? 'Payment processed successfully'
        : `Payment failed: ${paymentResult.reason}`
    };

  } catch (error) {
    console.error('❌ [MOCK] Payment processing error:', error.message);
    throw error;
  }
}

/**
 * Helper function to simulate network delay
 * @param {number} ms - Milliseconds to delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get mock transaction history (for testing)
 * @returns {Array} All mock transactions
 */
function getMockTransactions() {
  return Array.from(mockTransactions.values());
}

/**
 * Clear all mock data (for testing)
 */
function clearMockData() {
  mockTransactions.clear();
  mockAccounts.clear();
  console.log('🔧 [MOCK] Mock data cleared');
}

module.exports = {
  generateAccessToken,
  requestToPay,
  checkTransactionStatus,
  validateAccountHolder,
  getAccountBalance,
  processPayment,
  getMockTransactions,
  clearMockData,
  MOCK_PHONE_NUMBERS
};
