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

import User from './models/User.js';
import Medicine from './models/Medicine.js';
import Cart from './models/Cart.js';
import Order from './models/Order.js';
import { searchMedicinesRanked } from './services/medicineSearchService.js';
import { calculateCart, calculateDeliveryEstimate } from './services/cartService.js';
import { geminiService } from './services/geminiService.js';

async function runEndToEndVerification() {
  console.log('=== RUNNING COMPLETE END-TO-END VERIFICATION ===\n');

  if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  // 1. DOLO SEARCH VERIFICATION
  console.log('Step 1: Testing Ranked Dolo Search');
  const doloResults = await searchMedicinesRanked('Dolo');
  if (!doloResults || doloResults.length === 0) {
    throw new Error('Dolo search returned 0 items');
  }
  const doloItem = doloResults[0];
  console.log(`✓ Found: ${doloItem.name} (Brand: ${doloItem.brand}, Price: ₹${doloItem.price})`);

  // 2. JARVIS "Tell me about Dolo"
  console.log('\nStep 2: JARVIS "Tell me about Dolo"');
  const chatRes1 = await geminiService.generateChatResponse({
    message: 'Tell me about Dolo',
  });
  console.log('  JARVIS:', chatRes1.message);
  if (!chatRes1.products || chatRes1.products.length === 0) {
    throw new Error('JARVIS did not attach verified product card for Dolo');
  }

  // 3. Multi-turn context: "What's the price?"
  console.log('\nStep 3: Multi-turn Context: "What is the price?"');
  const chatRes2 = await geminiService.generateChatResponse({
    message: 'What is the price?',
    history: [
      { role: 'user', message: 'Tell me about Dolo' },
      { role: 'assistant', message: chatRes1.message, products: chatRes1.products },
    ],
    context: chatRes1.context,
  });
  console.log('  JARVIS:', chatRes2.message);
  if (!chatRes2.message.includes('30')) {
    throw new Error('Expected price ₹30 for Paracetamol 650 / Dolo 650');
  }

  // 4. JARVIS: "Add two of them to my cart"
  console.log('\nStep 4: JARVIS: "Add two of them to my cart"');
  const chatRes3 = await geminiService.generateChatResponse({
    message: 'Add two of them to my cart',
    history: [
      { role: 'user', message: 'Tell me about Dolo' },
      { role: 'assistant', message: chatRes1.message, products: chatRes1.products },
      { role: 'user', message: 'What is the price?' },
      { role: 'assistant', message: chatRes2.message, products: chatRes2.products },
    ],
    context: chatRes2.context,
  });
  console.log('  JARVIS:', chatRes3.message);
  if (chatRes3.action !== 'ADDED_TO_CART') {
    throw new Error('Expected ADDED_TO_CART action');
  }

  // 5. Authoritative Cart Calculation Engine
  console.log('\nStep 5: Authoritative Cart Calculation');
  const cartItems = [
    { productId: doloItem.id, name: doloItem.name, price: doloItem.price, qty: 2 },
  ];
  const cartCalc = calculateCart(cartItems);
  console.log(`  Subtotal: ₹${cartCalc.subtotal}, Delivery Fee: ₹${cartCalc.deliveryFee}, Total: ₹${cartCalc.total}`);
  console.log(`  Estimated Delivery Window: ${cartCalc.estimatedDeliveryText}`);

  // 6. Order Creation & Live Tracking
  console.log('\nStep 6: Order Creation & Live Tracking Lifecycle');
  const demoUser = await User.findOne({ email: 'demo@pharmacare.ai' });
  const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const placedAt = new Date();
  const delivery = calculateDeliveryEstimate(placedAt);

  const testOrder = await Order.create({
    orderNumber,
    userId: demoUser?._id || new mongoose.Types.ObjectId(),
    items: cartCalc.items,
    subtotal: cartCalc.subtotal,
    deliveryFee: cartCalc.deliveryFee,
    discount: cartCalc.discount,
    total: cartCalc.total,
    shippingAddress: 'Indiranagar 100ft Rd, Bangalore 560038',
    placedAt,
    estimatedDeliveryAt: delivery.estimatedDeliveryAt,
    estimatedDeliveryText: delivery.estimatedDeliveryText,
    currentLocation: 'Live driver location will appear when available.',
    status: 'CONFIRMED',
    etaMinutes: 30,
    riderName: 'Vikram Singh',
    riderPhone: '+91 98765 43210',
  });

  console.log(`  Created Order #${testOrder.orderNumber} (ID: ${testOrder._id})`);
  console.log(`  Status: ${testOrder.status}`);
  console.log(`  ETA Window: ${testOrder.estimatedDeliveryText}`);
  console.log(`  Driver Location: ${testOrder.currentLocation}`);

  // 7. Verify JARVIS Order Query
  console.log('\nStep 7: JARVIS "Where is my order?" Query');
  const chatRes4 = await geminiService.generateChatResponse({
    message: 'Where is my order?',
    userId: demoUser?._id,
  });
  console.log('  JARVIS:', chatRes4.message);
  if (!chatRes4.message.includes(testOrder.orderNumber)) {
    throw new Error('JARVIS did not reference the actual active order number');
  }

  console.log('\n=== ALL 7 END-TO-END VERIFICATION STEPS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runEndToEndVerification().catch((err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
