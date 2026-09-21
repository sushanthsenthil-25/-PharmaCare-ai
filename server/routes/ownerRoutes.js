import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getOwnerDashboard,
  getOwnerMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  updateStock,
  getOwnerOrders,
  updateOrderStatus,
  updatePharmacyProfile,
} from '../controllers/ownerController.js';

const router = express.Router();

// Protect all owner routes
router.use(protect);

router.get('/dashboard', getOwnerDashboard);
router.get('/medicines', getOwnerMedicines);
router.post('/medicines', createMedicine);
router.put('/medicines/:id', updateMedicine);
router.delete('/medicines/:id', deleteMedicine);
router.patch('/medicines/:id/stock', updateStock);
router.get('/orders', getOwnerOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/pharmacy', updatePharmacyProfile);

export default router;
