import express from 'express';
import {
  getPersonalCareProducts,
  getPersonalCareById,
} from '../controllers/personalCareController.js';

const router = express.Router();

router.get('/', getPersonalCareProducts);
router.get('/:id', getPersonalCareById);

export default router;
