import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['INFORMATION', 'PRODUCT_SEARCH', 'PRODUCT_RESULTS', 'ACTION', 'SYSTEM'],
      default: 'INFORMATION',
    },
    products: [
      {
        id: String,
        name: String,
        genericName: String,
        scientificName: String,
        price: Number,
        originalPrice: Number,
        discount: String,
        stock: Number,
        expiryDate: Date,
        expiryStatus: String,
        category: String,
        image: String,
      },
    ],
    sources: [
      {
        title: String,
        uri: String,
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const Message = mongoose.model('Message', messageSchema);
export default Message;
