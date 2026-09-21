/**
 * Verification Script for 10 Human-Like AI Assistant Test Cases
 */

const BASE_URL = 'http://localhost:5000/api';

async function run10TestCases() {
  console.log('=====================================================');
  console.log('TESTING 10 HUMAN-LIKE AI PHARMACY ASSISTANT FLOWS');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testTitle, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testTitle}: ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testTitle}: ${detail}`);
      failed++;
    }
  }

  // 0. Login first to get JWT token and user session
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@pharmacare.ai', password: 'Password123!' }),
  }).then((r) => r.json());

  const token = loginRes.token;

  let conversationHistory = [];

  // TEST 1: Greeting ("Hi")
  const t1 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Hi' }),
  }).then((r) => r.json());

  const noDisclaimerT1 = !t1.message.toLowerCase().includes('clinical guidance for hi') &&
    !t1.message.toLowerCase().includes('consult a licensed physician') &&
    (t1.message.includes('JARVIS') || t1.message.includes('help'));
  assert(noDisclaimerT1, 'TEST 1: "Hi"', `AI Output: "${t1.message}"`);
  conversationHistory.push({ role: 'user', message: 'Hi' }, { role: 'assistant', message: t1.message });

  // TEST 2: Product Search ("Show me paracetamol")
  const t2 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Show me paracetamol', history: conversationHistory }),
  }).then((r) => r.json());

  const t2Pass = t2.type === 'PRODUCT_SEARCH' && t2.products?.length > 0 && t2.products[0].image && t2.products[0].name.toLowerCase().includes('paracetamol');
  assert(t2Pass, 'TEST 2: "Show me paracetamol"', `Returned ${t2.products?.length} cards with images (e.g. ${t2.products?.[0]?.name}, Image: ${t2.products?.[0]?.image?.substring(0, 35)}...)`);
  conversationHistory.push({ role: 'user', message: 'Show me paracetamol' }, { role: 'assistant', message: t2.message, products: t2.products });

  // TEST 3: Medical Information ("What is paracetamol?")
  const t3 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'What is paracetamol?', history: conversationHistory }),
  }).then((r) => r.json());

  const t3Pass = t3.type === 'INFORMATION' && t3.message.toLowerCase().includes('pain') || t3.message.toLowerCase().includes('fever');
  assert(t3Pass, 'TEST 3: "What is paracetamol?"', `AI Output: "${t3.message.substring(0, 90)}..."`);
  conversationHistory.push({ role: 'user', message: 'What is paracetamol?' }, { role: 'assistant', message: t3.message });

  // TEST 4: Health Products Search ("Show me vitamin D")
  const t4 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Show me vitamin D', history: conversationHistory }),
  }).then((r) => r.json());

  const t4Pass = t4.type === 'PRODUCT_SEARCH' && t4.products?.some((p) => p.name.toLowerCase().includes('vitamin d')) && t4.products[0].image;
  assert(t4Pass, 'TEST 4: "Show me vitamin D"', `Found ${t4.products?.length} products (e.g. ${t4.products?.[0]?.name})`);
  conversationHistory.push({ role: 'user', message: 'Show me vitamin D' }, { role: 'assistant', message: t4.message, products: t4.products });

  // TEST 5: Expiry Inquiry ("What is the expiry date of this medicine?")
  const t5 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'What is the expiry date of this medicine?', history: conversationHistory }),
  }).then((r) => r.json());

  const t5Pass = t5.message.toLowerCase().includes('expiry date') && (t5.message.includes('2028') || t5.message.includes('2027'));
  assert(t5Pass, 'TEST 5: "What is the expiry date of this medicine?"', `AI Output: "${t5.message}"`);
  conversationHistory.push({ role: 'user', message: 'What is the expiry date of this medicine?' }, { role: 'assistant', message: t5.message });

  // TEST 6: Order Tracking ("Where is my order?")
  const t6 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Where is my order?' }),
  }).then((r) => r.json());

  const t6Pass = t6.message.includes('ORD-') || t6.message.toLowerCase().includes('delivery') || t6.message.toLowerCase().includes('order');
  assert(t6Pass, 'TEST 6: "Where is my order?"', `AI Output: "${t6.message}"`);

  // TEST 7: Courtesy ("Thanks")
  const t7 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Thanks' }),
  }).then((r) => r.json());

  const t7Pass = t7.message.includes("You're welcome") && !t7.message.toLowerCase().includes('disclaimer');
  assert(t7Pass, 'TEST 7: "Thanks"', `AI Output: "${t7.message}"`);

  // TEST 8: Personal Care Search ("Can you find me a face wash?")
  const t8 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Can you find me a face wash?' }),
  }).then((r) => r.json());

  const t8Pass = t8.type === 'PRODUCT_SEARCH' && t8.products?.some((p) => p.name.toLowerCase().includes('face wash')) && t8.products[0].image;
  assert(t8Pass, 'TEST 8: "Can you find me a face wash?"', `Found ${t8.products?.length} face wash products with images`);
  conversationHistory = [{ role: 'assistant', message: t8.message, products: t8.products }];

  // TEST 9: Context-Aware Medicine Info ("Tell me something about this medicine")
  const t9 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Tell me something about this medicine', history: [{ role: 'user', message: 'Paracetamol' }] }),
  }).then((r) => r.json());

  const t9Pass = t9.message.length > 20 && !t9.message.toLowerCase().includes('here is clinical guidance for');
  assert(t9Pass, 'TEST 9: "Tell me something about this medicine"', `AI Output: "${t9.message.substring(0, 80)}..."`);

  // TEST 10: Action Execution ("Add the first product to my cart.")
  const t10 = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      message: 'Add the first product to my cart.',
      history: [{ role: 'assistant', message: 'I found Paracetamol', products: [{ id: t2.products[0].id, name: t2.products[0].name, price: t2.products[0].price, image: t2.products[0].image }] }],
    }),
  }).then((r) => r.json());

  const t10Pass = t10.message.toLowerCase().includes('added') && t10.message.includes('cart');
  assert(t10Pass, 'TEST 10: "Add the first product to my cart."', `AI Output: "${t10.message}"`);

  console.log('\n=====================================================');
  console.log(`ALL 10 CONVERSATIONAL TEST CASES: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================');
}

run10TestCases();
