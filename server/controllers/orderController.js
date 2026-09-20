import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Medicine from '../models/Medicine.js';
import HealthProduct from '../models/HealthProduct.js';
import PersonalCareProduct from '../models/PersonalCareProduct.js';
import { isMedicineExpired } from '../utils/expiry.js';

const findProductModel = (productType) => {
  if (productType === 'HealthProduct') return HealthProduct;
  if (productType === 'PersonalCareProduct') return PersonalCareProduct;
  return Medicine;
};

// @desc    Create a new order (Checkout)
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res, next) => {
  try {
    const { items, delivery_address, shippingAddress, paymentMethod = 'DEMO_EXPRESS_COD' } = req.body;
    const address = shippingAddress || delivery_address || req.user.address || 'Indiranagar 100ft Rd, Bangalore 560038';

    let orderItems = items;

    // If items not passed directly in payload, use user's Cart items
    if (!orderItems || !orderItems.length) {
      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart || !cart.items.length) {
        return res.status(400).json({
          success: false,
          message: 'Your cart is empty. Cannot create an order.',
        });
      }
      orderItems = cart.items;
    }

    // Validate all items & check stock + expiry
    const validatedItems = [];
    let subtotal = 0;

    for (const item of orderItems) {
      const pId = item.productId || item.product_id || item.id || item._id;
      const pType = item.productType || 'Medicine';
      const qty = Math.max(1, parseInt(item.qty || 1, 10));

      const Model = findProductModel(pType);
      const product = await Model.findById(pId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.name || pId} not found in catalog`,
        });
      }

      // Check Expiry for Medicines
      if (pType === 'Medicine' || product.expiryDate) {
        if (isMedicineExpired(product.expiryDate)) {
          return res.status(400).json({
            success: false,
            message: `Cannot purchase ${product.name}: This medicine has expired and cannot be purchased.`,
            code: 'MEDICINE_EXPIRED',
          });
        }
      }

      // Check Stock
      if (product.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${qty}`,
        });
      }

      const unitPrice = Number(item.unit_price || product.price);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      validatedItems.push({
        productId: product._id,
        productType: pType,
        name: product.name,
        price: unitPrice,
        qty,
        lineTotal,
        image: product.image,
      });

      // Decrement inventory stock
      product.stock -= qty;
      await product.save();
    }

    const deliveryFee = 0; // Free 30-min express delivery
    const total = subtotal + deliveryFee;
    const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = await Order.create({
      orderNumber,
      userId: req.user._id,
      items: validatedItems,
      subtotal,
      deliveryFee,
      total,
      shippingAddress: address,
      status: 'OUT_FOR_DELIVERY',
      etaMinutes: 18,
      riderName: 'Vikram Singh',
      riderPhone: '+91 98765 43210',
      paymentMethod,
      paymentStatus: 'COMPLETED',
    });

    // Clear user's cart upon successful checkout
    await Cart.findOneAndUpdate({ userId: req.user._id }, { items: [] });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully (Demo Express Delivery)',
      order: {
        ...order.toObject(),
        id: order._id.toString(),
      },
      id: order._id.toString(),
      order_id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      etaMinutes: order.etaMinutes,
      eta_minutes: order.etaMinutes,
      rider_name: order.riderName,
      rider_phone: order.riderPhone,
      total_amount: order.total,
      items: order.items,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = orders.map((o) => ({
      ...o,
      id: o._id.toString(),
      order_id: o._id.toString(),
      eta_minutes: o.etaMinutes,
      rider_name: o.riderName,
      rider_phone: o.riderPhone,
      total_amount: o.total,
    }));

    res.json({
      success: true,
      count: formatted.length,
      orders: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID or orderNumber (supports tracking)
// @route   GET /api/orders/:id
// @access  Public / Private
export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let order;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(id).lean();
    } else {
      order = await Order.findOne({
        $or: [{ orderNumber: new RegExp(id, 'i') }, { orderNumber: id }],
      }).lean();
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order #${id} not found`,
      });
    }

    res.json({
      success: true,
      order: {
        ...order,
        id: order._id.toString(),
        order_id: order._id.toString(),
        eta_minutes: order.etaMinutes,
        rider_name: order.riderName,
        rider_phone: order.riderPhone,
        total_amount: order.total,
      },
      id: order._id.toString(),
      status: order.status,
      eta_minutes: order.etaMinutes,
      etaMinutes: order.etaMinutes,
      rider_name: order.riderName,
      rider_phone: order.riderPhone,
      total_amount: order.total,
      items: order.items,
      delivery_address: order.shippingAddress,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private (Admin / Pharmacist)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, etaMinutes } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (status) order.status = status;
    if (etaMinutes !== undefined) order.etaMinutes = etaMinutes;

    await order.save();

    res.json({
      success: true,
      message: `Order updated to ${order.status}`,
      order,
    });
  } catch (error) {
    next(error);
  }
};
