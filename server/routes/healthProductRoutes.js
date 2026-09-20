import express from 'express';
import {
  getHealthProducts,
  getHealthProductById,
} from '../controllers/healthProductController.js';

const router = express.Router();

router.get('/', getHealthProducts);
router.get('/:id', getHealthProductById);

export default router;
