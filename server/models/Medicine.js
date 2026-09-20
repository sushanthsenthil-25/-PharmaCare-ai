import mongoose from 'mongoose';
import { getExpiryStatus } from '../utils/expiry.js';

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
      index: true,
    },
    genericName: {
      type: String,
      required: [true, 'Generic name is required'],
      trim: true,
      index: true,
    },
    scientificName: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand/Manufacturer is required'],
      trim: true,
      index: true,
    },
    composition: {
      type: String,
      required: [true, 'Composition details required'],
      trim: true,
      index: true,
    },
    strength: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    uses: {
      type: [String],
      default: [],
    },
    precautions: {
      type: [String],
      default: [],
    },
    storageInstructions: {
      type: String,
      default: 'Store in a cool, dry place away from direct sunlight.',
    },
    manufacturingDate: {
      type: Date,
      required: [true, 'Manufacturing date is required'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: true,
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
    },
    discount: {
      type: String,
      default: '0% OFF',
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      enum: ['Prescription (Rx)', 'Over-The-Counter (OTC)', 'Chronic Care', 'Fever & Pain', 'Antibiotics', 'Cardiac', 'Gastro', 'Respiratory', 'All'],
      default: 'Over-The-Counter (OTC)',
      index: true,
    },
    rxRequired: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
      default: 'https://lh3.googleusercontent.com/aida/AEtjO1VIkX8kPJK_xW2FPVInEq_EGA82uqOOY5cS3ouVzqzwCkaEf4sRVAfyP0OXWNZmJa7vEdaXwmq9ROrI_Rq2f4uR1_Kh74uQKxV87Yd8RMwm8JRNZgegzFQW8oSrG4hZMoqcN5TR2v0L_n7BMhgoqvuXPzc8Lq3YxVVVs-Gp2YhIG4pDsk-rnnH_8b-nmNYvaH7y9ukMvuuROUxNOFFv_1HwwN4t4l9FIRiJUw-_zeAd8dHNby5bS84qHwT1',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field for expiry status
medicineSchema.virtual('expiryStatus').get(function () {
  return getExpiryStatus(this.expiryDate);
});

// Text index for full-text search across medicine attributes
medicineSchema.index({
  name: 'text',
  genericName: 'text',
  scientificName: 'text',
  brand: 'text',
  composition: 'text',
  category: 'text',
});

export const Medicine = mongoose.model('Medicine', medicineSchema);
export default Medicine;
