import Cart from '../models/Cart.js';
import Medicine from '../models/Medicine.js';
import HealthProduct from '../models/HealthProduct.js';
import PersonalCareProduct from '../models/PersonalCareProduct.js';
import { isMedicineExpired } from '../utils/expiry.js';

// Helper to find product across models
const findProduct = async (productId, productType) => {
  if (productType === 'HealthProduct') {
    return await HealthProduct.findById(productId);
  }
  if (productType === 'PersonalCareProduct') {
    return await PersonalCareProduct.findById(productId);
  }
  // Default to Medicine
  return await Medicine.findById(productId);
};

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id });

    if (!cart) {
      cart = await Cart.create({ userId: req.user._id, items: [] });
    }

    const items = cart.items.map((item) => ({
      _id: item._id,
      id: item._id.toString(),
      productId: item.productId,
      productType: item.productType,
      name: item.name,
      price: item.price,
      qty: item.qty,
      image: item.image,
      type: item.type,
    }));

    const totalAmount = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    res.json({
      success: true,
      items,
      itemCount: items.reduce((sum, i) => sum + i.qty, 0),
      totalAmount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to cart with backend validation
// @route   POST /api/cart
// @access  Private
export const addToCart = async (req, res, next) => {
  try {
    const { productId, productType = 'Medicine', qty = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    const quantityToAdd = Math.max(1, parseInt(qty, 10) || 1);

    // 1. Fetch Product
    const product = await findProduct(productId, productType);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in catalog',
      });
    }

    // 2. Validate Expiry for Medicines
    if (productType === 'Medicine' || product.expiryDate) {
      if (isMedicineExpired(product.expiryDate)) {
        return res.status(400).json({
          success: false,
          message: 'This medicine has expired and cannot be purchased.',
          code: 'MEDICINE_EXPIRED',
        });
      }
    }

    // 3. Validate Stock
    if (product.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: `${product.name} is currently out of stock.`,
        code: 'OUT_OF_STOCK',
      });
    }

    // 4. Retrieve or Create Cart
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [] });
    }

    // Check if item already in cart
    const existingIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].qty + quantityToAdd;
      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} units available in stock.`,
        });
      }
      cart.items[existingIndex].qty = newQty;
    } else {
      if (quantityToAdd > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} units available in stock.`,
        });
      }

      cart.items.push({
        productId: product._id,
        productType,
        name: product.name,
        price: product.price,
        qty: quantityToAdd,
        image: product.image,
        type: product.rxRequired ? 'Rx' : 'OTC',
      });
    }

    await cart.save();

    const items = cart.items.map((item) => ({
      _id: item._id,
      id: item._id.toString(),
      productId: item.productId,
      productType: item.productType,
      name: item.name,
      price: item.price,
      qty: item.qty,
      image: item.image,
      type: item.type,
    }));

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      items,
      itemCount: items.reduce((sum, i) => sum + i.qty, 0),
      totalAmount: items.reduce((sum, i) => sum + i.price * i.qty, 0),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PATCH /api/cart/:itemId
// @access  Private
export const updateCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { qty } = req.body;

    if (qty === undefined || qty === null) {
      return res.status(400).json({
        success: false,
        message: 'Quantity is required',
      });
    }

    const newQty = parseInt(qty, 10);
    const cart = await Cart.findOne({ userId: req.user._id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId || item.productId?.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    if (newQty <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const item = cart.items[itemIndex];
      const product = await findProduct(item.productId, item.productType);
      if (product && newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} units available in stock.`,
        });
      }
      cart.items[itemIndex].qty = newQty;
    }

    await cart.save();

    res.json({
      success: true,
      items: cart.items,
      itemCount: cart.items.reduce((sum, i) => sum + i.qty, 0),
      totalAmount: cart.items.reduce((sum, i) => sum + i.price * i.qty, 0),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove single item from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
export const removeCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const cart = await Cart.findOne({ userId: req.user._id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    cart.items = cart.items.filter(
      (item) => item._id.toString() !== itemId && item.productId?.toString() !== itemId
    );

    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart',
      items: cart.items,
      itemCount: cart.items.reduce((sum, i) => sum + i.qty, 0),
      totalAmount: cart.items.reduce((sum, i) => sum + i.price * i.qty, 0),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart
// @access  Private
export const clearCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    res.json({
      success: true,
      message: 'Cart cleared',
      items: [],
      itemCount: 0,
      totalAmount: 0,
    });
  } catch (error) {
    next(error);
  }
};
