import mongoose from 'mongoose';
import dns from 'dns';

// Configure DNS for reliable Atlas SRV record resolution in serverless environments
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (_) {
  // Keep system defaults if DNS override fails
}

const DEFAULT_URI = 'mongodb+srv://sushanthsenthil_db_user:BBRyFb15uoxzuZqg@cluster0.cmktdy3.mongodb.net/pharmacare?retryWrites=true&w=majority&appName=Cluster0';

let isConnected = false;
let cachedPromise = null;

export const isDbConnected = () => mongoose.connection.readyState === 1;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  if (cachedPromise) {
    try {
      await cachedPromise;
      isConnected = mongoose.connection.readyState === 1;
      return mongoose.connection;
    } catch (_) {
      cachedPromise = null;
    }
  }

  const uri = process.env.MONGODB_URI || DEFAULT_URI;

  try {
    cachedPromise = mongoose.connect(uri, {
      dbName: 'pharmacare',
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    const conn = await cachedPromise;
    isConnected = true;
    console.log(`[MongoDB Connected]: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    cachedPromise = null;
    isConnected = false;
    console.error(`\n⚠️  [MongoDB Connection Notice]: Could not connect to MongoDB Atlas.`);
    console.error(`   Error: ${error.message}\n`);
    return null;
  }
};
