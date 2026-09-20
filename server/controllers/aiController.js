import geminiService from '../services/geminiService.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

// @desc    Process AI Chat / Voice request
// @route   POST /api/ai/chat
// @access  Public (Optional User)
export const handleAIChat = async (req, res, next) => {
  try {
    const { message, conversationId, history } = req.body;
    const userId = req.user ? req.user._id : null;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required',
      });
    }

    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // If logged in, record conversation & user message
    if (userId) {
      await Conversation.findOneAndUpdate(
        { conversationId: convId },
        { conversationId: convId, userId, title: message.slice(0, 30) },
        { upsert: true, new: true }
      );

      await Message.create({
        conversationId: convId,
        userId,
        role: 'user',
        message: message.trim(),
      });
    }

    // Call Gemini Service
    const aiResponse = await geminiService.generateChatResponse({
      message: message.trim(),
      history,
      userId,
    });

    // Save assistant message to conversation if user logged in
    if (userId) {
      await Message.create({
        conversationId: convId,
        userId,
        role: 'assistant',
        message: aiResponse.message,
        type: aiResponse.type,
        products: aiResponse.products || [],
        sources: aiResponse.sources || [],
      });
    }

    res.json({
      success: true,
      conversationId: convId,
      type: aiResponse.type,
      message: aiResponse.message,
      tts_text: aiResponse.message, // For voice synthesis
      products: aiResponse.products || [],
      sources: aiResponse.sources || [],
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Voice endpoint for backwards-compatibility / voice command processing
// @route   POST /api/ai/voice
// @access  Public
export const handleAIVoice = async (req, res, next) => {
  try {
    const { command_text, history, conversationId, language_hint = 'auto' } = req.body;
    const userId = req.user ? req.user._id : null;

    if (!command_text || !command_text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'command_text is required',
      });
    }

    const aiResponse = await geminiService.generateChatResponse({
      message: command_text.trim(),
      history,
      userId,
    });

    res.json({
      success: true,
      conversationId: conversationId || `conv_${Date.now()}`,
      type: aiResponse.type,
      tts_text: aiResponse.message,
      message: aiResponse.message,
      action: aiResponse.action || null,
      addedProduct: aiResponse.addedProduct || null,
      products: aiResponse.products || [],
      sources: aiResponse.sources || [],
      detected_language: language_hint === 'auto' ? 'English / Indian Multilingual' : language_hint,
      requires_confirmation: false,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm voice action (e.g. reorder or add to cart confirmation)
// @route   POST /api/ai/voice/confirm
// @access  Public
export const handleConfirmVoice = async (req, res, next) => {
  try {
    const { confirmed } = req.body;

    res.json({
      success: true,
      tts_text: confirmed ? 'Action confirmed successfully.' : 'Action cancelled.',
      message: confirmed ? 'Action confirmed successfully.' : 'Action cancelled.',
    });
  } catch (error) {
    next(error);
  }
};
