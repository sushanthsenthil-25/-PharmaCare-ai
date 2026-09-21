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
    activeIngredient: {
      type: String,
      default: '',
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
      default: 'PharmaCare Labs',
      trim: true,
      index: true,
    },
    manufacturer: {
      type: String,
      default: 'PharmaCare Laboratories',
      trim: true,
    },
    composition: {
      type: String,
      default: '',
      trim: true,
    },
    strength: {
      type: String,
      default: '',
      trim: true,
    },
    form: {
      type: String,
      default: 'Tablet',
      trim: true,
    },
    quantity: {
      type: Number,
      default: 100,
      min: 0,
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
      default: 100,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
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
    image: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      default: 'In Stock',
      trim: true,
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
    rxRequired: {
      type: Boolean,
      default: false,
    },
    aliases: {
      type: [String],
      default: [],
      index: true,
    },
    searchKeywords: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique index to prevent duplicate records
medicineSchema.index({ name: 1, strength: 1, form: 1 }, { unique: true });

// Virtual field for expiry status
medicineSchema.virtual('expiryStatus').get(function () {
  return getExpiryStatus(this.expiryDate);
});

// Text index for full-text search across medicine attributes
medicineSchema.index({
  name: 'text',
  genericName: 'text',
  activeIngredient: 'text',
  scientificName: 'text',
  brand: 'text',
  category: 'text',
  composition: 'text',
  description: 'text',
});

export const Medicine = mongoose.model('Medicine', medicineSchema);
export default Medicine;
