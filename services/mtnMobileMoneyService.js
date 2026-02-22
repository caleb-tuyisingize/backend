/**
 * MTN Mobile Money Payment Service
 * Integrates with MTN Mobile Money API for payment processing
 * Supports both Sandbox and Production environments
 * 
 * Set MTN_USE_MOCK=true in .env to use mock service for testing
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Check if mock mode is enabled
const USE_MOCK = process.env.MTN_USE_MOCK === 'true';

// If mock mode is enabled, use mock service
if (USE_MOCK) {
  console.log('⚠️  MTN Mock Mode Enabled - Using simulated responses');
  module.exports = require('./mtnMockService');
  return;
}

// MTN API Configuration
const MTN_CONFIG = {
  // Sandbox environment URLs
  SANDBOX_BASE_URL: 'https://sandbox.momodeveloper.mtn.com',
  SANDBOX_COLLECTION_URL: 'https://sandbox.momodeveloper.mtn.com/collection',
  
  // Production environment URLs
  PRODUCTION_BASE_URL: 'https://momodeveloper.mtn.com',
  PRODUCTION_COLLECTION_URL: 'https://momodeveloper.mtn.com/collection',
  
  // API version
  API_VERSION: 'v1_0',
  
  // Target environment (can be 'sandbox' or 'production')
  TARGET_ENVIRONMENT: process.env.MTN_ENV || 'sandbox',
};

/**
 * Get the base URL based on environment
 * @returns {string} Base URL for MTN API
 */
function getBaseUrl() {
  return MTN_CONFIG.TARGET_ENVIRONMENT === 'production'
    ? MTN_CONFIG.PRODUCTION_COLLECTION_URL
    : MTN_CONFIG.SANDBOX_COLLECTION_URL;
}

/**
 * Get OAuth access token from MTN API
 * Required for authenticating API requests
 * 
 * @returns {Promise<string>} Access token
 * @throws {Error} If token generation fails
 */
