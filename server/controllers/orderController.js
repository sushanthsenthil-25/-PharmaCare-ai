import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Medicine from '../models/Medicine.js';
import HealthProduct from '../models/HealthProduct.js';
import PersonalCareProduct from '../models/PersonalCareProduct.js';
import { isMedicineExpired } from '../utils/expiry.js';
import { calculateCart, calculateDeliveryEstimate } from '../services/cartService.js';

const findProductModel = (productType) => {
  if (productType === 'HealthProduct') return HealthProduct;
  if (productType === 'PersonalCareProduct') return PersonalCareProduct;
  return Medicine;
};

const DEFAULT_TRACKING_STEPS = [
  { status: 'PLACED', title: 'Order Placed', description: 'Order received by PharmaCare Express', completed: true },
  { status: 'CONFIRMED', title: 'Prescription & Clinical Check', description: 'AI safety dosage & item check verified', completed: true },
  { status: 'PREPARING', title: 'Pharmacy Dispensing', description: 'Certified pharmacist packing medication', completed: false },
  { status: 'PACKED', title: 'Tamper-Proof Packed', description: 'Sealed with clinical safety barcode', completed: false },
  { status: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', description: 'Express delivery rider on the way', completed: false },
  { status: 'DELIVERED', title: 'Delivered', description: 'Medications handed over at doorstep', completed: false },
];

/**
 * Builds the tracking timeline for an order based on its current status
 */
function buildTrackingEvents(currentStatus = 'CONFIRMED', placedAt = new Date()) {
  const statusRanks = {
    PLACED: 1,
    CONFIRMED: 2,
    PREPARING: 3,
    PACKED: 4,
    SHIPPED: 4,
    OUT_FOR_DELIVERY: 5,
    DELIVERED: 6,
    CANCELLED: -1,
  };

  const currentRank = statusRanks[currentStatus] || 2;

  return DEFAULT_TRACKING_STEPS.map((step, idx) => {
    const stepRank = statusRanks[step.status] || (idx + 1);
    const completed = currentRank >= stepRank && currentStatus !== 'CANCELLED';
    const isCurrent = currentRank === stepRank && currentStatus !== 'CANCELLED';

    const timestamp = new Date(placedAt.getTime() + idx * 6 * 60000);

    return {
      status: step.status,
      title: step.title,
      description: step.description,
      completed,
      current: isCurrent,
      timestamp,
      timeText: timestamp.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  });
}

// @desc    Create a new order (Checkout)
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res, next) => {
  try {
    const { items, delivery_address, shippingAddress, paymentMethod = 'DEMO_EXPRESS_COD', discount = 0 } = req.body;
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

      const unitPrice = Number(item.unit_price || item.price || product.price);
      const lineTotal = unitPrice * qty;

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

    // Calculate official totals using cart service
    const cartCalc = calculateCart(validatedItems, { discountAmount: discount });
    const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const placedAt = new Date();
    const deliveryEstimate = calculateDeliveryEstimate(placedAt);

    const initialTracking = buildTrackingEvents('CONFIRMED', placedAt);

    const order = await Order.create({
      orderNumber,
      userId: req.user._id,
      items: cartCalc.items,
      subtotal: cartCalc.subtotal,
      deliveryFee: cartCalc.deliveryFee,
      discount: cartCalc.discount,
      total: cartCalc.total,
      shippingAddress: address,
      placedAt,
      estimatedDeliveryAt: deliveryEstimate.estimatedDeliveryAt,
      estimatedDeliveryText: deliveryEstimate.estimatedDeliveryText,
      currentLocation: 'Live driver location will appear when available.',
      status: 'CONFIRMED',
      trackingEvents: initialTracking,
      etaMinutes: 30,
      riderName: 'Vikram Singh',
      riderPhone: '+91 98765 43210',
      paymentMethod,
      paymentStatus: 'COMPLETED',
    });

    // Clear user's cart upon successful checkout
    await Cart.findOneAndUpdate({ userId: req.user._id }, { items: [] });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully (30-Min Express Delivery)',
      order: {
        ...order.toObject(),
        id: order._id.toString(),
      },
      id: order._id.toString(),
      order_id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      estimatedDeliveryText: order.estimatedDeliveryText,
      currentLocation: order.currentLocation,
      etaMinutes: order.etaMinutes,
      eta_minutes: order.etaMinutes,
      rider_name: order.riderName,
      rider_phone: order.riderPhone,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discount: order.discount,
      total: order.total,
      total_amount: order.total,
      items: order.items,
      trackingEvents: initialTracking,
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
      estimatedDeliveryText: o.estimatedDeliveryText || 'Today, 30–45 mins',
      trackingEvents: o.trackingEvents && o.trackingEvents.length > 0 ? o.trackingEvents : buildTrackingEvents(o.status, o.placedAt || o.createdAt),
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

// @desc    Get order by ID or orderNumber
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

    const trackingEvents = order.trackingEvents && order.trackingEvents.length > 0
      ? order.trackingEvents
      : buildTrackingEvents(order.status, order.placedAt || order.createdAt);

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
        trackingEvents,
      },
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.placedAt,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      estimatedDeliveryText: order.estimatedDeliveryText || 'Today, 30–45 mins',
      currentLocation: order.currentLocation || 'Live driver location will appear when available.',
      eta_minutes: order.etaMinutes,
      etaMinutes: order.etaMinutes,
      rider_name: order.riderName,
      rider_phone: order.riderPhone,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discount: order.discount,
      total: order.total,
      total_amount: order.total,
      items: order.items,
      delivery_address: order.shippingAddress,
      shippingAddress: order.shippingAddress,
      trackingEvents,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order tracking data
// @route   GET /api/orders/:id/tracking
// @access  Public / Private
export const getOrderTracking = async (req, res, next) => {
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
        message: `Order #${id} not found for tracking`,
      });
    }

    const trackingEvents = buildTrackingEvents(order.status, order.placedAt || order.createdAt);

    res.json({
      success: true,
      orderId: order.orderNumber || order._id.toString(),
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.placedAt || order.createdAt,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      estimatedDeliveryText: order.estimatedDeliveryText || 'Today, 30–45 mins',
      currentLocation: order.currentLocation || 'Live driver location will appear when available.',
      etaMinutes: order.etaMinutes || 30,
      riderName: order.riderName || 'Vikram Singh',
      riderPhone: order.riderPhone || '+91 98765 43210',
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discount: order.discount,
      total: order.total,
      items: order.items,
      trackingEvents,
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
    const { status, etaMinutes, currentLocation } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (status) {
      order.status = status;
      order.trackingEvents = buildTrackingEvents(status, order.placedAt || order.createdAt);
    }
    if (etaMinutes !== undefined) order.etaMinutes = etaMinutes;
    if (currentLocation) order.currentLocation = currentLocation;

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
