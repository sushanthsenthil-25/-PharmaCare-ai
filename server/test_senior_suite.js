import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';
import { execSync } from 'child_process';

try {
  if (process.platform === 'win32') {
    const ipconfigOutput = execSync('ipconfig /all', { encoding: 'utf8', timeout: 3000 });
    const detectedIps = Array.from(
      ipconfigOutput.matchAll(/DNS Servers[ .:]+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/g),
      (m) => m[1]
    ).filter((ip) => ip !== '127.0.0.1');

    const dnsServers = [...new Set([...detectedIps, '8.8.8.8', '1.1.1.1'])];
    if (dnsServers.length > 0) dns.setServers(dnsServers);
  } else {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
} catch (_) {}

dotenv.config();

import { searchMedicinesRanked, extractMedicineName } from './services/medicineSearchService.js';
import { calculateCart, calculateDeliveryEstimate } from './services/cartService.js';
import { geminiService } from './services/geminiService.js';
import Medicine from './models/Medicine.js';

async function runSeniorTestSuite() {
  console.log('=== SENIOR PRODUCTION TEST SUITE ===\n');

  if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log('[Test Setup] Connected to MongoDB Atlas\n');
  }

  // -------------------------------------------------------------
  // TEST 1: Medicine Extraction & Normalization
  // -------------------------------------------------------------
  console.log('TEST 1: Medicine Extraction from Natural Sentences');
  const queries = [
    { input: 'Tell me about Dolo', expected: 'dolo' },
    { input: 'tell about dolo', expected: 'dolo' },
    { input: 'a tell about dolo', expected: 'dolo' },
    { input: 'about dolo', expected: 'dolo' },
    { input: 'what about dolo', expected: 'dolo' },
    { input: 'Show me paracetamol 650', expected: 'paracetamol 650' },
    { input: 'Do you have Pantoprazole?', expected: 'pantoprazole' },
    { input: 'What is Cetirizine used for', expected: 'cetirizine' },
  ];

  for (const q of queries) {
    const extracted = extractMedicineName(q.input);
    console.log(`  Input: "${q.input}" -> Extracted: "${extracted}"`);
    if (!extracted.toLowerCase().includes(q.expected)) {
      throw new Error(`Failed extraction for "${q.input}", got "${extracted}"`);
    }
  }
  console.log('✓ TEST 1 PASSED\n');

  // -------------------------------------------------------------
  // TEST 2: Ranked MongoDB Search for Dolo & Paracetamol
  // -------------------------------------------------------------
  console.log('TEST 2: Ranked Search in MongoDB');
  const doloResults = await searchMedicinesRanked('Dolo');
  console.log(`  Query "Dolo" -> Found ${doloResults.length} items:`, doloResults.map((r) => `${r.name} (${r.brand})`));
  if (doloResults.length === 0 || !doloResults[0].name.includes('650')) {
    throw new Error('Expected Dolo search to return Paracetamol 650 / Dolo 650');
  }

  const pcmResults = await searchMedicinesRanked('Paracetamol');
  console.log(`  Query "Paracetamol" -> Found ${pcmResults.length} items:`, pcmResults.map((r) => r.name));
  if (pcmResults.length < 2) {
    throw new Error('Expected Paracetamol search to return at least 2 formulations');
  }
  console.log('✓ TEST 2 PASSED\n');

  // -------------------------------------------------------------
  // TEST 3: JARVIS Response for "Tell me about Dolo" and "tell about dolo"
  // -------------------------------------------------------------
  console.log('TEST 3: JARVIS "Tell me about Dolo" Flow');
  const doloChat = await geminiService.generateChatResponse({
    message: 'Tell me about Dolo',
  });
  console.log('  JARVIS Response for "Tell me about Dolo":\n ', doloChat.message);
  if (!doloChat.products || doloChat.products.length === 0) {
    throw new Error('Expected "Tell me about Dolo" to return Paracetamol 650 product');
  }

  const tellAboutDoloChat = await geminiService.generateChatResponse({
    message: 'tell about dolo',
  });
  console.log('  JARVIS Response for "tell about dolo":\n ', tellAboutDoloChat.message);
  if (!tellAboutDoloChat.products || tellAboutDoloChat.products.length === 0) {
    throw new Error('Expected "tell about dolo" to return Paracetamol 650 product');
  }

  const aboutDoloChat = await geminiService.generateChatResponse({
    message: 'about dolo',
  });
  console.log('  JARVIS Response for "about dolo":\n ', aboutDoloChat.message);
  if (!aboutDoloChat.products || aboutDoloChat.products.length === 0) {
    throw new Error('Expected "about dolo" to return Paracetamol 650 product');
  }
  console.log('✓ TEST 3 PASSED\n');

  // -------------------------------------------------------------
  // TEST 4: Cart Calculation Engine & Delivery Estimate
  // -------------------------------------------------------------
  console.log('TEST 4: Authoritative Cart Calculation Engine');
  const sampleItems = [
    { productId: 'p1', name: 'Paracetamol 650', price: 30, qty: 2 },
    { productId: 'p2', name: 'Cetirizine 10', price: 25, qty: 1 },
  ];

  const cartSummary = calculateCart(sampleItems);
  console.log('  Items Subtotal:', cartSummary.subtotal, '(Expected 85)');
  console.log('  Delivery Fee:', cartSummary.deliveryFee, '(Expected 30 since subtotal < 100)');
  console.log('  Total:', cartSummary.total, '(Expected 115)');
  console.log('  Estimated Delivery Text:', cartSummary.estimatedDeliveryText);

  if (cartSummary.subtotal !== 85 || cartSummary.total !== 115) {
    throw new Error(`Cart calculation error: expected 85 subtotal and 115 total, got ${cartSummary.subtotal} / ${cartSummary.total}`);
  }

  // Free delivery check for subtotal >= 100
  const freeItems = [
    { productId: 'p1', name: 'Azithromycin 500', price: 120, qty: 1 },
  ];
  const freeCart = calculateCart(freeItems);
  console.log('  Free delivery test -> Subtotal:', freeCart.subtotal, 'Delivery Fee:', freeCart.deliveryFee, 'Total:', freeCart.total);
  if (freeCart.deliveryFee !== 0 || freeCart.total !== 120) {
    throw new Error(`Free delivery calculation failed`);
  }
  console.log('✓ TEST 4 PASSED\n');

  // -------------------------------------------------------------
  // TEST 5: JARVIS Add to Cart & Calculation
  // -------------------------------------------------------------
  console.log('TEST 5: JARVIS Conversational Cart Action');
  const cartActionRes = await geminiService.generateChatResponse({
    message: 'Add two Dolo 650 to my cart',
    context: { displayedProducts: doloResults },
  });
  console.log('  JARVIS Response:\n ', cartActionRes.message);
  console.log('  Action type:', cartActionRes.action);
  if (cartActionRes.action !== 'ADDED_TO_CART') {
    throw new Error('Expected ADDED_TO_CART action');
  }
  console.log('✓ TEST 5 PASSED\n');

  // -------------------------------------------------------------
  // TEST 6: Multi-turn Context & Non-Hallucination
  // -------------------------------------------------------------
  console.log('TEST 6: Multi-turn Context & Non-Hallucination');
  const nonExistent = await geminiService.generateChatResponse({
    message: 'Do you have RandomFakeDrugXYZ 999?',
  });
  console.log('  Non-existent response:', nonExistent.message);
  if (!nonExistent.message.includes("couldn't find") && !nonExistent.message.includes("don't currently see")) {
    throw new Error('Expected clean not-found message for fake drug');
  }
  console.log('✓ TEST 6 PASSED\n');

  console.log('=== ALL SENIOR BACKEND TESTS PASSED (6/6) ===');
  process.exit(0);
}

runSeniorTestSuite().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
