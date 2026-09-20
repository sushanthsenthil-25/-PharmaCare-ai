import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

// @desc    Get all conversations for logged in user
// @route   GET /api/conversations
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/conversations/:id/messages
// @access  Private
export const getConversationMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const messages = await Message.find({ conversationId: id })
      .sort({ timestamp: 1 })
      .lean();

    res.json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a conversation
// @route   DELETE /api/conversations/:id
// @access  Private
export const deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Promise.all([
      Conversation.findOneAndDelete({ conversationId: id, userId: req.user._id }),
      Message.deleteMany({ conversationId: id, userId: req.user._id }),
    ]);

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
