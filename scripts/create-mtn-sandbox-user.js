/**
 * MTN Sandbox User Creation Script
 * 
 * This script creates an API User and API Key for MTN Mobile Money Sandbox testing.
 * 
 * PREREQUISITES:
 * 1. Sign up at https://momodeveloper.mtn.com/
 * 2. Subscribe to the "Collections" product to get your Subscription Key (Consumer Key)
 * 3. Update the SUBSCRIPTION_KEY below with your actual key
 * 
 * USAGE:
 * node scripts/create-mtn-sandbox-user.js
 * 
 * The script will output your API_USER and API_KEY which you should add to your .env file
 */

// Load environment variables
require('dotenv').config();

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// ====================================
// CONFIGURATION - UPDATE THIS!
// ====================================
const SUBSCRIPTION_KEY = process.env.MTN_CONSUMER_KEY || '2o5vuVRAkJIrPkL6IraDZJAyrS6XX4eY'; // Your MTN Ocp-Apim-Subscription-Key
const CALLBACK_HOST = 'webhook.site'; // Any valid host (not used in testing)

// ====================================
// SCRIPT - DO NOT MODIFY BELOW
// ====================================

const SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

async function createSandboxUser() {
  try {
    // Generate a unique API User UUID
    const apiUser = uuidv4();
    
    console.log('\n📝 Creating MTN Sandbox API User...\n');
    console.log('Generated API User ID:', apiUser);
    console.log('Callback Host:', CALLBACK_HOST);
    console.log('Subscription Key:', SUBSCRIPTION_KEY.substring(0, 10) + '...');
    console.log('\n⏳ Please wait...\n');

    // Step 1: Create API User
    const createUserResponse = await axios.post(
      `${SANDBOX_BASE_URL}/v1_0/apiuser`,
      {
        providerCallbackHost: CALLBACK_HOST
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Reference-Id': apiUser,
          'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
        }
      }
    );

    if (createUserResponse.status === 201) {
      console.log('✅ API User created successfully!\n');
    } else {
      throw new Error(`Unexpected response: ${createUserResponse.status}`);
    }

    // Step 2: Create API Key for the user
    const createKeyResponse = await axios.post(
      `${SANDBOX_BASE_URL}/v1_0/apiuser/${apiUser}/apikey`,
      {},
      {
        headers: {
          'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
        }
      }
    );

    if (createKeyResponse.status === 201) {
      const apiKey = createKeyResponse.data.apiKey;
      console.log('✅ API Key generated successfully!\n');
      
      // Display results
      console.log('═══════════════════════════════════════════════════════════');
      console.log('SUCCESS! Copy these values to your .env file:');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`MTN_CONSUMER_KEY=${SUBSCRIPTION_KEY}`);
      console.log(`MTN_CONSUMER_SECRET=${apiKey}`);
      console.log(`MTN_API_USER=${apiUser}`);
      console.log(`MTN_ENV=sandbox\n`);
      console.log('═══════════════════════════════════════════════════════════\n');
      
      console.log('IMPORTANT NOTES:');
      console.log('1. Save these credentials in your backend/.env file');
      console.log('2. Keep your API credentials secure and never commit them to Git');
      console.log('3. For production, change MTN_ENV to "production" and use production credentials');
      console.log('4. Test phone numbers for sandbox: Use any valid phone number format');
      console.log('   Example: 250788123456 (for Rwanda)\n');

    } else {
      throw new Error('Failed to create API Key');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.error('\n💡 TIP: Your Subscription Key (MTN_CONSUMER_KEY) is invalid or unauthorized.');
        console.error('   Please verify your subscription key from the MTN Developer Portal.');
      } else if (error.response.status === 403) {
        console.error('\n💡 TIP: Access forbidden. Make sure you have subscribed to the Collections product.');
      } else if (error.response.status === 409) {
        console.error('\n💡 TIP: API User already exists. Try running the script again to generate a new one.');
      }
    } else {
      console.error('\n💡 TIP: Check your internet connection and verify the MTN API is accessible.');
    }
    
    console.error('\nFor more help, visit: https://momodeveloper.mtn.com/api-documentation/\n');
    process.exit(1);
  }
}

// Run the script
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   MTN Mobile Money Sandbox User Creation Script          ║');
console.log('╚════════════════════════════════════════════════════════════╝');

createSandboxUser();
