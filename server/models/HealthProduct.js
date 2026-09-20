import mongoose from 'mongoose';

const healthProductSchema = new mongoose.Schema(
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
      default: 'Supplements & Devices',
      index: true,
    },
    description: {
      type: String,
      default: 'Clinical Grade Supplement • High Potency',
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    reviews: {
      type: Number,
      default: 120,
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
      default: '15% OFF',
    },
    stock: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
    },
    tag: {
      type: String,
      default: 'Top Rated',
    },
    image: {
      type: String,
      default: 'https://lh3.googleusercontent.com/aida/AEtjO1WnJb_LqoDitrvUInitqtbd-bt_IBv6YrQ3rw4xW9Fj2qim4FUBm7uy93MZ2g0Hzl5R3KwPf_U6816DqGwOrhfNqe1a1DpWBI41Uuc8L7uJG1dgpzNp5F6MXKFkfVDKKrkOCU1vjGO1_fvbX9xMRdNtV0x5aZnBhtPJkHXsBtjbNv2CVZohpy2_nXei4io0yrOBt6_l5CMuUanfLV5QzOU54Xh3BSi3zn9liLzlfD-Vx-47DxGQMYLrvwS_',
    },
  },
  {
    timestamps: true,
  }
);

healthProductSchema.index({
  name: 'text',
  brand: 'text',
  category: 'text',
  description: 'text',
});

export const HealthProduct = mongoose.model('HealthProduct', healthProductSchema);
export default HealthProduct;
