import 'dotenv/config';
process.env.NODE_ENV = 'test';
import http from 'http';
import app from './server.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';

const PORT = 5099;

const runTests = async () => {
  console.log('=== STARTING PHARMACARE AI AUTHENTICATION & RBAC TEST SUITE ===\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  let passed = 0;
  let failed = 0;

  const assert = (condition, desc) => {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      failed++;
    }
  };

  const req = async (path, options = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  try {
    // 1. Customer Demo Account Login
    const demoCustRes = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'sushanth@gmail.com',
        password: '123456',
        expectedRole: 'USER',
      }),
    });
    assert(
      demoCustRes.status === 200 && demoCustRes.data.user?.role === 'USER',
      `Customer Demo Login (sushanth@gmail.com / 123456) succeeds with role USER (Status: ${demoCustRes.status})`
    );
    const customerToken = demoCustRes.data.token;

    // 2. Pharmacy Owner Demo Account Login
    const demoOwnerRes = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'pharmacare@gmail.com',
        password: '789456',
        expectedRole: 'OWNER',
      }),
    });
    assert(
      demoOwnerRes.status === 200 && demoOwnerRes.data.user?.role === 'OWNER',
      `Owner Demo Login (pharmacare@gmail.com / 789456) succeeds with role OWNER (Status: ${demoOwnerRes.status})`
    );
    const ownerToken = demoOwnerRes.data.token;

    // 3. Non-existent Account: Exact message check
    const notFoundRes = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'unregistered_patient_2026@test.com',
        password: 'Password123',
      }),
    });
    assert(
      notFoundRes.status === 404 &&
      notFoundRes.data.error?.message === 'Account not found. Please register first.',
      `Unregistered email returns exact message: 'Account not found. Please register first.'`
    );

    // 4. Invalid Password Check
    const badPassRes = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'sushanth@gmail.com',
        password: 'wrong_password_999',
      }),
    });
    assert(
      badPassRes.status === 401 && badPassRes.data.error?.code === 'INVALID_CREDENTIALS',
      `Invalid password returns 401 INVALID_CREDENTIALS`
    );

    // 5. Role Mismatch: Customer logging into Owner Portal
    const custInOwnerPortal = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'sushanth@gmail.com',
        password: '123456',
        expectedRole: 'OWNER',
      }),
    });
    assert(
      custInOwnerPortal.status === 403 &&
      custInOwnerPortal.data.error?.code === 'ROLE_MISMATCH',
      `Customer attempting Owner Login portal returns 403 ROLE_MISMATCH`
    );

    // 6. Role Mismatch: Owner logging into Customer Portal
    const ownerInCustPortal = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'pharmacare@gmail.com',
        password: '789456',
        expectedRole: 'USER',
      }),
    });
    assert(
      ownerInCustPortal.status === 403 &&
      ownerInCustPortal.data.error?.code === 'ROLE_MISMATCH',
      `Owner attempting Customer Login portal returns 403 ROLE_MISMATCH`
    );

    // 7. Authorization: Customer cannot access Owner Dashboard API
    const custAccessOwnerApi = await req('/api/owner/dashboard', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      custAccessOwnerApi.status === 403 && custAccessOwnerApi.data.error?.code === 'FORBIDDEN',
      `Customer JWT is blocked from /api/owner/dashboard (403 FORBIDDEN)`
    );

    // 8. Authorization: Owner CAN access Owner Dashboard API
    const ownerAccessOwnerApi = await req('/api/owner/dashboard', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      ownerAccessOwnerApi.status === 200 && ownerAccessOwnerApi.data.success === true,
      `Owner JWT is authorized for /api/owner/dashboard (200 OK)`
    );

    // 9. Order Management Protection: Customer cannot patch order status
    const custPatchStatus = await req('/api/orders/65f1a2b3c4d5e6f7a8b9c0d1/status', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    assert(
      custPatchStatus.status === 403,
      `Customer cannot modify order status (403 Forbidden)`
    );

    // 10. Registration: Mismatched Passwords Validation
    const mismatchReg = await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Patient',
        email: 'test_mismatch@example.com',
        password: 'password123',
        confirmPassword: 'different_password',
        role: 'USER',
      }),
    });
    assert(
      mismatchReg.status === 400 && mismatchReg.data.error?.code === 'PASSWORDS_DO_NOT_MATCH',
      `Registration rejects mismatched password and confirmPassword (400 PASSWORDS_DO_NOT_MATCH)`
    );

    // 11. Registration: Owner registration requires authorization code
    const unauthorizedOwnerReg = await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Fake Owner',
        email: `fake_owner_${Date.now()}@example.com`,
        password: 'password123',
        confirmPassword: 'password123',
        role: 'OWNER',
      }),
    });
    assert(
      unauthorizedOwnerReg.status === 403 && unauthorizedOwnerReg.data.error?.code === 'OWNER_KEY_REQUIRED',
      `Owner registration without authorization key is blocked (403 OWNER_KEY_REQUIRED)`
    );

    // 12. Registration: Successful Customer Registration with DB Persistence
    const uniqueEmail = `patient_${Date.now()}@example.com`;
    const validReg = await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Ananya Sharma',
        email: uniqueEmail,
        password: 'SecurePass@123',
        confirmPassword: 'SecurePass@123',
        phone: '+91 98450 12345',
        role: 'USER',
      }),
    });
    assert(
      validReg.status === 201 && validReg.data.success === true,
      `New Customer registration succeeds in MongoDB (Status: 201 Created)`
    );

    // 13. Registration: Duplicate Email check
    const duplicateReg = await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Ananya Duplicate',
        email: uniqueEmail,
        password: 'SecurePass@123',
        confirmPassword: 'SecurePass@123',
        role: 'USER',
      }),
    });
    assert(
      duplicateReg.status === 409 && duplicateReg.data.error?.code === 'USER_EXISTS',
      `Duplicate email registration returns 409 USER_EXISTS`
    );

    // 14. Persistent Login: Newly registered user can immediately log in from DB
    const persistentLoginRes = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'SecurePass@123',
        expectedRole: 'USER',
      }),
    });
    assert(
      persistentLoginRes.status === 200 && persistentLoginRes.data.user?.email === uniqueEmail,
      `Newly registered DB user successfully logs in with password verification`
    );

    // Clean up test user
    await User.deleteOne({ email: uniqueEmail });

    // 15. Session Profile: /api/auth/me returns current user profile
    const meRes = await req('/api/auth/me', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      meRes.status === 200 && meRes.data.user?.email === 'sushanth@gmail.com',
      `Persistent session verification /api/auth/me returns authenticated user profile`
    );

    console.log(`\n==================================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==================================================\n`);

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test suite error:', err);
    server.close();
    process.exit(1);
  }
};

runTests();
