import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { AIAssistantOrb } from '../components/AIAssistantOrb';
import { NearbyPharmacyMap } from '../components/NearbyPharmacyMap';
import api from '../services/api';

const DEFAULT_MED_IMG = 'https://lh3.googleusercontent.com/aida/AEtjO1VIkX8kPJK_xW2FPVInEq_EGA82uqOOY5cS3ouVzqzwCkaEf4sRVAfyP0OXWNZmJa7vEdaXwmq9ROrI_Rq2f4uR1_Kh74uQKxV87Yd8RMwm8JRNZgegzFQW8oSrG4hZMoqcN5TR2v0L_n7BMhgoqvuXPzc8Lq3YxVVVs-Gp2YhIG4pDsk-rnnH_8b-nmNYvaH7y9ukMvuuROUxNOFFv_1HwwN4t4l9FIRiJUw-_zeAd8dHNby5bS84qHwT1';
const DEFAULT_SUPP_IMG = 'https://lh3.googleusercontent.com/aida/AEtjO1WnJb_LqoDitrvUInitqtbd-bt_IBv6YrQ3rw4xW9Fj2qim4FUBm7uy93MZ2g0Hzl5R3KwPf_U6816DqGwOrhfNqe1a1DpWBI41Uuc8L7uJG1dgpzNp5F6MXKFkfVDKKrkOCU1vjGO1_fvbX9xMRdNtV0x5aZnBhtPJkHXsBtjbNv2CVZohpy2_nXei4io0yrOBt6_l5CMuUanfLV5QzOU54Xh3BSi3zn9liLzlfD-Vx-47DxGQMYLrvwS_';

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, activeOrder, addToCart, dashboardSummary, loadDashboardSummary } = useApp();
  const [quickReorders, setQuickReorders] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      loadDashboardSummary();
      try {
        const items = await api.medicines.list({ limit: 4 });
        if (isMounted && Array.isArray(items) && items.length > 0) {
          const mapped = items.slice(0, 3).map((p, idx) => ({
            id: p._id || p.id,
            rawId: p._id || p.id,
            name: p.name,
            desc: p.genericName ? `Generic: ${p.genericName}` : (p.composition || 'Clinical Active Formulation'),
            price: Number(p.price || 145),
            originalPrice: p.originalPrice || Math.round(Number(p.price || 145) * 1.25),
            tag: p.rxRequired ? 'Rx Required' : 'Top Rated',
            img: p.image || (idx % 2 === 0 ? DEFAULT_MED_IMG : DEFAULT_SUPP_IMG),
            stock: p.stock,
            expiryStatus: p.expiryStatus,
            productType: 'Medicine',
          }));
          setQuickReorders(mapped);
        }
      } catch {
        // Fallback
      }
    };

    fetchHomeData();
    return () => {
      isMounted = false;
    };
  }, [loadDashboardSummary]);

  const categories = [
    { title: 'Medicines', icon: 'medication', path: '/medicines', color: 'bg-blue-500/10 text-blue-600', badge: 'Prescription & OTC' },
    { title: 'Personal Care', icon: 'spa', path: '/personal-care', color: 'bg-emerald-500/10 text-emerald-600', badge: 'Skincare & Body' },
    { title: 'Health Products', icon: 'vital_signs', path: '/health', color: 'bg-purple-500/10 text-purple-600', badge: 'Vitamins & Devices' },
    { title: 'Track Express Order', icon: 'local_shipping', path: '/track-order', color: 'bg-amber-500/10 text-amber-600', badge: '30-Min ETA' }
  ];

  return (
    <div className="flex flex-col w-full px-margin pb-10 gap-y-5">
      {/* Top Greeting & Express Delivery Banner */}
      <section className="flex flex-col gap-2.5 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary tracking-wider uppercase font-semibold text-[11px]">
              Welcome back
            </span>
            <h1 className="font-headline-md text-headline-md text-primary font-bold tracking-tight text-xl">
              Good morning, {user.name}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container/60 border border-secondary/20">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="font-label-sm text-label-sm text-on-secondary-container font-semibold text-[11px]">
              30 Min Express
            </span>
          </div>
        </div>

        {/* Quick Rx Upload CTA */}
        <button 
          onClick={() => navigate('/medicines')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all active:scale-[0.99] text-left group border border-outline-variant/10"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-lg text-label-lg text-primary font-bold">
                Quick Rx Prescription Upload
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                Instant AI verification • Doorstep in 30 mins
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </div>
        </button>
      </section>

      {/* AI Assistant Voice Core Hero */}
      <AIAssistantOrb />

      {/* Nearby Pharmacies OpenStreetMap Component */}
      <NearbyPharmacyMap />

      {/* Live Order Tracker Widget */}
      <section 
        onClick={() => navigate('/track-order')}
        className="cursor-pointer p-4 rounded-2xl bg-gradient-to-r from-primary-container/20 to-secondary-container/30 border border-primary/20 shadow-sm flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px] animate-bounce">moped</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-xs font-bold text-primary">LIVE TRACKING</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            </div>
            <span className="font-body-sm text-xs text-on-surface font-semibold">
              Order {activeOrder.orderNumber || activeOrder.id} • Arriving in {activeOrder.etaMinutes} mins
            </span>
          </div>
        </div>
        <span className="material-symbols-outlined text-primary text-[20px]">chevron_right</span>
      </section>

      {/* Live Backend Statistics Pill Grid */}
      {dashboardSummary && (
        <section className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/15 flex flex-col text-center shadow-sm">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant">Products</span>
            <span className="font-bold text-base text-primary">{dashboardSummary.product_count}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/15 flex flex-col text-center shadow-sm">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant">Active Orders</span>
            <span className="font-bold text-base text-secondary">{dashboardSummary.active_orders}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/15 flex flex-col text-center shadow-sm">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant">Alerts</span>
            <span className={`font-bold text-base ${dashboardSummary.unread_alerts > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {dashboardSummary.unread_alerts}
            </span>
          </div>
        </section>
      )}

      {/* Quick Category Grid */}
      <section className="flex flex-col gap-3">
        <h3 className="font-headline-sm text-headline-sm text-primary font-bold text-base">
          Explore Healthcare Services
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.title}
              onClick={() => navigate(cat.path)}
              className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-28 group"
            >
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cat.color}`}>
                  <span className="material-symbols-outlined text-[22px]">{cat.icon}</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-0.5 transition-transform text-[18px]">
                  arrow_forward
                </span>
              </div>
              <div>
                <h4 className="font-headline-sm text-sm text-primary font-bold">{cat.title}</h4>
                <p className="font-body-sm text-[11px] text-on-surface-variant">{cat.badge}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reorder & Recommendations */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm text-primary font-bold text-base">
            Frequent Prescriptions & AI Suggestions
          </h3>
          <button onClick={() => navigate('/medicines')} className="text-xs font-bold text-secondary hover:underline">
            View All
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {quickReorders.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm flex items-center justify-between gap-3"
            >
              <div 
                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                onClick={() => navigate(`/product/${item.id}`)}
              >
                <img src={item.img} alt={item.name} className="w-14 h-14 rounded-xl object-cover bg-surface-container-low shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">{item.tag}</span>
                  <h4 className="font-headline-sm text-sm font-bold text-primary truncate">{item.name}</h4>
                  <span className="text-xs text-on-surface-variant truncate">{item.desc}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-sm text-primary">₹{item.price}</span>
                    <span className="text-xs line-through text-on-surface-variant">₹{item.originalPrice}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => addToCart(item)}
                className="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                Add
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
