require('dotenv').config();
const { Client } = require('pg');
const dns = require('dns');

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

async function testConnection() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            require: true,
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 30000,
    });

    try {
        console.log('Attempting to connect to database...');
        console.log('Host:', process.env.DATABASE_URL.split('@')[1]?.split('/')[0]);
        
        await client.connect();
        console.log('✅ Connected successfully!');
        
        const result = await client.query('SELECT NOW()');
        console.log('✅ Query successful:', result.rows[0]);
        
        await client.end();
        console.log('✅ Connection closed');
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Full error:', error);
    }
}

testConnection();
