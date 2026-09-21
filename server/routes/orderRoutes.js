import express from 'express';
import {
  createOrder,
  getOrders,
  getOrderById,
  getOrderTracking,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { protect, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, createOrder);
router.get('/', protect, getOrders);
router.get('/:id', optionalAuth, getOrderById);
router.get('/:id/tracking', optionalAuth, getOrderTracking);
router.patch('/:id/status', protect, updateOrderStatus);

export default router;