async function generateAccessToken() {
  try {
    const consumerKey = process.env.MTN_CONSUMER_KEY;
    const consumerSecret = process.env.MTN_CONSUMER_SECRET;
    const apiUser = process.env.MTN_API_USER;

    // Validate required environment variables
    if (!consumerKey || !consumerSecret || !apiUser) {
      throw new Error('Missing MTN API credentials. Check environment variables: MTN_CONSUMER_KEY, MTN_CONSUMER_SECRET, MTN_API_USER');
    }

    // Create Basic Auth credentials
    const authString = Buffer.from(`${apiUser}:${consumerSecret}`).toString('base64');

    // Request access token with retry logic
    const response = await axios.post(
      `${getBaseUrl()}/${MTN_CONFIG.API_VERSION}/token/`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authString}`,
          'Ocp-Apim-Subscription-Key': consumerKey,
        },
        timeout: 30000, // 30 second timeout (MTN can be slow)
      }
    );

    if (!response.data || !response.data.access_token) {
      throw new Error('Invalid token response from MTN API');
    }

    console.log('✅ MTN Access Token generated successfully');
    return response.data.access_token;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('❌ MTN API Timeout: The request took too long. MTN Sandbox may be experiencing issues.');
    } else if (error.response) {
      console.error('❌ MTN API Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ MTN Token Generation Error:', error.message);
    }
    
    // Provide more specific error messages
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        throw new Error('MTN API authentication failed. Check your API credentials.');
      } else if (status === 403) {
        throw new Error('MTN API access forbidden. Verify your subscription key.');
      }
    }
    
    throw new Error(`Failed to generate MTN access token: ${error.message}`);
  }
}

/**
 * Request to Pay - Initiate a payment request to MTN Mobile Money
 * This is the main function for processing payments
 * 
 * @param {Object} paymentData - Payment details
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.currency - Currency code (e.g., 'RWF')
 * @param {string} paymentData.phoneNumber - Payer's phone number (without +)
 * @param {string} paymentData.externalId - Unique transaction ID (e.g., ticket ID)
 * @param {string} paymentData.payerMessage - Message to payer (optional)
 * @param {string} paymentData.payeeNote - Note for payee (optional)
 * 
 * @returns {Promise<Object>} Payment response with referenceId and status
 * @throws {Error} If payment request fails
 */
async function requestToPay(paymentData) {
  try {
    // Validate required fields
    const { amount, currency, phoneNumber, externalId } = paymentData;
    
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount. Amount must be greater than 0.');
    }
    
    if (!currency) {
      throw new Error('Currency is required.');
    }
    
    if (!phoneNumber) {
      throw new Error('Phone number is required.');
    }
    
    if (!externalId) {
      throw new Error('External ID (transaction reference) is required.');
    }

    // Generate unique reference ID for this transaction
    const referenceId = uuidv4();
    
    // Get access token
    const accessToken = await generateAccessToken();
    
    // Format phone number (remove + and spaces)
    const formattedPhone = phoneNumber.replace(/[\s+]/g, '');
    
    // Prepare payment request payload
    const requestBody = {
      amount: amount.toString(),
      currency: currency,
      externalId: externalId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: formattedPhone,
      },
      payerMessage: paymentData.payerMessage || 'SafariTix Bus Ticket Payment',
      payeeNote: paymentData.payeeNote || `Payment for ticket ${externalId}`,
    };

    console.log('📤 Sending MTN Request-to-Pay:', {
      referenceId,
      amount: requestBody.amount,
      currency: requestBody.currency,
      phone: `***${formattedPhone.slice(-4)}`, // Log last 4 digits only
    });

    // Send request-to-pay to MTN API
    const response = await axios.post(
      `${getBaseUrl()}/${MTN_CONFIG.API_VERSION}/requesttopay`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': MTN_CONFIG.TARGET_ENVIRONMENT,
          'Ocp-Apim-Subscription-Key': process.env.MTN_CONSUMER_KEY,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    // MTN API returns 202 Accepted for successful request initiation
    if (response.status === 202) {
      console.log('✅ MTN Request-to-Pay initiated successfully');
      
      return {
        success: true,
        referenceId: referenceId,
        status: 'PENDING',
        message: 'Payment request sent successfully. Waiting for customer approval.',
        externalId: externalId,
      };
    }

    // Unexpected status code
    throw new Error(`Unexpected response status: ${response.status}`);
    
  } catch (error) {
    console.error('❌ MTN Request-to-Pay Error:', error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 400) {
        throw new Error(`Invalid request: ${errorData?.message || 'Bad request to MTN API'}`);
      } else if (status === 409) {
        throw new Error('Duplicate transaction. This payment request already exists.');
      } else if (status === 500) {
        throw new Error('MTN API server error. Please try again later.');
      }
    }
    
    throw new Error(`Payment request failed: ${error.message}`);
  }
}

/**
 * Check the status of a payment transaction
 * Use this to verify if a payment was successful
 * 
 * @param {string} referenceId - The reference ID from requestToPay
 * @returns {Promise<Object>} Transaction status
 * @throws {Error} If status check fails
 */
async function checkTransactionStatus(referenceId) {
  try {
    if (!referenceId) {
      throw new Error('Reference ID is required to check transaction status.');
    }

    // Get access token
    const accessToken = await generateAccessToken();

    console.log('🔍 Checking MTN transaction status:', referenceId);

    // Query transaction status
    const response = await axios.get(
      `${getBaseUrl()}/${MTN_CONFIG.API_VERSION}/requesttopay/${referenceId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Target-Environment': MTN_CONFIG.TARGET_ENVIRONMENT,
          'Ocp-Apim-Subscription-Key': process.env.MTN_CONSUMER_KEY,
        },
        timeout: 10000,
      }
    );

    const data = response.data;
    
    console.log('📊 Transaction Status:', {
      referenceId,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
    });

    return {
      success: true,
      referenceId: referenceId,
      status: data.status, // PENDING, SUCCESSFUL, or FAILED
      amount: data.amount,
      currency: data.currency,
      financialTransactionId: data.financialTransactionId,
      externalId: data.externalId,
      reason: data.reason, // Present if status is FAILED
    };
    
  } catch (error) {
    console.error('❌ MTN Status Check Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      throw new Error('Transaction not found. Invalid reference ID.');
    }
    
    throw new Error(`Failed to check transaction status: ${error.message}`);
  }
}

