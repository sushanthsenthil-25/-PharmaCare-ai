import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { connectDB } from './server/config/db.js';
import User from './server/models/User.js';
import Pharmacy from './server/models/Pharmacy.js';
import Medicine from './server/models/Medicine.js';
import Message from './server/models/Message.js';
import {
  findCatalogueMedicineById,
  findLivePharmacyStockForMedicine,
  searchUnifiedCatalogue,
} from './server/services/medicineSearchService.js';
import geminiService from './server/services/geminiService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      defaultHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: defaultHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 PHARMACARE AI ASSISTANT OBJECTID & CATALOGUE REGRESSION TESTS');
  console.log('============================================================\n');

  await connectDB();

  // 1. Direct Catalogue Helper Lookup: catalogue_6714
  console.log('--- Test 1: Retrieve catalogue medicine using ID catalogue_6714 ---');
  const cat6714 = await findCatalogueMedicineById('catalogue_6714');
  assert(cat6714 !== null, 'catalogue_6714 resolved successfully');
  assert(cat6714?.name === 'Aldoloc 20 mg/50 mg Tablet', `Expected Aldoloc, got: ${cat6714?.name}`);
  assert(cat6714?.isCatalogue === true, 'Marked as isCatalogue: true');
  assert(cat6714?.id === 'catalogue_6714', 'id is catalogue_6714');

  // 2. Direct Catalogue Helper Lookup: catalogue_9761
  console.log('\n--- Test 2: Retrieve catalogue record using ID catalogue_9761 ---');
  const cat9761 = await findCatalogueMedicineById('catalogue_9761');
  assert(cat9761 !== null, 'catalogue_9761 resolved successfully');
  assert(cat9761?.name === 'Adoloc 20mg Capsule', `Expected Adoloc, got: ${cat9761?.name}`);
  assert(cat9761?.isCatalogue === true, 'Marked as isCatalogue: true');

  // 3. GET /api/medicines/:id with catalogue_6714 and catalogue_9761
  console.log('\n--- Test 3: API Endpoint GET /api/medicines/catalogue_6714 ---');
  const resApi6714 = await makeRequest('GET', '/api/medicines/catalogue_6714');
  assert(resApi6714.status === 200, `Expected 200, got: ${resApi6714.status}`);
  assert(resApi6714.body.success === true, 'Response success is true');
  assert(resApi6714.body.medicine?.name === 'Aldoloc 20 mg/50 mg Tablet', 'Returned correct medicine name');
  assert(resApi6714.body.medicine?.isCatalogue === true, 'Confirmed as catalogue record');

  console.log('\n--- Test 4: API Endpoint GET /api/medicines/catalogue_9761 ---');
  const resApi9761 = await makeRequest('GET', '/api/medicines/catalogue_9761');
  assert(resApi9761.status === 200, `Expected 200, got: ${resApi9761.status}`);
  assert(resApi9761.body.medicine?.name === 'Adoloc 20mg Capsule', 'Returned correct medicine name');

  // 4. Retrieve a genuine MongoDB ObjectId
  console.log('\n--- Test 5: Retrieve a genuine MongoDB ObjectId ---');
  const realMed = await Medicine.findOne({ stock: { $gt: 0 } }).lean();
  assert(realMed !== null, 'Found genuine store medicine in DB');
  if (realMed) {
    const resReal = await makeRequest('GET', `/api/medicines/${realMed._id}`);
    assert(resReal.status === 200, `Expected 200, got: ${resReal.status}`);
    assert(resReal.body.medicine?.name === realMed.name, `Correct store medicine: ${realMed.name}`);
    assert(resReal.body.medicine?.isCatalogue !== true, 'Genuine medicine is live store stock');
  }

  // 5. Submit an invalid ID and confirm graceful response (no BSONError / 500)
  console.log('\n--- Test 6: Submit invalid IDs and verify graceful 400/404 response ---');
  const resInvalid1 = await makeRequest('GET', '/api/medicines/completely_invalid_id_12345');
  assert(resInvalid1.status === 404, `Expected 404 for nonexistent ID, got: ${resInvalid1.status}`);
  assert(resInvalid1.body.success === false, 'success is false');
  assert(!JSON.stringify(resInvalid1.body).includes('BSONError'), 'No BSONError exposed');

  const resInvalidCart = await makeRequest('POST', '/api/cart', { productId: 'invalid_cart_item_xyz', qty: 1 });
  // Should return 401 (needs auth) or 404/400, never 500 BSONError
  assert(resInvalidCart.status !== 500, `Cart add did not crash with 500: got status ${resInvalidCart.status}`);

  // 6. Search for catalogue medicine with no matching pharmacy stock
  console.log('\n--- Test 7: AI Assistant handling of catalogue medicine with no stock ---');
  const stockCheck = await geminiService.generateChatResponse({
    message: 'Is catalogue_6714 available in stock?',
    context: { selectedProduct: cat6714 },
  });
  assert(stockCheck.type === 'INFORMATION', `AI returned informative response: ${stockCheck.type}`);
  assert(
    stockCheck.message.toLowerCase().includes('catalogue') || stockCheck.message.toLowerCase().includes('stock') || stockCheck.message.toLowerCase().includes('aldoloc'),
    `Explains accurately without inventing stock: ${stockCheck.message}`
  );

  // 7. Test AI Assistant Chat with medicine search (e.g. "dolo")
  console.log('\n--- Test 8: Ask AI assistant to search for a medicine by name ---');
  const aiChatSearch = await makeRequest('POST', '/api/ai/chat', {
    message: 'show me dolo',
  });
  assert(aiChatSearch.status === 200, `AI chat responded with 200, got: ${aiChatSearch.status}`);
  assert(aiChatSearch.body.success === true, 'AI chat success is true');
  assert(aiChatSearch.body.products?.length > 0, `Returned products: ${aiChatSearch.body.products?.length}`);
  assert(!JSON.stringify(aiChatSearch.body).includes('BSONError'), 'No BSONError in AI response');

  // 8. Test AI Assistant Chat with a direct catalogue query
  console.log('\n--- Test 9: Ask AI assistant about catalogue_6714 directly ---');
  const aiDirectQuery = await makeRequest('POST', '/api/ai/chat', {
    message: 'Tell me about catalogue_6714',
  });
  assert(aiDirectQuery.status === 200, `AI chat responded with 200, got: ${aiDirectQuery.status}`);
  assert(aiDirectQuery.body.success === true, 'AI chat success is true');
  assert(!JSON.stringify(aiDirectQuery.body).includes('BSONError'), 'No BSONError in direct catalogue query');
  assert(
    aiDirectQuery.body.message.toLowerCase().includes('aldoloc') || (aiDirectQuery.body.products && aiDirectQuery.body.products[0]?.name.includes('Aldoloc')),
    'Identified Aldoloc formulation'
  );

  // 9. Test Message.create persistence with catalogue items (the original crash site)
  console.log('\n--- Test 10: Message schema subdocument validation with catalogue_6714 ---');
  let messageCreateError = null;
  try {
    const testMsg = new Message({
      conversationId: `test_conv_${Date.now()}`,
      role: 'assistant',
      message: 'Here is your catalogue medicine',
      products: [
        {
          _id: 'catalogue_6714',
          id: 'catalogue_6714',
          name: 'Aldoloc 20 mg/50 mg Tablet',
          price: 50,
          stock: 0,
          isCatalogue: true,
        },
        {
          _id: 'catalogue_9761',
          id: 'catalogue_9761',
          name: 'Adoloc 20mg Capsule',
          price: 35,
          stock: 0,
          isCatalogue: true,
        },
      ],
    });
    const valErr = testMsg.validateSync();
    if (valErr) messageCreateError = valErr.message;
  } catch (err) {
    messageCreateError = err.message;
  }
  assert(messageCreateError === null, `Message validation passed without BSONError: ${messageCreateError || 'OK'}`);

  // 10. Confirm normal AI chat still works for non-medicine questions
  console.log('\n--- Test 11: Non-medicine queries (Greeting, Math, General Knowledge) ---');
  const greetRes = await makeRequest('POST', '/api/ai/chat', { message: 'hello jarvis' });
  assert(greetRes.status === 200 && greetRes.body.success === true, 'Greeting works normally');

  const mathRes = await makeRequest('POST', '/api/ai/chat', { message: 'what is 25 + 25' });
  assert(mathRes.status === 200 && mathRes.body.message.includes('50'), `Math works: ${mathRes.body.message}`);

  // 11. Role & Access restrictions remain intact
  console.log('\n--- Test 12: Customer & Pharmacy Owner access restrictions remain intact ---');
  const unauthOwner = await makeRequest('GET', '/api/owner/inventory');
  assert(unauthOwner.status === 401, `Unauthenticated owner access rejected with 401: ${unauthOwner.status}`);

  const unauthOwnerPatch = await makeRequest('PATCH', '/api/owner/medicines/catalogue_6714/stock', { stock: 10 });
  assert(unauthOwnerPatch.status === 401, `Unauthenticated owner patch rejected with 401: ${unauthOwnerPatch.status}`);

  console.log('\n============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('============================================================\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
