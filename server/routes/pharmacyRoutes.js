import express from 'express';
import {
  getNearbyPharmacies,
  searchLocations,
  reverseGeocode,
  getPharmacyById,
  getPharmacyMedicines,
  getPharmacyReviews,
  addPharmacyReview,
} from '../controllers/pharmacyController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/nearby', getNearbyPharmacies);
router.get('/geocode/search', searchLocations);
router.get('/geocode/reverse', reverseGeocode);
router.get('/:id', getPharmacyById);
router.get('/:id/medicines', getPharmacyMedicines);
router.get('/:id/reviews', getPharmacyReviews);
router.post('/:id/reviews', protect, addPharmacyReview);

export default router;
