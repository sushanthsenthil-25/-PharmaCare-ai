import express from 'express';
import {
  getConversations,
  getConversationMessages,
  deleteConversation,
} from '../controllers/conversationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getConversations);
router.get('/:id/messages', getConversationMessages);
router.delete('/:id', deleteConversation);

export default router;
