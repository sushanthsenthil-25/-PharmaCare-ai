import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const STATUS_PROGRESS = {
  PLACED: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  PACKED: 4,
  SHIPPED: 4,
  OUT_FOR_DELIVERY: 5,
  DELIVERED: 6,
  CANCELLED: -1,
};

export const TrackOrderPage = () => {
  const navigate = useNavigate();
  const { activeOrder, cart, loadActiveOrder, openCart } = useApp();
  const [orderData, setOrderData] = useState(null);
  const [searchOrderId, setSearchOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const activeId = activeOrder.orderNumber || activeOrder.id || 'ORD-8942';

  const fetchTracking = async (idToQuery) => {
    try {
      const res = await api.orders.getTracking(idToQuery);
      if (res && res.success) {
        setOrderData(res);
        return res;
      }
    } catch {
      try {
        const order = await api.orders.getById(idToQuery);
        if (order) setOrderData(order);
      } catch {
        // Keep active order
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;

    const loadData = async () => {
      setLoading(true);
      await fetchTracking(activeId);
      if (isMounted) setLoading(false);
    };

    loadData();

    // Poll live tracking every 12 seconds
    pollInterval = setInterval(() => {
      if (isMounted) {
        const currentId = orderData?.orderNumber || orderData?.id || activeId;
        if (orderData?.status !== 'DELIVERED' && orderData?.status !== 'CANCELLED') {
          fetchTracking(currentId);
        }
      }
    }, 12000);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeId, orderData?.status]);

  const handleSearchOrder = async (e) => {
    e.preventDefault();
    if (!searchOrderId.trim()) return;
    setLoading(true);
    setSearchError(null);
    try {
      const res = await fetchTracking(searchOrderId.trim());
      if (!res) {
        setSearchError(`Order "${searchOrderId}" not found.`);
      }
    } catch (err) {
      setSearchError(`Order "${searchOrderId}" not found.`);
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = orderData?.status || activeOrder.status || 'CONFIRMED';
  const progressIdx = STATUS_PROGRESS[currentStatus] ?? 2;
  const orderIdDisplay = orderData?.orderNumber || orderData?.orderId || orderData?.id || activeOrder.orderNumber || activeOrder.id;
  const etaText = orderData?.estimatedDeliveryText || activeOrder.estimatedDeliveryText || 'Today, 30–45 mins';
  const etaMinutes = orderData?.etaMinutes || orderData?.eta_minutes || activeOrder.etaMinutes || 30;
  const riderName = orderData?.riderName || orderData?.rider_name || activeOrder.riderName || 'Vikram Singh';
  const riderPhone = orderData?.riderPhone || orderData?.rider_phone || activeOrder.riderPhone || '+91 98765 43210';
  const deliveryAddress = orderData?.shippingAddress || orderData?.delivery_address || 'Indiranagar 100ft Rd, Bangalore 560038';
  const currentLocation = orderData?.currentLocation || 'Live driver location will appear when available.';

  const steps = [
    { title: 'Order Placed & Received', description: 'Order registered in PharmaCare Express', completed: progressIdx >= 1, current: progressIdx === 1 },
    { title: 'Clinical Prescription Verified', description: 'AI safety dosage & item check verified', completed: progressIdx >= 2, current: progressIdx === 2 },
    { title: 'Pharmacy Dispensing & Prepping', description: 'Certified pharmacist preparing items', completed: progressIdx >= 3, current: progressIdx === 3 },
    { title: 'Tamper-Proof Packed & Sealed', description: 'Sealed with clinical barcode tag', completed: progressIdx >= 4, current: progressIdx === 4 },
    { title: 'Out for Delivery (Express Moped)', description: `${riderName} is on the way`, completed: progressIdx >= 5, current: progressIdx === 5 },
    { title: 'Delivered at Doorstep', description: 'Handed over at Indiranagar delivery point', completed: progressIdx >= 6, current: progressIdx === 6 },
  ];

  const subtotal = orderData?.subtotal ?? activeOrder.subtotal ?? (orderData?.items || activeOrder.items || []).reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  const deliveryFee = orderData?.deliveryFee ?? activeOrder.deliveryFee ?? (subtotal >= 100 ? 0 : 30);
  const discount = orderData?.discount ?? activeOrder.discount ?? 0;
  const grandTotal = orderData?.total ?? orderData?.total_amount ?? activeOrder.totalAmount ?? (subtotal + deliveryFee - discount);
  const displayItems = orderData?.items?.length ? orderData.items : (activeOrder.items?.length ? activeOrder.items : cart);

  return (
    <div className="flex flex-col w-full px-margin pb-20 gap-y-4 pt-2">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-primary hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="font-headline-sm text-base font-bold text-primary">Live Express Order Tracking</h1>
        <button 
          aria-label="Refresh Order"
          onClick={() => {
            loadActiveOrder();
            fetchTracking(orderIdDisplay);
          }}
          className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-primary hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </div>

      {/* Lookup by Order ID Search Bar */}
      <form onSubmit={handleSearchOrder} className="flex gap-2">
        <input
          type="text"
          value={searchOrderId}
          onChange={(e) => setSearchOrderId(e.target.value)}
          placeholder="Enter Order ID (e.g. ORD-8942)"
          className="flex-1 py-2 px-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm"
        >
          Track
        </button>
      </form>

      {searchError && (
        <div className="p-2.5 rounded-xl bg-red-100 text-red-800 text-xs font-semibold">
          {searchError}
        </div>
      )}

      {/* Express ETA Hero Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-primary-container to-secondary-container/80 text-on-primary-container shadow-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest/30 backdrop-blur-sm font-label-sm text-[11px] font-bold tracking-wider uppercase">
            30-Min Express Delivery
          </span>
          <span className="font-mono text-xs font-bold text-primary">ID: {orderIdDisplay}</span>
        </div>

        <div className="flex flex-col gap-1 my-1">
          <span className="text-xs opacity-90 font-medium">Estimated Arrival Window</span>
          <h2 className="font-headline-lg text-2xl font-extrabold tracking-tight">
            {currentStatus === 'DELIVERED' ? 'Delivered' : etaText}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs font-bold text-primary">Status: {currentStatus.replace(/_/g, ' ')}</span>
          </div>
        </div>

        <div className="w-full bg-surface-container-lowest/30 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-primary h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(16, progressIdx * 16.6))}%` }}
          ></div>
        </div>
      </div>

      {/* Driver Location Info (Accurate Non-hallucinated status) */}
      <div className="p-3.5 rounded-2xl bg-surface-container-low/40 border border-outline-variant/15 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
          <span className="material-symbols-outlined text-[20px]">explore</span>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] uppercase font-bold text-on-surface-variant">Live Driver GPS</span>
          <span className="text-xs font-semibold text-primary truncate">{currentLocation}</span>
        </div>
      </div>

      {/* Rider Contact Card */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">moped</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-secondary uppercase">Express Delivery Partner</span>
            <h4 className="font-headline-sm text-sm font-bold text-primary">{riderName}</h4>
            <span className="text-xs text-on-surface-variant truncate max-w-[190px]">To: {deliveryAddress}</span>
          </div>
        </div>
        <a
          href={`tel:${riderPhone}`}
          className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm hover:bg-primary/90 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">call</span>
        </a>
      </div>

      {/* Order Progress Timeline */}
      <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-4">
        <h3 className="font-headline-sm text-sm font-bold text-primary border-b border-outline-variant/10 pb-2">
          Fulfillment Timeline
        </h3>

        <div className="flex flex-col gap-4 relative pl-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-4 items-start relative">
              <div className="flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all ${
                    step.completed
                      ? 'bg-emerald-500 text-white'
                      : step.current
                      ? 'bg-primary text-on-primary ring-4 ring-primary/20 animate-pulse'
                      : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30'
                  }`}
                >
                  {step.completed ? (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-8 my-1 ${
                      step.completed ? 'bg-emerald-500' : 'bg-outline-variant/30'
                    }`}
                  ></div>
                )}
              </div>

              <div className="flex flex-col">
                <h4
                  className={`font-headline-sm text-xs font-bold ${
                    step.current ? 'text-primary font-extrabold' : step.completed ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {step.title}
                </h4>
                <span className="text-[11px] text-on-surface-variant">{step.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items Summary & Cart Management */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-sm font-bold text-primary">Order Items & Bill Details</h3>
          {cart.length > 0 && (
            <button
              onClick={openCart}
              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">shopping_bag</span>
              <span>Open Cart ({cart.reduce((s, i) => s + (i.qty || 1), 0)})</span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {displayItems.map((item, idx) => {
            const price = Number(item.price || item.unit_price || 0);
            const qty = item.qty || item.quantity || 1;
            const lineTotal = item.lineTotal || item.line_total || price * qty;
            return (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-on-surface font-medium truncate max-w-[220px]">
                  {qty}x {item.name || 'Product'}
                </span>
                <span className="font-bold text-primary">₹{lineTotal}</span>
              </div>
            );
          })}

          <div className="border-t border-outline-variant/20 pt-2 flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-on-surface-variant">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Delivery Fee</span>
              <span className={deliveryFee === 0 ? 'text-emerald-600 font-bold' : ''}>
                {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-₹{discount}</span>
              </div>
            )}
            <div className="border-t border-outline-variant/20 pt-1.5 flex justify-between font-bold text-sm text-primary">
              <span>Total (Paid via Demo COD)</span>
              <span className="text-secondary font-extrabold">₹{grandTotal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackOrderPage;
