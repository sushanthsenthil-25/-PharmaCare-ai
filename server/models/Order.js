import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    productType: {
      type: String,
      enum: ['Medicine', 'HealthProduct', 'PersonalCareProduct'],
      required: true,
      default: 'Medicine',
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'items.productType',
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    lineTotal: {
      type: Number,
      required: true,
    },
    image: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingAddress: {
      type: String,
      required: [true, 'Shipping address is required'],
    },
    placedAt: {
      type: Date,
      default: Date.now,
    },
    estimatedDeliveryAt: {
      type: Date,
    },
    estimatedDeliveryText: {
      type: String,
      default: 'Today, 30–45 mins',
    },
    currentLocation: {
      type: String,
      default: 'Live driver location will appear when available.',
    },
    status: {
      type: String,
      enum: [
        'PLACED',
        'CONFIRMED',
        'PREPARING',
        'PACKED',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'CONFIRMED',
      index: true,
    },
    trackingEvents: [
      {
        status: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        completed: { type: Boolean, default: false },
      },
    ],
    etaMinutes: {
      type: Number,
      default: 30,
    },
    riderName: {
      type: String,
      default: 'Vikram Singh',
    },
    riderPhone: {
      type: String,
      default: '+91 98765 43210',
    },
    paymentMethod: {
      type: String,
      default: 'DEMO_EXPRESS_COD',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED',
    },
  },
  {
    timestamps: true,
  }
);

export const Order = mongoose.model('Order', orderSchema);
export default Order;
