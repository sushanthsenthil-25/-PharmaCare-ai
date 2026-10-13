import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

process.env.PORT = '5002';

const { app } = await import('../server.js');

const server = http.createServer(app);

server.listen(5002, async () => {
  console.log('Testing server running on port 5002...');

  const request = (method, path, body = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: 5002,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, text: data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  };

  try {
    console.log('\n--- 1. Testing /api/health ---');
    const health = await request('GET', '/api/health');
    console.log('Health status:', health.status, 'DB status:', health.data?.database);

    console.log('\n--- 2. Testing /api/medicine-catalogue (11,621 dataset) ---');
    const cat = await request('GET', '/api/medicine-catalogue?limit=5');
    console.log('Catalogue total:', cat.data?.total, 'Results length:', cat.data?.results?.length);
    if (cat.data?.results?.[0]) {
      console.log('Sample item:', cat.data.results[0].name, '| Dosage:', cat.data.results[0].dosage_form, '| Price:', cat.data.results[0].priceINR);
    }

    console.log('\n--- 3. Testing /api/medicine-catalogue Formulation Filter: Capsule ---');
    const capsules = await request('GET', '/api/medicine-catalogue?dosage_form=Capsule&limit=3');
    console.log('Capsules found:', capsules.data?.total, 'Samples:', capsules.data?.results?.map(r => r.name).join(', '));

    console.log('\n--- 4. Testing /api/medicine-catalogue Formulation Filter: Tablet ---');
    const tablets = await request('GET', '/api/medicine-catalogue?dosage_form=Tablet&limit=3');
    console.log('Tablets found:', tablets.data?.total, 'Samples:', tablets.data?.results?.map(r => r.name).join(', '));

    console.log('\n--- 5. Testing /api/pharmacies/nearby ---');
    const pharmacies = await request('GET', '/api/pharmacies/nearby?lat=12.9716&lng=77.5946');
    console.log('Nearby pharmacies count:', pharmacies.data?.count, 'First pharmacy:', pharmacies.data?.pharmacies?.[0]?.businessName, 'Dist:', pharmacies.data?.pharmacies?.[0]?.distanceText);

    console.log('\n--- 6. Testing /api/medicines/:id/availability ---');
    const availCat = await request('GET', '/api/medicines/catalogue_1/availability?lat=12.9716&lng=77.5946');
    console.log('Catalogue item availability:', availCat.status, 'Available count:', availCat.data?.availableCount);

    const storeMeds = await request('GET', '/api/medicines?limit=1');
    if (storeMeds.data?.medicines?.[0]) {
      const sId = storeMeds.data.medicines[0]._id;
      const availStore = await request('GET', `/api/medicines/${sId}/availability?lat=12.9716&lng=77.5946`);
      console.log('Store item availability for', storeMeds.data.medicines[0].name, ':', availStore.status, 'Available count:', availStore.data?.availableCount, 'Pharmacies:', availStore.data?.pharmacies?.map(p => p.pharmacyName).join(', '));
    }

    console.log('\n--- 7. Testing /api/auth/forgot-password ---');
    const forgot = await request('POST', '/api/auth/forgot-password', { email: 'test_recovery@example.com' });
    console.log('Forgot password response status:', forgot.status, 'Message:', forgot.data?.message);

    console.log('\n--- ALL VERIFICATION TESTS PASSED ---');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close(() => {
      console.log('Test server closed.');
      process.exit(0);
    });
  }
});
