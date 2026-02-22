/**
 * Simple MTN Connectivity Test
 * Tests basic connection to MTN API without full authentication
 */

require('dotenv').config();
const axios = require('axios');

async function testConnectivity() {
  console.log('\n🔍 Testing MTN API Connectivity...\n');
  
  console.log('Environment Variables:');
  console.log('  MTN_CONSUMER_KEY:', process.env.MTN_CONSUMER_KEY ? '✓ Set' : '✗ Missing');
  console.log('  MTN_CONSUMER_SECRET:', process.env.MTN_CONSUMER_SECRET ? '✓ Set' : '✗ Missing');
  console.log('  MTN_API_USER:', process.env.MTN_API_USER ? '✓ Set' : '✗ Missing');
  console.log('  MTN_ENV:', process.env.MTN_ENV || 'sandbox');
  console.log();

  // Test 1: Basic connectivity to MTN sandbox
  try {
    console.log('Test 1: Checking MTN Sandbox availability...');
    const response = await axios.get('https://sandbox.momodeveloper.mtn.com', {
      timeout: 5000,
      validateStatus: () => true // Accept any status
    });
    console.log('✅ MTN Sandbox is reachable\n');
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.log('❌ Cannot reach MTN Sandbox. Check your internet connection.\n');
      return;
    }
    console.log('⚠️  Connection issue:', error.message, '\n');
  }

  // Test 2: Try to get token with detailed error info
  try {
    console.log('Test 2: Attempting OAuth token generation...');
    
    const consumerKey = process.env.MTN_CONSUMER_KEY;
    const consumerSecret = process.env.MTN_CONSUMER_SECRET;
    const apiUser = process.env.MTN_API_USER;

    const authString = Buffer.from(`${apiUser}:${consumerSecret}`).toString('base64');

    console.log('  Using credentials:');
    console.log('    API User:', apiUser);
    console.log('    Auth String:', authString.substring(0, 20) + '...');
    console.log();

    const response = await axios.post(
      'https://sandbox.momodeveloper.mtn.com/collection/v1_0/token/',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authString}`,
          'Ocp-Apim-Subscription-Key': consumerKey,
        },
        timeout: 10000,
      }
    );

    console.log('✅ Token generated successfully!');
    console.log('   Access Token:', response.data.access_token.substring(0, 30) + '...');
    console.log();
    console.log('🎉 Your MTN integration is working!\n');

  } catch (error) {
    if (error.response) {
      console.log('❌ MTN API Error:');
      console.log('   Status:', error.response.status);
      console.log('   Status Text:', error.response.statusText);
      console.log('   Response:', JSON.stringify(error.response.data, null, 2));
      console.log();

      if (error.response.status === 401) {
        console.log('💡 SOLUTION: Your API credentials are invalid.');
        console.log('   The API User or API Secret might be incorrect.');
        console.log('   Try running: node scripts/create-mtn-sandbox-user.js\n');
      } else if (error.response.status === 403) {
        console.log('💡 SOLUTION: Access forbidden.');
        console.log('   Your Subscription Key (Consumer Key) might be invalid.');
        console.log('   Check your subscription in MTN Developer Portal.\n');
      } else if (error.response.status === 404) {
        console.log('💡 SOLUTION: Endpoint not found.');
        console.log('   The API User might not exist in MTN\'s system.');
        console.log('   Create a new one: node scripts/create-mtn-sandbox-user.js\n');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.log('❌ Request timeout. MTN API is slow or unavailable.');
      console.log('   Try again in a few moments.\n');
    } else {
      console.log('❌ Error:', error.message);
      console.log();
    }
  }

  console.log('────────────────────────────────────────────────────');
  console.log('For detailed setup guide, see: MTN_MOBILE_MONEY_GUIDE.md\n');
}

testConnectivity().catch(console.error);
