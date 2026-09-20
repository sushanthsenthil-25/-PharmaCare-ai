import express from 'express';
import {
  handleAIChat,
  handleAIVoice,
  handleConfirmVoice,
} from '../controllers/aiController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/chat', optionalAuth, handleAIChat);
router.post('/voice', optionalAuth, handleAIVoice);
router.post('/voice/confirm', optionalAuth, handleConfirmVoice);

export default router;
