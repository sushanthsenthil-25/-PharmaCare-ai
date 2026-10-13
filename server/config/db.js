import mongoose from 'mongoose';

// Configure Mongoose for serverless execution: disable command buffering
mongoose.set('bufferCommands', false);

const LOCAL_DEV_URI = 'mongodb://127.0.0.1:27017/pharmacare';

// Maintain cached connection promise on global across serverless invocations
if (!global._mongooseConn) {
  global._mongooseConn = { conn: null, promise: null };
}

/**
 * Redact username and password from MongoDB URI for safe logging
 */
export const sanitizeUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

export const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Perform a real, bounded MongoDB ping command to verify end-to-end database connectivity
 */
export const pingDB = async (timeoutMs = 2000) => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return false;
  }
  try {
    const pingPromise = mongoose.connection.db.admin().ping();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Ping timeout')), timeoutMs)
    );
    const res = await Promise.race([pingPromise, timeoutPromise]);
    return !!(res && (res.ok === 1 || res.ok === true));
  } catch (_) {
    return false;
  }
};

/**
 * Connect to MongoDB with serverless connection pooling and caching.
 * Reuses existing active connections, awaits in-flight promises, and handles retries.
 */
export const connectDB = async () => {
  if (!global._mongooseConn) {
    global._mongooseConn = { conn: null, promise: null };
  }

  if (mongoose.connection.readyState === 1) {
    global._mongooseConn.conn = mongoose.connection;
    return mongoose.connection;
  }

  if (global._mongooseConn.promise) {
    try {
      await global._mongooseConn.promise;
      if (mongoose.connection.readyState === 1) {
        global._mongooseConn.conn = mongoose.connection;
        return mongoose.connection;
      }
      global._mongooseConn.promise = null;
    } catch (_) {
      global._mongooseConn.promise = null;
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
    if (!targetUri) {
      console.error('[MongoDB Error]: MONGODB_URI is present but empty in production.');
      return null;
    }
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
    global._mongooseConn.promise = mongoose.connect(targetUri, {
      dbName: 'pharmacare',
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      bufferCommands: false,
    });
    const conn = await global._mongooseConn.promise;
    global._mongooseConn.conn = conn.connection;
    console.log(`[MongoDB Connected]: ${conn.connection.host} (${sanitizeUri(targetUri)})`);
    return conn;
  } catch (err) {
    global._mongooseConn.promise = null;
    global._mongooseConn.conn = null;
    console.error(`[MongoDB Error]: Connection failed to ${sanitizeUri(targetUri)} (${err.name || 'Error'}${err.code ? `, code ${err.code}` : ''}): ${err.message}`);

    // In local development, if remote Atlas failed, attempt local MongoDB fallback
    if (!isProduction && targetUri !== LOCAL_DEV_URI) {
      console.log(`[MongoDB Info]: Attempting local development fallback at ${LOCAL_DEV_URI}...`);
      try {
        global._mongooseConn.promise = mongoose.connect(LOCAL_DEV_URI, {
          dbName: 'pharmacare',
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000,
          bufferCommands: false,
        });
        const localConn = await global._mongooseConn.promise;
        global._mongooseConn.conn = localConn.connection;
        console.log(`[MongoDB Connected]: Local development database connected at ${localConn.connection.host}`);
        return localConn;
      } catch (localErr) {
        global._mongooseConn.promise = null;
        global._mongooseConn.conn = null;
        console.error(`[MongoDB Error]: Local fallback also failed (${localErr.name || 'Error'}): ${localErr.message}`);
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
      if (global._mongooseConn) {
        global._mongooseConn.conn = null;
        global._mongooseConn.promise = null;
      }
      console.log('[MongoDB]: Connection closed gracefully.');
    }
  } catch (err) {
    console.error('[MongoDB]: Error during disconnect:', err.message);
  }
};
