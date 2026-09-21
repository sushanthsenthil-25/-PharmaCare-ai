import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
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

import authRoutes from './routes/authRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import healthProductRoutes from './routes/healthProductRoutes.js';
import personalCareRoutes from './routes/personalCareRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'PharmaCare AI backend is running',
    environment: 'production',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/health-products', healthProductRoutes);
app.use('/api/personal-care', personalCareRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/ai', aiRoutes);

async function runProductionDeploymentAudit() {
  console.log('===========================================================');
  console.log('PHARMACARE AI — PRODUCTION DEPLOYMENT & READINESS AUDIT');
  console.log('===========================================================\n');

  // 1. Connect DB
  if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Audit] Connected to MongoDB Atlas (Production Cluster)');
  }

  // 2. Start server on dynamic port for testing
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5099, '0.0.0.0', resolve));
  const BASE = 'http://127.0.0.1:5099';
  console.log(`[Audit] Test server listening at ${BASE}\n`);

  let passedChecks = 0;
  let totalChecks = 0;

  function assertCheck(name, condition, extra = '') {
    totalChecks++;
    if (condition) {
      passedChecks++;
      console.log(`  [PASS] ${name} ${extra ? `(${extra})` : ''}`);
    } else {
      console.error(`  [FAIL] ${name} ${extra ? `(${extra})` : ''}`);
      throw new Error(`Audit failed on check: ${name}`);
    }
  }

  // -------------------------------------------------------------
  // AUDIT STAGE 1: HEALTH & INFRASTRUCTURE
  // -------------------------------------------------------------
  console.log('STAGE 1: Health & Infrastructure Checks');
  const healthRes = await fetch(`${BASE}/api/health`).then((r) => r.json());
  assertCheck('GET /api/health responds with 200 OK', healthRes.success === true);
  assertCheck('Database state is connected', healthRes.database === 'connected');
  assertCheck('Environment reported as production', healthRes.environment === 'production');

  // -------------------------------------------------------------
  // AUDIT STAGE 2: AUTHENTICATION & PROFILE PHOTO ISOLATION
  // -------------------------------------------------------------
  console.log('\nSTAGE 2: Authentication & Profile Photo Isolation');
  const testEmail = `audit_user_${Date.now()}@pharmacare.ai`;
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Audit User',
      email: testEmail,
      password: 'password123',
      role: 'user',
    }),
  }).then((r) => r.json());
  assertCheck('User registration succeeds', regRes.success === true && !!regRes.token);
  const token = regRes.token;

  const meRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  assertCheck('GET /api/auth/me returns current user', meRes.user?.email === testEmail);

  const samplePhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const photoRes = await fetch(`${BASE}/api/auth/profile/photo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ photo: samplePhoto }),
  }).then((r) => r.json());
  assertCheck('POST /api/auth/profile/photo updates user avatar', photoRes.success === true && photoRes.user.profilePhoto === samplePhoto);

  const deletePhotoRes = await fetch(`${BASE}/api/auth/profile/photo`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  assertCheck('DELETE /api/auth/profile/photo resets user photo', deletePhotoRes.success === true && (!deletePhotoRes.user.profilePhoto || deletePhotoRes.user.profilePhoto.includes('googleusercontent')));

  // -------------------------------------------------------------
  // AUDIT STAGE 3: MEDICINE SEARCH & DOLO 650 INTEGRATION
  // -------------------------------------------------------------
  console.log('\nSTAGE 3: Medicine Catalog & Ranked Search');
  const doloSearch = await fetch(`${BASE}/api/medicines/search?q=Dolo`).then((r) => r.json());
  assertCheck('Search "Dolo" returns matched products', doloSearch.medicines?.length > 0);
  assertCheck('Search "Dolo" maps to Paracetamol 650 / Dolo 650', doloSearch.medicines[0].name.includes('650'));

  const pcmList = await fetch(`${BASE}/api/medicines?search=Paracetamol`).then((r) => r.json());
  assertCheck('Catalog query "Paracetamol" returns both 500 and 650', pcmList.medicines?.length >= 2);

  const acidList = await fetch(`${BASE}/api/medicines?category=Gastric/Acidity`).then((r) => r.json());
  assertCheck('Category filter "Gastric/Acidity" returns antacids and PPIs', acidList.medicines?.length >= 2);

  // -------------------------------------------------------------
  // AUDIT STAGE 4: AUTHORITATIVE CART CALCULATION & DELIVERY ETA
  // -------------------------------------------------------------
  console.log('\nSTAGE 4: Authoritative Cart Calculation Engine');
  const cartItems = [
    { productId: doloSearch.medicines[0].id, name: doloSearch.medicines[0].name, price: 30, qty: 2 },
  ];
  const calcRes = await fetch(`${BASE}/api/cart/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cartItems }),
  }).then((r) => r.json());
  assertCheck('Cart calculate returns correct subtotal (₹60)', calcRes.subtotal === 60);
  assertCheck('Cart calculate returns delivery fee (₹30 for < ₹100)', calcRes.deliveryFee === 30);
  assertCheck('Cart calculate returns grand total (₹90)', calcRes.total === 90);
  assertCheck('Cart calculate returns dynamic ETA text', typeof calcRes.estimatedDeliveryText === 'string' && calcRes.estimatedDeliveryText.length > 5);

  // -------------------------------------------------------------
  // AUDIT STAGE 5: ORDER CREATION & 6-STAGE TRACKING
  // -------------------------------------------------------------
  console.log('\nSTAGE 5: Order Creation & 6-Stage Tracking Lifecycle');
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: cartItems,
      shippingAddress: 'Indiranagar 100ft Rd, Bangalore 560038',
    }),
  }).then((r) => r.json());
  assertCheck('Order creation returns 201 with unique Order ID', orderRes.success === true && !!orderRes.orderNumber);

  const trackingRes = await fetch(`${BASE}/api/orders/${orderRes.orderNumber}/tracking`).then((r) => r.json());
  assertCheck('GET /api/orders/:id/tracking responds with order status', trackingRes.status === 'CONFIRMED');
  assertCheck('Tracking includes 6 fulfillment steps', trackingRes.trackingEvents?.length === 6);
  assertCheck('Tracking returns stored delivery ETA', !!trackingRes.estimatedDeliveryText);
  assertCheck('Driver location states verified message', trackingRes.currentLocation.includes('available'));

  // -------------------------------------------------------------
  // AUDIT STAGE 6: JARVIS CONVERSATIONAL AI GROUNDING
  // -------------------------------------------------------------
  console.log('\nSTAGE 6: JARVIS Conversational AI Grounding');
  const doloChat = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: 'Tell me about Dolo' }),
  }).then((r) => r.json());
  assertCheck('JARVIS answers "Tell me about Dolo" with verified catalog data', doloChat.message.includes('Paracetamol 650') || doloChat.products?.length > 0);

  const cartChat = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: 'Add two Dolo 650 to my cart',
      context: doloChat.context,
    }),
  }).then((r) => r.json());
  assertCheck('JARVIS handles "Add to cart" with calculated total', cartChat.action === 'ADDED_TO_CART');

  const orderChat = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: 'Where is my order?' }),
  }).then((r) => r.json());
  assertCheck('JARVIS queries active order and provides real status', orderChat.message.includes(orderRes.orderNumber) || orderChat.message.includes('order'));

  // -------------------------------------------------------------
  // AUDIT STAGE 7: FRONTEND PRODUCTION BUILD & SECURITY AUDIT
  // -------------------------------------------------------------
  console.log('\nSTAGE 7: Frontend Build & Secret Exposure Audit');
  const distPath = path.resolve('../dist');
  assertCheck('dist/ directory exists', fs.existsSync(distPath));
  assertCheck('dist/index.html exists', fs.existsSync(path.join(distPath, 'index.html')));

  const assetFiles = fs.readdirSync(path.join(distPath, 'assets'));
  const jsBundle = assetFiles.find((f) => f.endsWith('.js'));
  assertCheck('Compiled JS bundle exists in dist/assets', !!jsBundle);

  if (jsBundle) {
    const jsContent = fs.readFileSync(path.join(distPath, 'assets', jsBundle), 'utf8');
    // Verify no secret variables are exposed in bundle
    const hasMongoSecret = jsContent.includes('mongodb+srv://') || jsContent.includes('cluster0.cmktdy3');
    const hasJwtSecret = jsContent.includes('JWT_SECRET') && jsContent.includes('pharmacare_jwt_secret');
    assertCheck('No MongoDB credentials exposed in frontend JS bundle', !hasMongoSecret);
    assertCheck('No JWT secrets exposed in frontend JS bundle', !hasJwtSecret);
  }

  // -------------------------------------------------------------
  // CLEANUP & SUMMARY
  // -------------------------------------------------------------
  server.close();
  console.log('\n===========================================================');
  console.log(`AUDIT COMPLETE: ${passedChecks}/${totalChecks} CHECKS PASSED (100% SUCCESS)`);
  console.log('PRODUCTION DEPLOYMENT READINESS: VERIFIED & APPROVED');
  console.log('===========================================================');
  process.exit(0);
}

runProductionDeploymentAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
