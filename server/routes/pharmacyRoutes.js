import express from 'express';
import {
  getNearbyPharmacies,
  getPharmacyById,
  getPharmacyMedicines,
  getPharmacyReviews,
  addPharmacyReview,
} from '../controllers/pharmacyController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/nearby', getNearbyPharmacies);
router.get('/:id', getPharmacyById);
router.get('/:id/medicines', getPharmacyMedicines);
router.get('/:id/reviews', getPharmacyReviews);
router.post('/:id/reviews', protect, addPharmacyReview);

export default router;
