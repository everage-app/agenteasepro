// Test script for channel connections API
const baseUrl = 'http://localhost:3000';
let authToken = null;

// Helper to make authenticated requests
async function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

async function testChannelsAPI() {
  console.log('🧪 Testing Channel Connections API\n');
  
  try {
    // Test 1: Login first (need auth token)
    console.log('1️⃣ Logging in...');
    const loginRes = await apiCall('POST', '/api/auth/dev-login', {
      email: 'test@example.com'
    });
    
    if (loginRes.status === 200) {
      authToken = loginRes.data.token;
      console.log('✅ Logged in successfully');
      console.log(`   Agent: ${loginRes.data.agent.name} (${loginRes.data.agent.email})`);
    } else {
      throw new Error('Login failed');
    }
    
    // Test 2: Get all channels (should show all 7 as "missing")
    console.log('\n2️⃣ Fetching all channels...');
    const channelsRes = await apiCall('GET', '/api/channels');
    console.log(`Status: ${channelsRes.status}`);
    console.log('Channels:', JSON.stringify(channelsRes.data, null, 2));
    
    if (channelsRes.data && Array.isArray(channelsRes.data)) {
      console.log(`✅ Found ${channelsRes.data.length} channel types`);
      const connected = channelsRes.data.filter(c => c.status === 'connected').length;
      const missing = channelsRes.data.filter(c => c.status === 'missing').length;
      console.log(`   Connected: ${connected}, Missing: ${missing}`);
    }
    
    // Test 3: Connect EMAIL channel
    console.log('\n3️⃣ Connecting EMAIL channel...');
    const emailRes = await apiCall('PUT', '/api/channels/EMAIL', {
      fromName: 'Test Agent',
      fromEmail: 'agent@example.com'
    });
    console.log(`Status: ${emailRes.status}`);
    console.log('Response:', JSON.stringify(emailRes.data, null, 2));
    
    // Test 4: Connect SMS channel
    console.log('\n4️⃣ Connecting SMS channel...');
    const smsRes = await apiCall('PUT', '/api/channels/SMS', {
      fromLabel: 'Test Realty'
    });
    console.log(`Status: ${smsRes.status}`);
    console.log('Response:', JSON.stringify(smsRes.data, null, 2));
    
    // Test 5: Get channels again (should show EMAIL and SMS as connected)
    console.log('\n5️⃣ Fetching channels after connections...');
    const updatedChannelsRes = await apiCall('GET', '/api/channels');
    console.log(`Status: ${updatedChannelsRes.status}`);
    
    if (updatedChannelsRes.data && Array.isArray(updatedChannelsRes.data)) {
      const connected = updatedChannelsRes.data.filter(c => c.status === 'connected');
      const missing = updatedChannelsRes.data.filter(c => c.status === 'missing');
      console.log(`✅ Connected channels: ${connected.map(c => c.type).join(', ')}`);
      console.log(`   Missing channels: ${missing.map(c => c.type).join(', ')}`);
    }
    
    console.log('\n✨ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run tests
testChannelsAPI();
