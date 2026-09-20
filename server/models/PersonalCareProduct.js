import mongoose from 'mongoose';

const personalCareProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      default: 'Personal Care & Derma',
      index: true,
    },
    description: {
      type: String,
      default: 'Clinical Skincare & Hygiene Formulation',
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
      default: '20% OFF',
    },
    stock: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
    },
    tag: {
      type: String,
      default: 'Dermatologist Verified',
    },
    image: {
      type: String,
      default: 'https://lh3.googleusercontent.com/aida/AEtjO1UHGUKnGpTOg2msH61zotOypeVIT3K21vFfPzONCUPHVDPZXdKf7MZxOg21ow7JQjBywLAP47platxNhzXcOxNlWUawvh6zHRtB7Yvw_lsOJbOD6QTNSkklevM7Acp7TO4_ujAdtFtFd9RYKOaZsrqUBe7e4bzj9ikab1bbdm0NK5CDKOsFXYdupC7WJWfGYnFVB5gxIyPTT6-KcLtBogLSk-X5GdaATgswyZV_JBNtZUYkNqi1N-ixo3mT',
    },
  },
  {
    timestamps: true,
  }
);

personalCareProductSchema.index({
  name: 'text',
  brand: 'text',
  category: 'text',
  description: 'text',
});

export const PersonalCareProduct = mongoose.model('PersonalCareProduct', personalCareProductSchema);
export default PersonalCareProduct;
