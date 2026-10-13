import mongoose from 'mongoose';
import dns from 'dns';

// Configure DNS for reliable Atlas SRV record resolution
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (_) {
  // Keep system defaults if DNS override fails
}

const LOCAL_DEV_URI = 'mongodb://127.0.0.1:27017/pharmacare';

let isConnected = false;
let cachedPromise = null;

/**
 * Redact username and password from MongoDB URI for safe logging
 */
export const sanitizeUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

export const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Connect to MongoDB once during application startup.
 * Explicitly distinguishes local development from production.
 */
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

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  let targetUri;
  if (isProduction) {
    if (!process.env.MONGODB_URI) {
      console.error('[MongoDB Error]: MONGODB_URI environment variable is required in production.');
      return null;
    }
    targetUri = process.env.MONGODB_URI.trim();
  } else {
    // In local development, prefer explicit local development URI unless MONGODB_URI is provided
    targetUri = (process.env.MONGODB_URI && !process.env.USE_LOCAL_DB) 
      ? process.env.MONGODB_URI.trim() 
      : LOCAL_DEV_URI;
  }

  // Clean empty appName query param if present
  if (targetUri.includes('?appName') && !targetUri.includes('?appName=')) {
    targetUri = targetUri.replace(/\/?\?appName.*$/, '/?retryWrites=true&w=majority&appName=Cluster0');
  }

  try {
    cachedPromise = mongoose.connect(targetUri, {
      dbName: 'pharmacare',
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    const conn = await cachedPromise;
    isConnected = true;
    console.log(`[MongoDB Connected]: ${conn.connection.host} (${sanitizeUri(targetUri)})`);
    return conn;
  } catch (err) {
    cachedPromise = null;
    isConnected = false;
    console.error(`[MongoDB Error]: Connection failed to ${sanitizeUri(targetUri)}: ${err.message}`);

    // In local development, if remote Atlas failed, attempt local MongoDB fallback
    if (!isProduction && targetUri !== LOCAL_DEV_URI) {
      console.log(`[MongoDB Info]: Attempting local development fallback at ${LOCAL_DEV_URI}...`);
      try {
        cachedPromise = mongoose.connect(LOCAL_DEV_URI, {
          dbName: 'pharmacare',
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000,
        });
        const localConn = await cachedPromise;
        isConnected = true;
        console.log(`[MongoDB Connected]: Local development database connected at ${localConn.connection.host}`);
        return localConn;
      } catch (localErr) {
        cachedPromise = null;
        isConnected = false;
        console.error(`[MongoDB Error]: Local fallback also failed: ${localErr.message}`);
      }
    }

    if (isProduction) {
      console.error('[MongoDB Critical]: Production database connection failed. Halting silent fallback to protect data integrity.');
    }
    return null;
  }
};

export const closeDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      isConnected = false;
      cachedPromise = null;
      console.log('[MongoDB]: Connection closed gracefully.');
    }
  } catch (err) {
    console.error('[MongoDB]: Error during disconnect:', err.message);
  }
};

