import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const DEFAULT_PERSONAL_IMG = "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3e%3crect width='100' height='100' fill='%23f1f5f9' rx='12'/%3e%3cpath d='M50 30v40M30 50h40' stroke='%235444ca' stroke-width='6' stroke-linecap='round'/%3e%3c/svg%3e";

export const PersonalCarePage = () => {
  const navigate = useNavigate();
  const { addToCart } = useApp();
  const [personalItems, setPersonalItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPersonalItems = async () => {
      setLoading(true);
      try {
        const res = await api.personalCare.list({ limit: 50 });
        if (isMounted) {
          const items = Array.isArray(res) ? res : res?.products || res?.items || [];
          const mapped = items.map((p) => ({
            id: p._id || p.id,
            rawId: p._id || p.id,
            name: p.name,
            desc: p.description || 'Clinical Skincare & Hygiene Formulation',
            price: Number(p.price || 320),
            originalPrice: p.originalPrice || Math.round(Number(p.price || 320) * 1.25),
            tag: p.tag || 'Dermatologist Verified',
            img: p.image || DEFAULT_PERSONAL_IMG,
            stock: p.stock !== undefined ? p.stock : 50,
            productType: 'PersonalCareProduct',
          }));
          setPersonalItems(mapped);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPersonalItems();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col w-full px-margin pb-12 gap-y-4">
      <div className="flex flex-col gap-1 pt-2">
        <h1 className="font-headline-md text-xl text-primary font-bold">
          Personal Care & Derma Science
        </h1>
        <p className="font-body-sm text-xs text-on-surface-variant">
          Dermatologically Tested Skincare, Haircare & Hygiene Solutions
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 my-1">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600 text-[20px]">verified</span>
          <span className="text-[11px] font-bold text-emerald-800">Dermatologist Approved</span>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-[20px]">eco</span>
          <span className="text-[11px] font-bold text-blue-800">100% Toxin Free</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {loading && personalItems.length === 0 && (
          <div className="h-28 bg-surface-container-low rounded-2xl animate-pulse"></div>
        )}

        {personalItems.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-3"
          >
            <div className="flex gap-3">
              <img
                src={item.img}
                alt={item.name}
                onError={(e) => { e.target.src = DEFAULT_PERSONAL_IMG; }}
                onClick={() => navigate(`/product/${item.id}`)}
                className="w-20 h-20 rounded-xl object-cover bg-surface-container-low cursor-pointer shrink-0 border border-outline-variant/10"
              />
              <div className="flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{item.tag}</span>
                  <h3
                    onClick={() => navigate(`/product/${item.id}`)}
                    className="font-headline-sm text-sm font-bold text-primary hover:underline cursor-pointer truncate"
                  >
                    {item.name}
                  </h3>
                  <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-1">{item.desc}</p>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-sm text-base font-bold text-primary">₹{item.price}</span>
                  <span className="text-xs line-through text-on-surface-variant">₹{item.originalPrice}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => addToCart(item)}
              className="w-full py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-1"
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

export default PersonalCarePage;
