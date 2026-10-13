import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const STATUS_PROGRESS = {
  PLACED: 1,
  CONFIRMED: 2,
  ACCEPTED: 2,
  PREPARING: 3,
  PACKED: 4,
  READY_FOR_PICKUP: 4,
  SHIPPED: 4,
  OUT_FOR_DELIVERY: 5,
  DELIVERED: 6,
  CANCELLED: -1,
  REJECTED: -1,
};

export const TrackOrderPage = () => {
  const navigate = useNavigate();
  const { user, activeOrder, cart, loadActiveOrder, openCart } = useApp();
  const [orderData, setOrderData] = useState(null);
  const [searchOrderId, setSearchOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [networkError, setNetworkError] = useState(null);

  const activeId = activeOrder?.orderNumber || activeOrder?.id;

  const fetchTracking = async (idToQuery) => {
    if (!idToQuery || !String(idToQuery).trim()) return null;
    const cleanId = String(idToQuery).trim();

    try {
      setNetworkError(null);
      const res = await api.orders.getTracking(cleanId);
      if (res && (res.success || res.orderNumber || res.id)) {
        setOrderData(res);
        return res;
      }
    } catch {
      try {
        const order = await api.orders.getById(cleanId);
        if (order && (order.orderNumber || order.id || order._id)) {
          setOrderData(order);
          return order;
        }
      } catch (_) {
        // Return null if not found
        return null;
      }
    }
    return null;
  };

  const orderDataRef = useRef(orderData);
  useEffect(() => {
    orderDataRef.current = orderData;
  }, [orderData]);

  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;

    const loadData = async () => {
      if (activeId) {
        setLoading(true);
        try {
          await fetchTracking(activeId);
        } catch {
          if (isMounted) setNetworkError('Unable to connect to order tracking service. Please try again.');
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    };

    loadData();

    // Poll live tracking every 15 seconds without resetting loading spinner
    pollInterval = setInterval(() => {
      if (isMounted) {
        const currentData = orderDataRef.current;
        const currentId = currentData?.orderNumber || currentData?.id || activeId;
        if (currentId && currentData?.status !== 'DELIVERED' && currentData?.status !== 'CANCELLED') {
          fetchTracking(currentId).catch(() => {});
        }
      }
    }, 15000);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeId]);

  const handleSearchOrder = async (e) => {
    e.preventDefault();
    if (!searchOrderId.trim()) return;
    setLoading(true);
    setSearchError(null);
    setNetworkError(null);

    try {
      const res = await fetchTracking(searchOrderId.trim());
      if (!res) {
        setSearchError(`Order "${searchOrderId}" was not found. Please verify the order number.`);
      }
    } catch (err) {
      setSearchError(err.message || `Order "${searchOrderId}" was not found.`);
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = orderData?.status || activeOrder?.status || 'PENDING_CONFIRMATION';
  const progressIdx = STATUS_PROGRESS[currentStatus] ?? 2;
  const orderIdDisplay = orderData?.orderNumber || orderData?.orderId || orderData?.id || activeOrder?.orderNumber || activeOrder?.id;
  const etaText = orderData?.estimatedDeliveryText || activeOrder?.estimatedDeliveryText || 'Estimated 30–45 mins';
  const riderName = orderData?.riderName || orderData?.rider_name || activeOrder?.riderName || 'Assigned on Dispatch';
  const riderPhone = orderData?.riderPhone || orderData?.rider_phone || activeOrder?.riderPhone || null;
  const deliveryAddress = orderData?.shippingAddress || orderData?.delivery_address || activeOrder?.shippingAddress || 'Indiranagar, Bangalore 560038';
  const currentLocation = orderData?.currentLocation || activeOrder?.currentLocation || 'Live coordinates update once out for delivery.';

  const steps = [
    { title: 'Order Placed & Received', description: 'Order registered in PharmaCare Express system', completed: progressIdx >= 1, current: progressIdx === 1 },
    { title: 'Clinical Prescription Verified', description: 'Item formulation and safety checked', completed: progressIdx >= 2, current: progressIdx === 2 },
    { title: 'Pharmacy Dispensing & Prepping', description: 'Certified pharmacist packing items', completed: progressIdx >= 3, current: progressIdx === 3 },
    { title: 'Tamper-Proof Packed & Sealed', description: 'Sealed with clinical barcode safety tag', completed: progressIdx >= 4, current: progressIdx === 4 },
    { title: 'Out for Delivery (Express Moped)', description: `${riderName} is in transit`, completed: progressIdx >= 5, current: progressIdx === 5 },
    { title: 'Delivered at Doorstep', description: 'Medications safely handed over', completed: progressIdx >= 6, current: progressIdx === 6 },
  ];

  // Authoritative calculations with guaranteed null-safety
  const subtotal = orderData?.subtotal ?? activeOrder?.subtotal ?? (orderData?.items || activeOrder?.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
  const deliveryFee = orderData?.deliveryFee ?? activeOrder?.deliveryFee ?? (subtotal >= 100 ? 0 : 30);
  const discount = orderData?.discount ?? activeOrder?.discount ?? 0;
  const grandTotal = orderData?.total ?? orderData?.total_amount ?? activeOrder?.totalAmount ?? Math.max(0, subtotal + deliveryFee - discount);
  const displayItems = (orderData?.items && orderData.items.length > 0)
    ? orderData.items
    : (activeOrder?.items && activeOrder.items.length > 0)
    ? activeOrder.items
    : (Array.isArray(cart) ? cart : []);

  return (
    <div className="flex flex-col w-full px-margin pb-12 gap-y-3 pt-1">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <h1 className="font-headline-sm text-sm font-bold text-primary">Live Express Order Tracking</h1>
        <button 
          aria-label="Refresh Order"
          onClick={() => {
            loadActiveOrder?.();
            if (orderIdDisplay) fetchTracking(orderIdDisplay);
          }}
          className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[17px]">refresh</span>
        </button>
      </div>

      {/* Lookup Search Bar */}
      <form onSubmit={handleSearchOrder} className="flex gap-2">
        <input
          type="text"
          value={searchOrderId}
          onChange={(e) => setSearchOrderId(e.target.value)}
          placeholder="Enter Order ID (e.g. ORD-1024)"
          className="flex-1 py-2 px-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1 hover:bg-primary/90 transition-all"
        >
          {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
          <span>{loading ? 'Finding...' : 'Track'}</span>
        </button>
      </form>

      {/* Search Error Banner */}
      {searchError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between">
          <span>{searchError}</span>
          <button onClick={() => setSearchError(null)} className="text-red-600 hover:text-red-800 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Network / Service Warning Banner */}
      {networkError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between">
          <span>{networkError}</span>
          <button
            onClick={() => { if (orderIdDisplay) fetchTracking(orderIdDisplay); }}
            className="text-amber-800 underline font-bold ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !orderIdDisplay && (
        <div className="flex flex-col gap-3 py-4 animate-pulse">
          <div className="h-32 bg-surface-container-low rounded-2xl"></div>
          <div className="h-16 bg-surface-container-low rounded-xl"></div>
          <div className="h-40 bg-surface-container-low rounded-xl"></div>
        </div>
      )}

      {/* View Case 1: No Order Selected (Visitor or Clean State) */}
      {!loading && !orderIdDisplay && (
        <div className="py-10 px-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 text-center flex flex-col items-center gap-3 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[32px]">local_shipping</span>
          </div>

          <div>
            <h2 className="font-headline-sm text-sm font-bold text-primary">
              {user?.isLoggedIn ? 'No Active Orders in Transit' : 'Track Your Express Order'}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1.5 max-w-xs leading-relaxed">
              {user?.isLoggedIn
                ? 'You do not currently have any orders being processed. Enter an Order ID above if you placed an order as a guest, or browse our catalogue to place a new order.'
                : 'Enter your Order ID in the search box above to track live fulfillment, or sign in to your PharmaCare account to view your complete order history.'}
            </p>
          </div>

          <div className="flex gap-2 mt-2 w-full max-w-xs">
            {!user?.isLoggedIn && (
              <button
                onClick={() => navigate('/login')}
                className="flex-1 py-2.5 rounded-xl bg-surface-container-low text-primary border border-outline-variant/20 text-xs font-bold hover:bg-surface-container transition-colors"
              >
                Sign In
              </button>
            )}
            <button
              onClick={() => navigate('/medicines')}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary/90 transition-all"
            >
              Browse Medicines
            </button>
          </div>
        </div>
      )}

      {/* View Case 2: Active Order Selected */}
      {orderIdDisplay && (
        <>
          {/* Express ETA Hero Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary-container to-secondary-container/80 text-on-primary-container shadow-md flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-lowest/30 backdrop-blur-sm font-label-sm text-[10px] font-bold tracking-wider uppercase">
                30-Min Express Delivery
              </span>
              <span className="font-mono text-xs font-bold text-primary">ID: {orderIdDisplay}</span>
            </div>

            <div className="flex flex-col gap-0.5 my-0.5">
              <span className="text-[11px] opacity-90 font-medium">Estimated Arrival Window</span>
              <h2 className="font-headline-lg text-xl font-extrabold tracking-tight">
                {currentStatus === 'DELIVERED' ? 'Delivered' : etaText}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs font-bold text-primary">Status: {currentStatus.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div className="w-full bg-surface-container-lowest/30 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(16, progressIdx * 16.6))}%` }}
              ></div>
            </div>
          </div>

          {/* Courier Location Status */}
          <div className="p-3 rounded-xl bg-surface-container-low/40 border border-outline-variant/15 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
              <span className="material-symbols-outlined text-[18px]">explore</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] uppercase font-bold text-on-surface-variant">Live Delivery Status</span>
              <span className="text-xs font-semibold text-primary truncate">{currentLocation}</span>
            </div>
          </div>

          {/* Delivery Partner Card */}
          <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">moped</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-secondary uppercase">Express Courier</span>
                <h3 className="font-headline-sm text-xs font-bold text-primary truncate">{riderName}</h3>
                <span className="text-[11px] text-on-surface-variant truncate max-w-[190px]">To: {deliveryAddress}</span>
              </div>
            </div>
            {riderPhone && (
              <a
                href={`tel:${riderPhone}`}
                className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm hover:bg-primary/90 transition-all shrink-0"
                title="Call Courier"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
              </a>
            )}
          </div>

          {/* Fulfillment Timeline */}
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-3">
            <h3 className="font-headline-sm text-xs font-bold text-primary border-b border-outline-variant/10 pb-1.5">
              Fulfillment Timeline
            </h3>

            <div className="flex flex-col gap-3 relative pl-1">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-3 items-start relative">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-all ${
                        step.completed
                          ? 'bg-emerald-500 text-white'
                          : step.current
                          ? 'bg-primary text-on-primary ring-4 ring-primary/20 animate-pulse'
                          : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30'
                      }`}
                    >
                      {step.completed ? (
                        <span className="material-symbols-outlined text-[12px]">check</span>
                      ) : (
                        idx + 1
                      )}
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={`w-0.5 h-6 my-0.5 ${
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
                    <span className="text-[10px] text-on-surface-variant">{step.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Items & Bill Details */}
          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-xs font-bold text-primary">Order Items & Bill Details</h3>
              {cart?.length > 0 && (
                <button
                  onClick={openCart}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">shopping_bag</span>
                  <span>Cart ({cart.reduce((s, i) => s + (i.qty || 1), 0)})</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {displayItems.length > 0 ? (
                displayItems.map((item, idx) => {
                  const price = Number(item.price || item.unit_price || 0);
                  const qty = item.qty || item.quantity || 1;
                  const lineTotal = item.lineTotal || item.line_total || price * qty;
                  return (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-on-surface font-medium truncate max-w-[220px]">
                        {qty}x {item.name || 'Medicine'}
                      </span>
                      <span className="font-bold text-primary">₹{lineTotal}</span>
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-on-surface-variant">Prescription Medication Package</span>
              )}

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
                <div className="border-t border-outline-variant/20 pt-1.5 flex justify-between font-bold text-xs text-primary">
                  <span>Total Amount</span>
                  <span className="text-secondary font-extrabold text-sm">₹{grandTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TrackOrderPage;
