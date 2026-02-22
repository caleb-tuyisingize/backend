/**
 * MTN Credentials Verification Script
 * Tests different endpoints to diagnose the exact issue
 */

require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SUBSCRIPTION_KEY = process.env.MTN_CONSUMER_KEY;

console.log('\n🔍 MTN Credentials Verification\n');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('Subscription Key:', SUBSCRIPTION_KEY?.substring(0, 10) + '...');
console.log('Environment:', process.env.MTN_ENV || 'sandbox');
console.log('\n═══════════════════════════════════════════════════════════\n');

async function testEndpoint(name, config) {
  try {
    console.log(`Testing: ${name}...`);
    const response = await axios(config);
    console.log(`✅ ${name} - Status: ${response.status}`);
    if (response.data) {
      console.log('   Response:', JSON.stringify(response.data).substring(0, 100));
    }
    return true;
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${name} - Status: ${error.response.status}`);
      console.log('   Error:', error.response.data);
    } else {
      console.log(`❌ ${name} - ${error.message}`);
    }
    return false;
  }
}

async function runTests() {
  console.log('Test 1: Check Collections API Subscription');
  console.log('─────────────────────────────────────────────────\n');
  
  // Test creating API user with different configurations
  const apiUser = uuidv4();
  
  await testEndpoint('Create API User (Standard)', {
    method: 'POST',
    url: 'https://sandbox.momodeveloper.mtn.com/v1_0/apiuser',
    headers: {
      'Content-Type': 'application/json',
      'X-Reference-Id': apiUser,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
    },
    data: {
      providerCallbackHost: 'webhook.site'
    },
    validateStatus: () => true
  });

  console.log('\n─────────────────────────────────────────────────\n');
  console.log('Test 2: Check if user was created\n');

  await testEndpoint('Get API User Info', {
    method: 'GET',
    url: `https://sandbox.momodeveloper.mtn.com/v1_0/apiuser/${apiUser}`,
    headers: {
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
    },
    validateStatus: () => true
  });

  console.log('\n─────────────────────────────────────────────────\n');
  console.log('Test 3: Try alternative callback host\n');

  const apiUser2 = uuidv4();
  await testEndpoint('Create API User (Alt Host)', {
    method: 'POST',
    url: 'https://sandbox.momodeveloper.mtn.com/v1_0/apiuser',
    headers: {
      'Content-Type': 'application/json',
      'X-Reference-Id': apiUser2,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
    },
    data: {
      providerCallbackHost: 'example.com'
    },
    validateStatus: () => true
  });

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('💡 TROUBLESHOOTING TIPS:\n');
  console.log('1. Verify you subscribed to BOTH products in MTN Portal:');
  console.log('   - Collections (for receiving payments)');
  console.log('   - User Provisioning (for creating API users)');
  console.log('\n2. Check if your subscription is for Sandbox environment');
  console.log('\n3. Your subscription key should be from the "Collections" product');
  console.log('\n4. If status is 401: Invalid subscription key');
  console.log('   If status is 403: Not subscribed to required product');
  console.log('   If status is 409: User already exists (not an error)');
  console.log('   If status is 201: Success!\n');
  console.log('═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
