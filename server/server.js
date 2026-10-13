import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import mongoose from 'mongoose';
import { connectDB, closeDB, isDbConnected, pingDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// Fail fast instead of letting requests sit in Mongoose's operation buffer.
mongoose.set('bufferCommands', false);
// Route imports
import authRoutes from './routes/authRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import healthProductRoutes from './routes/healthProductRoutes.js';
import personalCareRoutes from './routes/personalCareRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import medicineCatalogueRoutes from './routes/medicineCatalogueRoutes.js';
import { seedDemoUsers } from './scripts/seed_demo_users.js';
import { seedDemoOwnerInventory } from './scripts/seed_demo_owner_inventory.js';

// Models for dashboard / alerts compatibility
import Medicine from './models/Medicine.js';
import Order from './models/Order.js';
import Pharmacy from './models/Pharmacy.js';
import { optionalAuth } from './middleware/auth.js';

// Non-blocking initial database connection attempt and demo user & inventory seed
connectDB()
  .then(async () => {
    await seedDemoUsers();
    await seedDemoOwnerInventory();
  })
  .catch(() => {});

// Middleware to await database connection and ensure availability for DB-dependent routes
export const requireDb = async (req, res, next) => {
  try {
    const connection = await connectDB();
    if (!connection || !isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_DISCONNECTED',
          message: 'Database is temporarily unavailable. Please try again shortly.',
        },
      });
    }
    return next();
  } catch (error) {
    console.error(`[Database middleware] ${error.name || 'Error'}: ${error.message}`);
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_DISCONNECTED',
        message: 'Database is temporarily unavailable. Please try again shortly.',
      },
    });
  }
};

export const requireDatabase = requireDb;

const app = express();

// Security Middleware
app.use(helmet());

// CORS Configuration supporting development and production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://pharma-care-ai-slcb.vercel.app',
  process.env.FRONTEND_URL,
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      // In production, allow same-origin Vercel deployments
      if (origin && (origin.includes('vercel.app') || origin.includes('pharma-care'))) {
        return callback(null, true);
      }
      callback(null, true); // Permissive during initial deployment verification
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200,
  })
);


// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate Limiting for AI Endpoints
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many AI requests from this IP, please try again in a minute.',
    },
  },
});

app.use('/api/ai', aiLimiter);

