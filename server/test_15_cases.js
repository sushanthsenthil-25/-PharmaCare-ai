import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:5000/api';

async function run15Tests() {
  console.log('=====================================================');
  console.log('TESTING ALL 15 CRITICAL INTELLIGENCE & PRODUCT FLOWS');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  // Login to get token for authenticated flows
  let token = null;
  let userId = null;
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@pharmacare.ai',
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    token = loginData.token;
    userId = loginData.user?.id;
  } catch (err) {
    console.warn('Could not login demo user, testing as guest:', err.message);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Track conversation state across multi-turn tests
  let conversationHistory = [];

  const runTest = async (testNum, title, message, validator) => {
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          message,
          history: conversationHistory,
        }),
      });

      const data = await res.json();
      const err = validator(data);

      if (!err) {
        console.log(`✅ [PASS] TEST ${testNum}: "${message}"`);
        console.log(`   Output: ${data.message.slice(0, 100).replace(/\n/g, ' ')}...`);
        if (data.products && data.products.length > 0) {
          console.log(`   Products: ${data.products.length} found. First: "${data.products[0].name}", Image: ${data.products[0].image?.slice(0, 50)}...`);
        }
        passed++;
      } else {
        console.log(`❌ [FAIL] TEST ${testNum}: "${message}" -> ${err}`);
        console.log(`   Received: ${data.message}`);
        failed++;
      }

      // Append turn to history
      conversationHistory.push({ role: 'user', message, products: data.products || [] });
      conversationHistory.push({ role: 'assistant', message: data.message, products: data.products || [] });
    } catch (err) {
      console.log(`❌ [ERROR] TEST ${testNum}: "${message}" -> Request failed: ${err.message}`);
      failed++;
    }
  };

  // TEST 1: Greeting
  await runTest(1, 'Greeting', 'Hi', (d) => {
    if (d.message.toLowerCase().includes('clinical guidance') || d.message.toLowerCase().includes('disclaimer')) {
      return 'Incorrectly returned clinical disclaimer';
    }
    if (!d.message.toLowerCase().includes('jarvis') && !d.message.toLowerCase().includes('help')) {
      return 'Missing natural greeting';
    }
    return null;
  });

  // TEST 2: Weather
  await runTest(2, 'Weather query', 'How is the weather?', (d) => {
    if (d.message.toLowerCase().includes('pharmacy provides') || d.message.toLowerCase().includes('formulation')) {
      return 'Treated weather as medical question!';
    }
    if (d.message.toLowerCase().includes('medicine')) {
      return 'Mentioned medicine in weather response';
    }
    return null;
  });

  // TEST 3: Math
  await runTest(3, 'Math query', 'What is 10 + 20?', (d) => {
    if (!d.message.includes('30')) {
      return 'Did not return 30';
    }
    return null;
  });

  // TEST 4: Science
  await runTest(4, 'Explain Gravity', 'Explain gravity.', (d) => {
    if (!d.message.toLowerCase().includes('mass') && !d.message.toLowerCase().includes('force') && !d.message.toLowerCase().includes('attract')) {
      return 'Missing gravity explanation';
    }
    if (d.message.toLowerCase().includes('prescription') || d.message.toLowerCase().includes('pharmacy')) {
      return 'Medicalized science query';
    }
    return null;
  });

  // TEST 5: Joke
  await runTest(5, 'Tell a Joke', 'Tell me a joke.', (d) => {
    if (d.message.length < 10) return 'Joke too short';
    return null;
  });

  // TEST 6: Dolo Product Search
  await runTest(6, 'Show me Dolo', 'Show me Dolo.', (d) => {
    if (!d.products || d.products.length === 0) return 'No products returned for Dolo';
    const dolo = d.products.find((p) => p.name.toLowerCase().includes('dolo'));
    if (!dolo) return 'Dolo product not in returned list';
    if (!dolo.image) return 'Dolo product missing image';
    return null;
  });

  // TEST 7: Dolo 650 Uses
  await runTest(7, 'What is Dolo 650 used for?', 'What is Dolo 650 used for?', (d) => {
    const m = d.message.toLowerCase();
    if (!m.includes('fever') && !m.includes('pain') && !m.includes('paracetamol')) {
      return 'Missing medicine uses info';
    }
    return null;
  });

  // TEST 8: Contextual Price
  await runTest(8, 'What is the price?', 'What is the price?', (d) => {
    if (!d.message.includes('35') && !d.message.includes('₹')) {
      return 'Did not return Dolo 650 price (₹35)';
    }
    return null;
  });

  // TEST 9: Add it to Cart
  await runTest(9, 'Add it to cart.', 'Add it to cart.', (d) => {
    if (!d.message.toLowerCase().includes('added') || !d.message.toLowerCase().includes('cart')) {
      return 'Did not confirm cart addition';
    }
    return null;
  });

  // TEST 10: Find face wash
  await runTest(10, 'Find face wash', 'Find face wash.', (d) => {
    if (!d.products || d.products.length === 0) return 'No face wash products returned';
    const fw = d.products.find((p) => p.name.toLowerCase().includes('face wash'));
    if (!fw) return 'No face wash found';
    return null;
  });

  // Reset context to medicine for expiry test
  conversationHistory.push({
    role: 'assistant',
    message: 'Here is Dolo 650',
    products: [{ name: 'Dolo 650', expiryDate: '2028-01-20', batchNumber: 'DOL-650-301' }],
  });

  // TEST 11: Expiry date
  await runTest(11, "What's the expiry date?", "What's the expiry date?", (d) => {
    if (!d.message.toLowerCase().includes('expiry date') && !d.message.toLowerCase().includes('2028')) {
      return 'Missing expiry date info';
    }
    return null;
  });

  // TEST 12: Black holes
  await runTest(12, 'Tell me about black holes', 'Tell me about black holes.', (d) => {
    const m = d.message.toLowerCase();
    if (!m.includes('gravity') && !m.includes('spacetime') && !m.includes('light')) {
      return 'Missing black hole explanation';
    }
    return null;
  });

  // TEST 13: Learn JavaScript
  await runTest(13, 'How do I learn JavaScript?', 'How do I learn JavaScript?', (d) => {
    const m = d.message.toLowerCase();
    if (!m.includes('javascript') && !m.includes('fundamentals') && !m.includes('react')) {
      return 'Missing programming guidance';
    }
    return null;
  });

  // TEST 14: Where is my order
  await runTest(14, 'Where is my order?', 'Where is my order?', (d) => {
    const m = d.message.toLowerCase();
    if (!m.includes('order') && !m.includes('delivery')) {
      return 'Missing order tracking status';
    }
    return null;
  });

  // TEST 15: Thanks
  await runTest(15, 'Thanks', 'Thanks', (d) => {
    const m = d.message.toLowerCase();
    if (!m.includes('welcome')) {
      return 'Missing welcome response';
    }
    if (m.includes('clinical') || m.includes('disclaimer')) {
      return 'Returned medical disclaimer for thanks';
    }
    return null;
  });

  console.log('\n=====================================================');
  console.log(`ALL 15 CONVERSATIONAL TEST CASES: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================');
}

run15Tests().catch(console.error);
