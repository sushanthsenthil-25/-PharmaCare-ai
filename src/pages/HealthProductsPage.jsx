import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const DEFAULT_HEALTH_IMG = "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3e%3crect width='100' height='100' fill='%23f1f5f9' rx='12'/%3e%3cpath d='M50 30v40M30 50h40' stroke='%235444ca' stroke-width='6' stroke-linecap='round'/%3e%3c/svg%3e";

export const HealthProductsPage = () => {
  const navigate = useNavigate();
  const { addToCart } = useApp();
  const [healthItems, setHealthItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchHealthProducts = async () => {
      setLoading(true);
      try {
        const res = await api.healthProducts.list({ limit: 50 });
        if (isMounted) {
          const items = Array.isArray(res) ? res : res?.products || res?.items || [];
          const mapped = items.map((p) => ({
            id: p._id || p.id,
            rawId: p._id || p.id,
            name: p.name,
            desc: p.description || 'Clinical Grade Supplement • High Potency',
            rating: p.rating ? Number(p.rating).toFixed(1) : '4.8',
            reviews: p.reviews || 450,
            price: Number(p.price || 399),
            originalPrice: p.originalPrice || Math.round(Number(p.price || 399) * 1.25),
            tag: p.tag || 'Clinical Choice',
            img: p.image || DEFAULT_HEALTH_IMG,
            stock: p.stock !== undefined ? p.stock : 50,
            productType: 'HealthProduct',
          }));
          setHealthItems(mapped);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHealthProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col w-full px-margin pb-12 gap-y-4">
      <div className="flex flex-col gap-1 pt-2">
        <h1 className="font-headline-md text-xl text-primary font-bold">
          Wellness & Health Products
        </h1>
        <p className="font-body-sm text-xs text-on-surface-variant">
          Clinical Grade Supplements, Diagnostic Devices & Daily Vitality
        </p>
      </div>

      {/* Featured Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/10 to-blue-900/10 border border-purple-500/20 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">AI Clinical Recommendation</span>
          <h3 className="font-bold text-sm text-primary">Daily Vitality & Immunity Pack</h3>
          <p className="text-[11px] text-on-surface-variant">Tailored nutrition formulated by AI health analysis</p>
        </div>
        <button 
          onClick={() => {
            if (healthItems.length > 0) navigate(`/product/${healthItems[0].id}`);
          }}
          className="px-3 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold shrink-0"
        >
          Explore
        </button>
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 gap-4">
        {loading && healthItems.length === 0 && (
          <div className="h-28 bg-surface-container-low rounded-2xl animate-pulse"></div>
        )}

        {healthItems.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-3"
          >
            <div className="flex gap-3">
              <img
                src={item.img}
                alt={item.name}
                onError={(e) => { e.target.src = DEFAULT_HEALTH_IMG; }}
                onClick={() => navigate(`/product/${item.id}`)}
                className="w-24 h-24 rounded-xl object-cover bg-surface-container-low cursor-pointer shrink-0 border border-outline-variant/10"
              />
              <div className="flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                      {item.tag}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-amber-600 font-bold">
                      <span className="material-symbols-outlined text-[14px]">star</span>
                      {item.rating} ({item.reviews})
                    </div>
                  </div>
                  <h3
                    onClick={() => navigate(`/product/${item.id}`)}
                    className="font-headline-sm text-sm font-bold text-primary hover:underline cursor-pointer mt-1 truncate"
                  >
                    {item.name}
                  </h3>
                  <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-1">{item.desc}</p>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-headline-sm text-base font-bold text-primary">₹{item.price}</span>
                  <span className="text-xs line-through text-on-surface-variant">₹{item.originalPrice}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => addToCart(item)}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
              Add to Cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HealthProductsPage;
