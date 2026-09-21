import mongoose from 'mongoose';
import dns from 'dns';

// Configure Google DNS for reliable Atlas SRV record resolution
// execSync/ipconfig removed — not available on Vercel Linux environment
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (_) {
  // Keep system defaults if DNS override fails
}


let isConnected = false;

export const isDbConnected = () => isConnected;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[MongoDB Warning]: MONGODB_URI is not defined in environment variables.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: 'pharmacare',
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[MongoDB Connected]: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    isConnected = false;
    console.error(`\n⚠️  [MongoDB Connection Notice]: Could not connect to MongoDB Atlas.`);
    console.error(`   Error: ${error.message}`);
    console.error(`   👉 To fix this in MongoDB Atlas:`);
    console.error(`      1. Go to https://cloud.mongodb.com/`);
    console.error(`      2. Navigate to "Security" -> "Network Access"`);
    console.error(`      3. Click "Add IP Address" and select "Allow Access From Anywhere" (0.0.0.0/0) or "Add Current IP Address"`);
    console.error(`      4. Wait ~1 minute for Atlas to apply the rule.\n`);
    console.log(`[PharmaCare Server]: Running in resilient mode. AI features and routes remain operational.\n`);
    return null;
  }
};

