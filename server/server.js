import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import healthProductRoutes from './routes/healthProductRoutes.js';
import personalCareRoutes from './routes/personalCareRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';

// Models for dashboard / alerts compatibility
import Medicine from './models/Medicine.js';
import Order from './models/Order.js';

// Connect to MongoDB
connectDB();

const app = express();

// Security Middleware
app.use(helmet());

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow during local development
      }
    },
    credentials: true,
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
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests from this IP, please try again in a minute.',
  },
});

app.use('/api/ai', aiLimiter);

// Base Health Check & Welcome Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    app: 'PharmaCare AI Backend API',
    status: 'online',
    frontend: 'http://localhost:5173',
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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'PharmaCare AI Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/health-products', healthProductRoutes);
app.use('/api/personal-care', personalCareRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/conversations', conversationRoutes);

// Dashboard Summary & Alerts Compatibility Routes
app.get('/api/dashboard/summary', async (req, res, next) => {
  try {
    const [productCount, activeOrdersCount, expiredCount] = await Promise.all([
      Medicine.countDocuments(),
      Order.countDocuments({ status: { $in: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'] } }),
      Medicine.countDocuments({ expiryDate: { $lt: new Date() } }),
    ]);

    res.json({
      success: true,
      product_count: productCount,
      active_orders: activeOrdersCount,
      unread_alerts: expiredCount > 0 ? expiredCount : 0,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/alerts', async (req, res, next) => {
  try {
    // Dynamically calculate stock and expiry alerts from real database
    const [expiredMeds, lowStockMeds] = await Promise.all([
      Medicine.find({ expiryDate: { $lt: new Date() } }).limit(5).lean(),
      Medicine.find({ stock: { $lte: 10 } }).limit(5).lean(),
    ]);

    const alerts = [
      ...expiredMeds.map((m) => ({
        id: `exp_${m._id}`,
        title: `Batch Expired: ${m.name}`,
        alert_type: 'CRITICAL',
        message: `Batch ${m.batchNumber} has expired on ${new Date(m.expiryDate).toLocaleDateString()}. Purchase has been prevented by AI safety.`,
        is_read: false,
        created_at: m.updatedAt,
      })),
      ...lowStockMeds.map((m) => ({
        id: `stk_${m._id}`,
        title: `Low Stock Alert: ${m.name}`,
        alert_type: 'WARNING',
        message: `Only ${m.stock} units remaining in certified inventory. Auto-reorder recommended.`,
        is_read: false,
        created_at: m.updatedAt,
      })),
    ];

    res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (err) {
    next(err);
  }
});

// Legacy / Alternative route support for frontend compatibility
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', medicineRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/ai', aiRoutes);
app.get('/api/v1/dashboard/summary', (req, res) => res.redirect('/api/dashboard/summary'));
app.get('/api/v1/alerts', (req, res) => res.redirect('/api/alerts'));

// 404 & Centralized Error Handler
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[PharmaCare AI Server] Running on http://localhost:${PORT}`);
});

export default app;
