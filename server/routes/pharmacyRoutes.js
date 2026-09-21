import express from 'express';
import {
  getNearbyPharmacies,
  getPharmacyById,
  getPharmacyMedicines,
} from '../controllers/pharmacyController.js';

const router = express.Router();

router.get('/nearby', getNearbyPharmacies);
router.get('/:id', getPharmacyById);
router.get('/:id/medicines', getPharmacyMedicines);

export default router;
