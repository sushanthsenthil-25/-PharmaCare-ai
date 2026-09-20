import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const STATUS_PROGRESS = {
  PLACED: 1,
  CONFIRMED: 2,
  PACKED: 3,
  SHIPPED: 4,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
  CANCELLED: -1,
};

export const TrackOrderPage = () => {
  const navigate = useNavigate();
  const { activeOrder, cart, loadActiveOrder, checkoutOrder } = useApp();
  const [orderData, setOrderData] = useState(null);
  const [searchOrderId, setSearchOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLatestOrder = async () => {
      setLoading(true);
      try {
        const orderIdToLookup = activeOrder.orderNumber || activeOrder.id || 'ORD-8942';
        const res = await api.orders.getById(orderIdToLookup);
        if (isMounted && res) {
          setOrderData(res);
        }
      } catch {
        // Fallback to activeOrder from context
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLatestOrder();
    return () => {
      isMounted = false;
    };
  }, [activeOrder.id, activeOrder.orderNumber]);

  const handleSearchOrder = async (e) => {
    e.preventDefault();
    if (!searchOrderId.trim()) return;
    setLoading(true);
    setSearchError(null);
    try {
      const res = await api.orders.getById(searchOrderId.trim());
      if (res) {
        setOrderData(res);
      }
    } catch (err) {
      setSearchError(`Order "${searchOrderId}" not found.`);
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = orderData?.status || activeOrder.status || 'OUT_FOR_DELIVERY';
  const progressIdx = STATUS_PROGRESS[currentStatus] ?? 4;
  const orderIdDisplay = orderData?.orderNumber || orderData?.id || activeOrder.orderNumber || activeOrder.id;
  const etaMinutes = orderData?.eta_minutes || orderData?.etaMinutes || activeOrder.etaMinutes || 18;
  const riderName = orderData?.rider_name || orderData?.riderName || activeOrder.riderName || 'Vikram Singh';
  const riderPhone = orderData?.rider_phone || orderData?.riderPhone || activeOrder.riderPhone || '+91 98765 43210';
  const deliveryAddress = orderData?.delivery_address || orderData?.shippingAddress || 'Indiranagar 100ft Rd, Bangalore 560038';

  const steps = [
    { title: 'Order Placed & Confirmed', completed: progressIdx >= 1, current: progressIdx === 1, time: 'Just now' },
    { title: 'AI Prescription Verified', completed: progressIdx >= 2, current: progressIdx === 2, time: '10:04 AM' },
    { title: 'Pharmacy Dispensed & Packed', completed: progressIdx >= 3, current: progressIdx === 3, time: '10:10 AM' },
    { title: 'Out for Delivery (Express Moped)', completed: progressIdx >= 4, current: progressIdx === 4, time: '10:15 AM' },
    { title: 'Delivered at Doorstep', completed: progressIdx >= 5, current: progressIdx === 5, time: `Est. ${etaMinutes} mins` },
  ];

  const handlePlaceNewOrder = async () => {
    if (cart.length === 0) {
      navigate('/medicines');
      return;
    }
    setPlacingOrder(true);
    try {
      const created = await checkoutOrder();
      if (created) {
        setOrderData(created);
      }
    } catch (err) {
      alert(err.message || 'Could not place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="flex flex-col w-full px-margin pb-16 gap-y-4 pt-2">
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
          onClick={() => loadActiveOrder()}
          className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-primary"
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
      <div className="p-5 rounded-2xl bg-gradient-to-br from-primary-container to-secondary-container/80 text-on-primary-container shadow-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest/30 backdrop-blur-sm font-label-sm text-[11px] font-bold tracking-wider uppercase">
            30-Min Express Delivery
          </span>
          <span className="font-mono text-xs font-bold text-primary">ID: {orderIdDisplay}</span>
        </div>

        <div className="flex flex-col gap-1 my-1">
          <span className="text-xs opacity-90 font-medium">Estimated Arrival Time</span>
          <h2 className="font-headline-lg text-3xl font-extrabold tracking-tight">
            {currentStatus === 'DELIVERED' ? 'Delivered' : `${etaMinutes} Minutes`}
          </h2>
          <span className="text-[11px] font-semibold text-primary/80">Status: {currentStatus}</span>
        </div>

        <div className="w-full bg-surface-container-lowest/30 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-primary h-full rounded-full transition-all duration-500 animate-pulse" 
            style={{ width: `${Math.min(100, Math.max(20, progressIdx * 20))}%` }}
          ></div>
        </div>
      </div>

      {/* Rider Contact Card */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[26px]">moped</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-secondary uppercase">Express Delivery Partner</span>
            <h4 className="font-headline-sm text-sm font-bold text-primary">{riderName}</h4>
            <span className="text-xs text-on-surface-variant">To: {deliveryAddress}</span>
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
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
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
                    step.current ? 'text-primary' : step.completed ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {step.title}
                </h4>
                <span className="text-[11px] text-on-surface-variant">{step.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items Summary & Instant Checkout */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-sm font-bold text-primary">Order Summary</h3>
          {cart.length > 0 && (
            <button
              onClick={handlePlaceNewOrder}
              disabled={placingOrder}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary/90 flex items-center gap-1"
            >
              {placingOrder ? 'Placing...' : 'Checkout Cart'}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {orderData?.items && orderData.items.length > 0 ? (
            orderData.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-on-surface font-medium">
                  {item.qty}x {item.name || 'Product'}
                </span>
                <span className="font-bold text-primary">₹{item.lineTotal || item.line_total || item.price * item.qty}</span>
              </div>
            ))
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-xs">
                <span className="text-on-surface font-medium">
                  {item.qty}x {item.name}
                </span>
                <span className="font-bold text-primary">₹{item.price * item.qty}</span>
              </div>
            ))
          )}
          <div className="border-t border-outline-variant/20 pt-2 flex justify-between items-center font-bold text-sm text-primary">
            <span>Total Amount (Demo Express COD)</span>
            <span>
              ₹{orderData?.total || orderData?.total_amount || cart.reduce((sum, item) => sum + item.price * item.qty, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackOrderPage;
