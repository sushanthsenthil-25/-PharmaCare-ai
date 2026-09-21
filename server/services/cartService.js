/**
 * Authoritative Backend Cart & Delivery Calculation Engine
 * 
 * Rules:
 * - itemSubtotal = price * quantity
 * - subtotal = sum(itemSubtotal)
 * - deliveryFee = subtotal >= 100 ? 0 : 30 (Free 30-min express above ₹100)
 * - discount = calculated discount
 * - grandTotal = subtotal + deliveryFee - discount
 * - delivery window: 30-45 minutes calculated dynamically
 */

export function calculateDeliveryEstimate(date = new Date()) {
  const start = new Date(date.getTime() + 25 * 60000);
  const end = new Date(date.getTime() + 45 * 60000);

  const formatTime = (d) => {
    return d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isToday = date.toDateString() === new Date().toDateString();
  const dayPrefix = isToday ? 'Today' : 'Tomorrow';
  const text = `${dayPrefix}, ${formatTime(start)} – ${formatTime(end)}`;

  return {
    estimatedDeliveryAt: end,
    estimatedDeliveryStartAt: start,
    estimatedDeliveryText: text,
    etaMinutes: 30,
  };
}

export function calculateCart(items = [], options = {}) {
  const { discountAmount = 0 } = options;

  if (!Array.isArray(items) || items.length === 0) {
    const delivery = calculateDeliveryEstimate();
    return {
      items: [],
      itemCount: 0,
      subtotal: 0,
      deliveryFee: 0,
      discount: 0,
      total: 0,
      grandTotal: 0,
      isFreeDelivery: true,
      freeDeliveryThreshold: 100,
      amountToFreeDelivery: 100,
      ...delivery,
    };
  }

  let subtotal = 0;
  let itemCount = 0;

  const calculatedItems = items.map((item) => {
    const qty = Math.max(1, parseInt(item.qty || item.quantity || 1, 10));
    const price = Number(item.price || item.unit_price || 0);
    const lineTotal = price * qty;

    subtotal += lineTotal;
    itemCount += qty;

    return {
      _id: item._id,
      id: item.id || item._id?.toString(),
      productId: item.productId || item.id || item._id,
      productType: item.productType || 'Medicine',
      name: item.name || 'Pharmaceutical Item',
      price,
      qty,
      lineTotal,
      image: item.image || item.img || '',
      type: item.type || (item.rxRequired ? 'Rx' : 'OTC'),
    };
  });

  // Free delivery for orders >= ₹100, else ₹30 express fee
  const FREE_DELIVERY_THRESHOLD = 100;
  const STANDARD_DELIVERY_FEE = 30;
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const isFreeDelivery = deliveryFee === 0;
  const amountToFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  const discount = Math.min(subtotal, Math.max(0, Number(discountAmount)));
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const delivery = calculateDeliveryEstimate();

  return {
    items: calculatedItems,
    itemCount,
    subtotal,
    deliveryFee,
    discount,
    total,
    grandTotal: total,
    isFreeDelivery,
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    amountToFreeDelivery,
    ...delivery,
  };
}

export default {
  calculateCart,
  calculateDeliveryEstimate,
};
