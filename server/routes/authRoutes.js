import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
router.post('/profile/photo', protect, uploadProfilePhoto);
router.delete('/profile/photo', protect, removeProfilePhoto);

export default router;
