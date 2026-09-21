import mongoose from 'mongoose';

const pharmacySchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      required: [true, 'Pharmacy business name is required'],
      trim: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ownerName: {
      type: String,
      default: 'Pharmacy Owner',
      trim: true,
    },
    phone: {
      type: String,
      default: '+91 98765 43210',
      trim: true,
    },
    email: {
      type: String,
      default: 'owner@pharmacare.ai',
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Pharmacy address is required'],
      default: 'Indiranagar, Bangalore 560038',
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
      default: 12.9716, // Default Bangalore
      index: true,
    },
    longitude: {
      type: Number,
      required: true,
      default: 77.5946,
      index: true,
    },
    openingTime: {
      type: String,
      default: '08:00 AM',
    },
    closingTime: {
      type: String,
      default: '11:00 PM',
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    profilePhoto: {
      type: String,
      default: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=500&auto=format&fit=crop&q=80',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound 2D index for location queries if needed
pharmacySchema.index({ latitude: 1, longitude: 1 });

export const Pharmacy = mongoose.model('Pharmacy', pharmacySchema);
export default Pharmacy;
