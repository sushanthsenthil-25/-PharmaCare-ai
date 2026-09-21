import express from 'express';
import {
  getCart,
  calculateCartSummary,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '../controllers/cartController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Calculation endpoint (can be called with or without auth)
router.post('/calculate', calculateCartSummary);

// Protected user cart routes
router.use(protect);

router.route('/')
  .get(getCart)
  .post(addToCart)
  .delete(clearCart);

router.route('/:itemId')
  .patch(updateCartItem)
  .delete(removeCartItem);

export default router;