/**
 * Get account balance (for monitoring purposes)
 * This can be used to check your MTN MoMo collection account balance
 * 
 * @returns {Promise<Object>} Account balance information
 * @throws {Error} If balance check fails
 */
async function getAccountBalance() {
  try {
    const accessToken = await generateAccessToken();

    const response = await axios.get(
      `${getBaseUrl()}/${MTN_CONFIG.API_VERSION}/account/balance`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Target-Environment': MTN_CONFIG.TARGET_ENVIRONMENT,
          'Ocp-Apim-Subscription-Key': process.env.MTN_CONSUMER_KEY,
        },
        timeout: 10000,
      }
    );

    return {
      success: true,
      availableBalance: response.data.availableBalance,
      currency: response.data.currency,
    };
    
  } catch (error) {
    console.error('❌ MTN Balance Check Error:', error.response?.data || error.message);
    throw new Error(`Failed to get account balance: ${error.message}`);
  }
}

/**
 * Validate account holder (optional - check if phone number is registered)
 * This can be used to verify customer phone number before initiating payment
 * 
 * @param {string} phoneNumber - Phone number to validate
 * @param {string} accountHolderIdType - Type of account holder ID (default: 'msisdn')
 * @returns {Promise<Object>} Validation result
 * @throws {Error} If validation fails
 */
async function validateAccountHolder(phoneNumber, accountHolderIdType = 'msisdn') {
  try {
    if (!phoneNumber) {
      throw new Error('Phone number is required for validation.');
    }

    const accessToken = await generateAccessToken();
    const formattedPhone = phoneNumber.replace(/[\s+]/g, '');

    const response = await axios.get(
      `${getBaseUrl()}/${MTN_CONFIG.API_VERSION}/accountholder/${accountHolderIdType}/${formattedPhone}/active`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Target-Environment': MTN_CONFIG.TARGET_ENVIRONMENT,
          'Ocp-Apim-Subscription-Key': process.env.MTN_CONSUMER_KEY,
        },
        timeout: 10000,
      }
    );

    return {
      success: true,
      isActive: response.data.result === true,
      phoneNumber: formattedPhone,
    };
    
  } catch (error) {
    console.error('❌ MTN Account Validation Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return {
        success: false,
        isActive: false,
        phoneNumber: phoneNumber,
        message: 'Phone number not registered with MTN Mobile Money',
      };
    }
    
    throw new Error(`Account validation failed: ${error.message}`);
  }
}

/**
 * Process a complete payment flow
 * Convenience function that handles the full payment process
 * 
 * @param {Object} paymentData - Payment details
 * @returns {Promise<Object>} Payment result
 */
async function processPayment(paymentData) {
  try {
    // Step 1: Validate phone number (optional but recommended)
    console.log('🔍 Step 1: Validating phone number...');
    const validation = await validateAccountHolder(paymentData.phoneNumber);
    
    if (!validation.isActive) {
      return {
        success: false,
        error: 'Phone number is not registered with MTN Mobile Money',
        status: 'FAILED',
      };
    }

    // Step 2: Initiate payment request
    console.log('💳 Step 2: Initiating payment request...');
    const paymentRequest = await requestToPay(paymentData);

    // Step 3: Return result (frontend will poll for status)
    return {
      success: true,
      referenceId: paymentRequest.referenceId,
      status: paymentRequest.status,
      message: 'Payment request sent. Customer needs to approve on their phone.',
      externalId: paymentRequest.externalId,
    };
    
  } catch (error) {
    console.error('❌ Payment Processing Error:', error.message);
    
    return {
      success: false,
      error: error.message,
      status: 'FAILED',
    };
  }
}

// Export all functions
module.exports = {
  generateAccessToken,
  requestToPay,
  checkTransactionStatus,
  getAccountBalance,
  validateAccountHolder,
  processPayment,
};
