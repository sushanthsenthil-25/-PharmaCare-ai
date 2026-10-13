
const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('=== STARTING PHARMACARE AI VERIFICATION SUITE ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
    }
  }

  // 1. Authenticate Demo Customer
  console.log('--- Step 1: Authentication & Role Enforcement ---');
  const customerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sushanth@gmail.com', password: '123456', role: 'USER' }),
  }).then(r => r.json());

  assert(customerLogin.success && customerLogin.user.role === 'USER', 'Customer login succeeds with role USER');
  const customerToken = customerLogin.token;

  // 2. Authenticate Demo Owner 1 (pharmacare@gmail.com)
  const owner1Login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pharmacare@gmail.com', password: '789456', role: 'OWNER' }),
  }).then(r => r.json());

  assert(owner1Login.success && owner1Login.user.role === 'OWNER', 'Owner 1 (pharmacare@gmail.com) login succeeds with role OWNER');
  const owner1Token = owner1Login.token;

  // 3. Authenticate Owner 2 (owner@pharmacare.ai)
  const owner2Login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@pharmacare.ai', password: 'Password123!', role: 'OWNER' }),
  }).then(r => r.json());

  assert(owner2Login.success && owner2Login.user.role === 'OWNER', 'Owner 2 (owner@pharmacare.ai) login succeeds with role OWNER');
  const owner2Token = owner2Login.token;

  // 4. Test Customer cannot access Owner Endpoints (403)
  console.log('\n--- Step 2: Route & Role Access Control ---');
  const customerOwnerAccess = await fetch(`${BASE_URL}/api/owner/medicines`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(customerOwnerAccess.status === 403, 'Customer blocked from /api/owner/medicines (HTTP 403 Forbidden)');

  const unauthenticatedOwnerAccess = await fetch(`${BASE_URL}/api/owner/medicines`);
  assert(unauthenticatedOwnerAccess.status === 401, 'Unauthenticated user blocked from /api/owner/medicines (HTTP 401 Unauthorized)');

  // 5. Test Owner 1 Inventory Isolation (Should have 27 seeded medicines for pharmacare@gmail.com)
  console.log('\n--- Step 3: Owner Inventory Isolation ---');
  const owner1Meds = await fetch(`${BASE_URL}/api/owner/medicines`, {
    headers: { Authorization: `Bearer ${owner1Token}` },
  }).then(r => r.json());

  const owner1InitialCount = owner1Meds.medicines?.length || 0;
  assert(owner1Meds.success && owner1InitialCount >= 25, `Owner 1 inventory shows strictly their own populated medicines (Found: ${owner1InitialCount}, expected >= 25)`);

  // 6. Test Owner 2 Inventory Isolation (Should have 20 medicines)
  const owner2Meds = await fetch(`${BASE_URL}/api/owner/medicines`, {
    headers: { Authorization: `Bearer ${owner2Token}` },
  }).then(r => r.json());

  assert(owner2Meds.success && owner2Meds.medicines.length === 20, `Owner 2 inventory shows strictly their 20 medicines (Found: ${owner2Meds.medicines?.length})`);

  const owner2SampleMed = owner2Meds.medicines[0];

  // 7. Test Cross-Owner Modification Blocked (Owner 1 tries to edit/delete Owner 2's medicine)
  console.log('\n--- Step 4: Cross-Owner Mutation Attack Prevention ---');
  const crossEditRes = await fetch(`${BASE_URL}/api/owner/medicines/${owner2SampleMed._id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner1Token}`,
    },
    body: JSON.stringify({ name: 'Hacked Name', price: 999 }),
  });
  assert(crossEditRes.status === 403, 'Owner 1 forbidden from updating Owner 2 medicine (HTTP 403)');

  const crossDeleteRes = await fetch(`${BASE_URL}/api/owner/medicines/${owner2SampleMed._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${owner1Token}` },
  });
  assert(crossDeleteRes.status === 403, 'Owner 1 forbidden from deleting Owner 2 medicine (HTTP 403)');

  const crossStockRes = await fetch(`${BASE_URL}/api/owner/medicines/${owner2SampleMed._id}/stock`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner1Token}`,
    },
    body: JSON.stringify({ stock: 0 }),
  });
  assert(crossStockRes.status === 403, 'Owner 1 forbidden from updating Owner 2 stock (HTTP 403)');

  // 8. Test Owner 1 Adds Medicine to their Inventory
  console.log('\n--- Step 5: Owner 1 Adding Medicine & Inventory Lifecycle ---');
  const newMedRes = await fetch(`${BASE_URL}/api/owner/medicines`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner1Token}`,
    },
    body: JSON.stringify({
      name: 'Ibuprofen Express 200',
      genericName: 'Ibuprofen',
      category: 'Pain Relief',
      strength: '200mg',
      form: 'Tablet',
      price: 45,
      stock: 75,
      batchNumber: 'BATCH-OWNER1-99',
      manufacturingDate: '2026-01-01',
      expiryDate: '2028-12-31',
    }),
  }).then(r => r.json());

  assert(newMedRes.success && newMedRes.medicine && newMedRes.medicine.stock === 75, 'Owner 1 successfully creates new medicine in their inventory');
  const createdMedId = newMedRes.medicine?._id;

  // Verify Owner 1 now has initialCount + 1 medicines
  const owner1UpdatedMeds = await fetch(`${BASE_URL}/api/owner/medicines`, {
    headers: { Authorization: `Bearer ${owner1Token}` },
  }).then(r => r.json());
  assert(owner1UpdatedMeds.medicines.length === owner1InitialCount + 1, `Owner 1 now has exactly ${owner1InitialCount + 1} medicines in inventory (Found: ${owner1UpdatedMeds.medicines.length})`);

  // Verify Owner 2 still has 20 medicines (unaffected)
  const owner2UntouchedMeds = await fetch(`${BASE_URL}/api/owner/medicines`, {
    headers: { Authorization: `Bearer ${owner2Token}` },
  }).then(r => r.json());
  assert(owner2UntouchedMeds.medicines.length === 20, `Owner 2 inventory remains unchanged at 20 medicines`);

  // 9. Update Stock as Owner 1 to 0 (Out of stock)
  console.log('\n--- Step 6: Stock Quantity Lifecycle & Customer Visibility ---');
  const updateStockZero = await fetch(`${BASE_URL}/api/owner/medicines/${createdMedId}/stock`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner1Token}`,
    },
    body: JSON.stringify({ stock: 0 }),
  }).then(r => r.json());

  assert(updateStockZero.success && updateStockZero.medicine.stock === 0, 'Owner 1 updates stock quantity to 0');

  // Clean up: Delete created medicine so Owner 1 returns to clean initial state
  const deleteCreated = await fetch(`${BASE_URL}/api/owner/medicines/${createdMedId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${owner1Token}` },
  }).then(r => r.json());
  assert(deleteCreated.success, 'Owner 1 deletes test medicine entry');

  const owner1FinalMeds = await fetch(`${BASE_URL}/api/owner/medicines`, {
    headers: { Authorization: `Bearer ${owner1Token}` },
  }).then(r => r.json());
  assert(owner1FinalMeds.medicines.length === owner1InitialCount, `Owner 1 inventory cleanly returns to initial count (${owner1InitialCount})`);

  // 10. Customer Catalogue & 3-way Availability Check
  console.log('\n--- Step 7: Customer Full Catalogue & 3-Way Availability ---');
  const catList = await fetch(`${BASE_URL}/api/v1/medicine-catalogue?page=1&page_size=20`).then(r => r.json());
  assert(catList.total === 11621, `Customer catalogue returns full 11,621 formulations (Total: ${catList.total})`);
  assert(catList.results.length === 20, 'Customer catalogue pagination works (20 items per page)');

  // Check search and availability status
  const searchPara = await fetch(`${BASE_URL}/api/v1/medicine-catalogue/search?q=Paracetamol&page=1&page_size=5`).then(r => r.json());
  assert(searchPara.results.length > 0, `Catalogue search for Paracetamol returned ${searchPara.results.length} results`);

  const hasAvailabilityStatus = searchPara.results.every(r => ['IN_STOCK', 'OUT_OF_STOCK', 'UNVERIFIED'].includes(r.availabilityStatus));
  assert(hasAvailabilityStatus, 'Every catalogue medicine has valid 3-way availabilityStatus (IN_STOCK, OUT_OF_STOCK, or UNVERIFIED)');

  const inStockItem = searchPara.results.find(r => r.availabilityStatus === 'IN_STOCK');
  assert(!!inStockItem, `Found live in-stock formulation: ${inStockItem?.name} (Stock: ${inStockItem?.stock})`);

  // 11. Customer Order Isolation (Customer cannot access another customer's private order)
  console.log('\n--- Step 8: Customer Order Privacy & Security ---');
  // Customer creates an order
  const createOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      items: [{
        productId: owner2SampleMed._id,
        productType: 'Medicine',
        name: owner2SampleMed.name,
        price: owner2SampleMed.price,
        qty: 1,
      }],
      shippingAddress: '123 Test St, Bangalore',
    }),
  }).then(r => r.json());

  assert(createOrderRes.success && createOrderRes.order, 'Customer successfully places order');
  const customerOrderId = createOrderRes.order?._id || createOrderRes.order?.orderNumber;

  // Unauthenticated attempt to view private order -> 401
  const unauthOrderRes = await fetch(`${BASE_URL}/api/orders/${customerOrderId}`);
  assert(unauthOrderRes.status === 401, 'Unauthenticated access to customer private order returns HTTP 401');

  // Customer A accesses own order -> 200
  const authOrderRes = await fetch(`${BASE_URL}/api/orders/${customerOrderId}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(authOrderRes.status === 200, 'Customer accessing own order succeeds (HTTP 200)');

  // Owner 1 (who does NOT own this medicine or order) attempts to access order -> 403
  const owner1CrossOrder = await fetch(`${BASE_URL}/api/orders/${customerOrderId}`, {
    headers: { Authorization: `Bearer ${owner1Token}` },
  });
  assert(owner1CrossOrder.status === 403, 'Uninvolved Owner 1 blocked from accessing order (HTTP 403)');

  // 12. Test Nearby Pharmacies 5km Default & Configurable Radius
  console.log('\n--- Step 9: Functional Location & Nearby Pharmacy Search ---');
  const nearby5km = await fetch(`${BASE_URL}/api/pharmacies/nearby?lat=12.9784&lng=77.6408`).then(r => r.json());
  assert(nearby5km.success && nearby5km.radiusKm === 5, 'Nearby pharmacies defaults to 5 km radius');
  assert(nearby5km.pharmacies.every(p => p.distanceKm <= 5), 'All returned pharmacies strictly fall within 5 km radius');
  assert(nearby5km.pharmacies.length > 0, `Found verified pharmacies within 5 km (Found: ${nearby5km.pharmacies.length})`);

  // Check 1 km radius
  const nearby1km = await fetch(`${BASE_URL}/api/pharmacies/nearby?lat=12.9784&lng=77.6408&radius=1`).then(r => r.json());
  assert(nearby1km.success && nearby1km.radiusKm === 1, 'Nearby pharmacies respects 1 km radius');
  assert(nearby1km.pharmacies.every(p => p.distanceKm <= 1), 'All returned pharmacies strictly fall within 1 km radius');
  assert(nearby1km.pharmacies.length <= nearby5km.pharmacies.length, '1 km radius returns subset of 5 km radius');

  // Verify nearest-first sorting
  const distances = nearby5km.pharmacies.map(p => p.distanceKm);
  const isSorted = distances.every((d, i) => i === 0 || d >= distances[i - 1]);
  assert(isSorted, 'Nearby pharmacies are strictly sorted by nearest distance first');

  // Test geocoding search
  const geocodeSearch = await fetch(`${BASE_URL}/api/pharmacies/geocode/search?q=Indiranagar`).then(r => r.json());
  assert(geocodeSearch.success && geocodeSearch.results.length > 0, 'Geocode search resolves locality with valid coordinates');

  // Test reverse geocoding
  const reverseGeocode = await fetch(`${BASE_URL}/api/pharmacies/geocode/reverse?lat=12.9784&lng=77.6408`).then(r => r.json());
  assert(reverseGeocode.success && reverseGeocode.address, 'Reverse geocoding resolves coordinates to address');

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
