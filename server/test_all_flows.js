/**
 * End-to-End Verification Test Script for PharmaCare AI
 * Tests all backend APIs, security validations, and AI flows
 */

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('==============================================');
  console.log('STARTING PHARMACARE AI END-TO-END VERIFICATION');
  console.log('==============================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extra = '') {
    if (condition) {
      console.log(`✅ [PASS]: ${testName} ${extra}`);
      passed++;
    } else {
      console.error(`❌ [FAIL]: ${testName} ${extra}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    const healthRes = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    assert(healthRes.status === 'online', 'Health Check Endpoint');

    // 2. Auth - Login Demo User
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@pharmacare.ai', password: 'Password123!' }),
    }).then((r) => r.json());

    assert(loginRes.success && loginRes.token, 'Login Demo User (owner@pharmacare.ai)');
    const token = loginRes.token;

    // 3. Auth - Get Profile (GET /api/auth/me)
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    assert(meRes.success && meRes.user.email === 'owner@pharmacare.ai', 'Get Current User Profile (/api/auth/me)');

    // 4. Auth - Register New User
    const testEmail = `test_${Date.now()}@pharmacare.ai`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Test User',
        email: testEmail,
        password: 'Password123!',
        business_name: 'Test Healthcare Clinic',
      }),
    }).then((r) => r.json());
    assert(regRes.success && regRes.token, 'Register New User Endpoint');

    // 5. Medicines - List All Medicines
    const medListRes = await fetch(`${BASE_URL}/medicines?limit=50`).then((r) => r.json());
    assert(medListRes.success && medListRes.medicines.length >= 20, `List Medicines (${medListRes.medicines.length} found)`);

    // 6. Medicines - Search by Name & Generic Name
    const searchRes = await fetch(`${BASE_URL}/medicines?search=paracetamol`).then((r) => r.json());
    assert(searchRes.success && searchRes.medicines.some((m) => m.name.toLowerCase().includes('paracetamol')), 'Search Medicines by Name (Paracetamol)');

    const genericSearchRes = await fetch(`${BASE_URL}/medicines?search=amoxicillin`).then((r) => r.json());
    assert(genericSearchRes.success && genericSearchRes.medicines.some((m) => m.genericName.toLowerCase().includes('amoxicillin')), 'Search Medicines by Generic Name (Amoxicillin)');

    // 7. Medicines - Expiry Status Validation Check
    const expiredMed = medListRes.medicines.find((m) => m.batchNumber === 'EXP-TET-999');
    assert(expiredMed && expiredMed.expiryStatus === 'EXPIRED', 'Expired Batch Status correctly marked as EXPIRED');

    const expiringSoonMed = medListRes.medicines.find((m) => m.batchNumber === 'EXP-SOON-45D');
    assert(expiringSoonMed && expiringSoonMed.expiryStatus === 'EXPIRES_SOON', 'Expiring Soon Batch correctly marked as EXPIRES_SOON');

    const validMed = medListRes.medicines.find((m) => m.expiryStatus === 'VALID' && m.stock > 0);
    assert(validMed && validMed.expiryStatus === 'VALID', `Valid Batch correctly marked as VALID (${validMed?.name})`);

    // 8. Medicine Details by ID
    const medDetailRes = await fetch(`${BASE_URL}/medicines/${validMed.id}`).then((r) => r.json());
    assert(medDetailRes.success && medDetailRes.medicine.batchNumber, `Get Medicine Details by ID (${medDetailRes.medicine.name})`);

    // 9. Health Products Endpoint
    const healthResList = await fetch(`${BASE_URL}/health-products`).then((r) => r.json());
    assert(healthResList.success && healthResList.products.length >= 15, `List Health Products (${healthResList.products.length} found)`);

    // 10. Personal Care Products Endpoint
    const personalResList = await fetch(`${BASE_URL}/personal-care`).then((r) => r.json());
    assert(personalResList.success && personalResList.products.length >= 15, `List Personal Care Products (${personalResList.products.length} found)`);

    // 11. Cart - Expired Medicine Purchase Prevention (Must Reject with 400!)
    const expiredCartRes = await fetch(`${BASE_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: expiredMed.id,
        productType: 'Medicine',
        qty: 1,
      }),
    });
    const expiredCartData = await expiredCartRes.json();
    assert(
      expiredCartRes.status === 400 && expiredCartData.message.includes('expired'),
      'Backend Rejection: Expired Medicine Add-to-Cart correctly blocked with 400 error'
    );

    // 12. Cart - Add Valid Medicine
    const validCartRes = await fetch(`${BASE_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: validMed.id,
        productType: 'Medicine',
        qty: 2,
      }),
    }).then((r) => r.json());
    assert(validCartRes.success && validCartRes.items.length > 0, 'Add Valid Product to Cart');

    // 13. Cart - Get Cart
    const getCartRes = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    assert(getCartRes.success && getCartRes.items.length > 0, 'Get User Cart');

    // 14. Cart - Update Quantity
    const firstCartItem = getCartRes.items[0];
    const updateCartRes = await fetch(`${BASE_URL}/cart/${firstCartItem._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ qty: 3 }),
    }).then((r) => r.json());
    assert(updateCartRes.success, 'Update Cart Item Quantity');

    // 15. Orders - Place Demo Order (Checkout)
    const initialStock = validMed.stock;
    const checkoutRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shippingAddress: '100 Feet Road, Indiranagar, Bangalore 560038',
        paymentMethod: 'DEMO_EXPRESS_COD',
      }),
    }).then((r) => r.json());
    assert(checkoutRes.success && checkoutRes.orderNumber, `Place Demo Order (${checkoutRes.orderNumber})`);

    // 16. Orders - Track Order by ID / Order Number
    const trackOrderRes = await fetch(`${BASE_URL}/orders/${checkoutRes.orderNumber}`).then((r) => r.json());
    assert(
      trackOrderRes.success && trackOrderRes.status === 'OUT_FOR_DELIVERY' && trackOrderRes.rider_name,
      `Track Order Timeline & Rider Details (#${checkoutRes.orderNumber})`
    );

    // 17. AI - Product Search Query ("Show me Paracetamol")
    const aiSearchRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Show me Paracetamol' }),
    }).then((r) => r.json());
    assert(
      aiSearchRes.success && aiSearchRes.type === 'PRODUCT_SEARCH' && aiSearchRes.products.length > 0,
      `AI Product Search Response (${aiSearchRes.products.length} products returned)`
    );

    // 18. AI - General Medical Information Query
    const aiInfoRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is Cetirizine used for?' }),
    }).then((r) => r.json());
    assert(
      aiInfoRes.success && aiInfoRes.type === 'INFORMATION' && aiInfoRes.message.length > 20,
      'AI Clinical Information Response with Safety Guidelines'
    );

    // 19. AI - Voice Assistant Command Endpoint
    const voiceRes = await fetch(`${BASE_URL}/ai/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command_text: 'Paracetamol stock evlo irukku?', language_hint: 'Tamil/English' }),
    }).then((r) => r.json());
    assert(voiceRes.success && (voiceRes.message || voiceRes.tts_text), 'Voice Assistant Multilingual Processing');

    // 20. Live Dashboard & Alerts Compatibility
    const dashRes = await fetch(`${BASE_URL}/dashboard/summary`).then((r) => r.json());
    assert(dashRes.success && dashRes.product_count > 0, `Live Dashboard Summary (${dashRes.product_count} products, ${dashRes.active_orders} active orders)`);

    const alertsRes = await fetch(`${BASE_URL}/alerts`).then((r) => r.json());
    assert(alertsRes.success && alertsRes.alerts.length > 0, `Live Clinical Alerts (${alertsRes.alerts.length} active alerts)`);

  } catch (err) {
    console.error('Test Execution Error:', err);
    failed++;
  }

  console.log('\n==============================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==============================================');
}

runTests();