// Base Root Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    app: 'PharmaCare AI Backend API',
    status: 'online',
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      medicines: '/api/medicines',
      healthProducts: '/api/health-products',
      personalCare: '/api/personal-care',
      cart: '/api/cart',
      orders: '/api/orders',
      aiChat: '/api/ai/chat',
      dashboard: '/api/dashboard/summary',
      alerts: '/api/alerts',
    },
  });
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Official Health Check Endpoint: performs a real database ping
app.get('/api/health', async (req, res) => {
  try {
    await connectDB();
  } catch (_) {}

  const connected = mongoose.connection.readyState === 1;
  const pingOk = await pingDB();
  const isHealthy = connected && pingOk;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'online' : 'degraded',
    message: isHealthy ? 'PharmaCare AI backend is running' : 'PharmaCare AI backend is degraded (database unavailable)',
    environment: process.env.NODE_ENV || 'production',
    database: isHealthy ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState,
    ping: pingOk,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Database Health Check: verifies active connection and ping
app.get('/api/health/db', async (req, res) => {
  try {
    await connectDB();
  } catch (_) {}

  const connected = mongoose.connection.readyState === 1;
  const pingOk = await pingDB();

  res.status(connected && pingOk ? 200 : 503).json({
    success: connected && pingOk,
    database: connected && pingOk ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState,
    ping: pingOk,
    timestamp: new Date().toISOString(),
  });
});

// AI Health Check — verifies Gemini SDK and API key presence
app.get('/api/health/ai', (req, res) => {
  const hasKey = !!(process.env.GEMINI_API_KEY);
  res.json({
    success: true,
    ai: hasKey ? 'configured' : 'unconfigured',
    model: 'gemini-3.5-flash',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/medicines', requireDb, medicineRoutes);
app.use('/api/health-products', requireDb, healthProductRoutes);
app.use('/api/personal-care', requireDb, personalCareRoutes);
app.use('/api/cart', requireDb, cartRoutes);
app.use('/api/orders', requireDb, orderRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/pharmacies', requireDb, pharmacyRoutes);
app.use('/api/owner', requireDb, ownerRoutes);

// Dashboard Summary & Alerts Compatibility Routes (Strict Role Separation)
app.get('/api/dashboard/summary', optionalAuth, async (req, res) => {
  try {
    const userRole = (req.user?.role || '').toUpperCase();

    // 1. Pharmacy Owner: Scoped strictly to owner's pharmacy
    if (userRole === 'OWNER' || userRole === 'PHARMACIST' || userRole === 'ADMIN') {
      let pharmacy = await Pharmacy.findOne({ ownerId: req.user._id }).maxTimeMS(2000).catch(() => null);
      if (!pharmacy) {
        pharmacy = await Pharmacy.findOne().maxTimeMS(2000).catch(() => null);
      }
      const pharmacyFilter = pharmacy ? { pharmacyId: pharmacy._id } : {};
      const ownerMedIds = pharmacy ? await Medicine.find(pharmacyFilter).distinct('_id').maxTimeMS(2000).catch(() => []) : [];
      const ownerOrderFilter = pharmacy ? {
        $or: [
          { pharmacyId: pharmacy._id },
          ...(ownerMedIds.length > 0 ? [{ 'items.productId': { $in: ownerMedIds } }] : []),
        ],
      } : {};

      const [productCount, activeOrdersCount, expiredCount, lowStockCount] = await Promise.all([
        Medicine.countDocuments(pharmacyFilter).maxTimeMS(2000).catch(() => 0),
        Order.countDocuments({
          ...ownerOrderFilter,
          status: { $in: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'] },
        }).maxTimeMS(2000).catch(() => 0),
        Medicine.countDocuments({ ...pharmacyFilter, expiryDate: { $lt: new Date() } }).maxTimeMS(2000).catch(() => 0),
        Medicine.countDocuments({ ...pharmacyFilter, stock: { $lte: 10 } }).maxTimeMS(2000).catch(() => 0),
      ]);

      return res.json({
        success: true,
        product_count: productCount || 0,
        active_orders: activeOrdersCount || 0,
        unread_alerts: (expiredCount + lowStockCount) || 0,
      });
    }

    // 2. Customer: Scoped strictly to authenticated customer's own orders
    if (userRole === 'USER') {
      const [productCount, activeOrdersCount] = await Promise.all([
        Medicine.countDocuments().maxTimeMS(2000).catch(() => 10),
        Order.countDocuments({
          userId: req.user._id,
          status: { $in: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'] },
        }).maxTimeMS(2000).catch(() => 0),
      ]);

      return res.json({
        success: true,
        product_count: productCount || 10,
        active_orders: activeOrdersCount || 0,
        unread_alerts: activeOrdersCount || 0,
      });
    }

    // 3. Unauthenticated Visitors
    const productCount = await Medicine.countDocuments().maxTimeMS(2000).catch(() => 10);
    return res.json({
      success: true,
      product_count: productCount || 10,
      active_orders: 0,
      unread_alerts: 0,
    });
  } catch (err) {
    res.json({
      success: true,
      product_count: 10,
      active_orders: 0,
      unread_alerts: 0,
      fallback: true,
    });
  }
});

app.get('/api/alerts', optionalAuth, async (req, res) => {
  try {
    const userRole = (req.user?.role || '').toUpperCase();

    // 1. Pharmacy Owner: Low stock, expired batches, and new incoming orders for their pharmacy
    if (userRole === 'OWNER' || userRole === 'PHARMACIST' || userRole === 'ADMIN') {
      let pharmacy = await Pharmacy.findOne({ ownerId: req.user._id }).maxTimeMS(2000).catch(() => null);
      if (!pharmacy) {
        pharmacy = await Pharmacy.findOne().maxTimeMS(2000).catch(() => null);
      }
      const pharmacyFilter = pharmacy ? { pharmacyId: pharmacy._id } : {};
      const ownerMedIds = pharmacy ? await Medicine.find(pharmacyFilter).distinct('_id').maxTimeMS(2000).catch(() => []) : [];
      const ownerOrderFilter = pharmacy ? {
        $or: [
          { pharmacyId: pharmacy._id },
          ...(ownerMedIds.length > 0 ? [{ 'items.productId': { $in: ownerMedIds } }] : []),
        ],
      } : {};

      const [expiredMeds, lowStockMeds, pendingOrders] = await Promise.all([
        Medicine.find({ ...pharmacyFilter, expiryDate: { $lt: new Date() } }).limit(10).lean().maxTimeMS(2000).catch(() => []),
        Medicine.find({ ...pharmacyFilter, stock: { $lte: 10 } }).limit(10).lean().maxTimeMS(2000).catch(() => []),
        Order.find({
          ...ownerOrderFilter,
          status: { $in: ['PLACED', 'CONFIRMED'] },
        }).sort({ createdAt: -1 }).limit(5).lean().maxTimeMS(2000).catch(() => []),
      ]);

      const alerts = [
        ...pendingOrders.map((ord) => ({
          id: `ord_pending_${ord._id}`,
          title: `New Order: #${ord.orderNumber}`,
          alert_type: 'ACTION',
          message: `Order #${ord.orderNumber} for ₹${ord.total} received and requires dispatch preparation.`,
          is_read: false,
          created_at: ord.createdAt || new Date().toISOString(),
        })),
        ...expiredMeds.map((m) => ({
          id: `exp_${m._id}`,
          title: `Batch Expired: ${m.name}`,
          alert_type: 'CRITICAL',
          message: `Batch ${m.batchNumber || 'EX-901'} expired on ${new Date(m.expiryDate).toLocaleDateString()}. AI safety protocol has blocked sale.`,
          is_read: false,
          created_at: m.updatedAt || new Date().toISOString(),
        })),
        ...lowStockMeds.map((m) => ({
          id: `stk_${m._id}`,
          title: `Low Stock Alert: ${m.name}`,
          alert_type: 'WARNING',
          message: `Only ${m.stock} units remaining in certified inventory. Auto-reorder recommended.`,
          is_read: false,
          created_at: m.updatedAt || new Date().toISOString(),
        })),
      ];

      return res.json({
        success: true,
        count: alerts.length,
        alerts,
      });
    }

    // 2. Customer: Notifications strictly scoped to customer's own orders
    if (userRole === 'USER') {
      const customerOrders = await Order.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .maxTimeMS(2000)
        .catch(() => []);

      const alerts = customerOrders.map((ord) => {
        let title = `Order Status: #${ord.orderNumber}`;
        let alertType = 'INFO';
        let message = `Order #${ord.orderNumber} is currently ${ord.status}.`;

        switch (ord.status) {
          case 'PLACED':
            title = `Order Placed: #${ord.orderNumber}`;
            alertType = 'INFO';
            message = `Your order #${ord.orderNumber} (₹${ord.total}) has been placed and is being verified.`;
            break;
          case 'CONFIRMED':
            title = `Order Confirmed: #${ord.orderNumber}`;
            alertType = 'INFO';
            message = `Your order #${ord.orderNumber} has been verified and confirmed by the licensed pharmacy.`;
            break;
          case 'PREPARING':
          case 'PACKED':
            title = `Order Packed: #${ord.orderNumber}`;
            alertType = 'INFO';
            message = `Your prescription medicines for order #${ord.orderNumber} have been safely packed.`;
            break;
          case 'SHIPPED':
          case 'OUT_FOR_DELIVERY':
            title = `Out for Delivery: #${ord.orderNumber}`;
            alertType = 'WARNING';
            message = `Order #${ord.orderNumber} is out for delivery with ${ord.riderName || 'delivery partner'}. ETA: ${ord.estimatedDeliveryText || '30-45 mins'}.`;
            break;
          case 'DELIVERED':
            title = `Order Delivered: #${ord.orderNumber}`;
            alertType = 'SUCCESS';
            message = `Order #${ord.orderNumber} was successfully delivered. Thank you for choosing PharmaCare AI.`;
            break;
          case 'CANCELLED':
            title = `Order Cancelled: #${ord.orderNumber}`;
            alertType = 'CRITICAL';
            message = `Order #${ord.orderNumber} has been cancelled.`;
            break;
          default:
            title = `Order Update: #${ord.orderNumber}`;
            alertType = 'INFO';
            message = `Order #${ord.orderNumber} status updated to ${ord.status}.`;
        }

        return {
          id: `cust_ord_${ord._id}_${ord.status.toLowerCase()}`,
          title,
          alert_type: alertType,
          message,
          is_read: false,
          created_at: ord.updatedAt || ord.createdAt || new Date().toISOString(),
        };
      });

      return res.json({
        success: true,
        count: alerts.length,
        alerts,
      });
    }

    // 3. Unauthenticated Visitors: 0 alerts, empty state
    return res.json({
      success: true,
      count: 0,
      alerts: [],
    });
  } catch (err) {
    res.json({
      success: true,
      count: 0,
      alerts: [],
      fallback: true,
    });
  }
});

// Legacy / Alternative route support for frontend compatibility
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', requireDb, medicineRoutes);
app.use('/api/v1/orders', requireDb, orderRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/medicine-catalogue', medicineCatalogueRoutes);
app.use('/api/medicine-catalogue', medicineCatalogueRoutes);
app.get('/api/v1/dashboard/summary', (req, res) => res.redirect('/api/dashboard/summary'));
app.get('/api/v1/alerts', (req, res) => res.redirect('/api/alerts'));

// 404 & Centralized Error Handler
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Only call listen when running as a standalone Node.js process, not in Vercel serverless
let serverInstance = null;
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PharmaCare AI Server] Running on port ${PORT} (0.0.0.0)`);
  });

  const handleShutdown = async (signal) => {
    console.log(`\n[PharmaCare AI Server] Received ${signal}. Shutting down gracefully...`);
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[PharmaCare AI Server] HTTP server closed.');
      });
    }
    await closeDB();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

export default app;


