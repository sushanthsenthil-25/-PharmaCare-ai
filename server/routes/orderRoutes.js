import express from 'express';
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { protect, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, createOrder);
router.get('/', protect, getOrders);
router.get('/:id', optionalAuth, getOrderById); // Accessible for live order tracking by ID
router.patch('/:id/status', protect, updateOrderStatus);

export default router;
