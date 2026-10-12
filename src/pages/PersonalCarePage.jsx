import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { getProductImageUrl, handleImageError } from '../utils/productImages';

export const PersonalCarePage = () => {
  const navigate = useNavigate();
  const { addToCart } = useApp();
  const [personalItems, setPersonalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = [
    'All',
    'Serums & Treatments',
    'Haircare & Growth',
    'Sun Protection',
    'Cleansers & Facewash',
    'Moisturizers & Creams',
    'Acne & Blemish Care',
  ];

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
            category: p.category || 'Clinical Skincare',
            desc: p.description || 'Clinical Skincare & Hygiene Formulation',
            price: Number(p.price || 320),
            originalPrice: p.originalPrice || Math.round(Number(p.price || 320) * 1.25),
            tag: p.tag || 'Dermatologist Verified',
            img: getProductImageUrl(p),
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

  const filteredItems = personalItems.filter((item) => {
    const matchesCat = activeCategory === 'All' || (item.category || '').toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = !searchFilter.trim() || item.name.toLowerCase().includes(searchFilter.trim().toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col w-full px-margin pb-16 gap-y-4">
      {/* Title & Banner */}
      <div className="flex flex-col gap-1 pt-2">
        <h1 className="font-headline-md text-xl text-primary font-bold">
          Personal Care & Derma Science
        </h1>
        <p className="font-body-sm text-xs text-on-surface-variant">
          Dermatologically Tested Skincare, Haircare & Hygiene Solutions
        </p>
      </div>

      {/* Trust Badges */}
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

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full font-label-sm text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">search</span>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Search personal care, serums, sunscreen..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Loading Skeleton */}
      {loading && personalItems.length === 0 && (
        <div className="flex flex-col gap-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-surface-container-low rounded-2xl animate-pulse"></div>
          ))}
        </div>
      )}

      {/* Personal Care List */}
      <div className="flex flex-col gap-3.5">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30"
          >
            <div className="flex gap-3">
              <img
                src={item.img}
                alt={item.name}
                width="80"
                height="80"
                loading="lazy"
                onError={(e) => handleImageError(e, 'PersonalCare')}
                onClick={() => navigate(`/product/${item.id}`)}
                className="w-20 h-20 rounded-xl object-contain bg-surface-container-low cursor-pointer shrink-0 border border-outline-variant/10 p-1"
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

        {!loading && filteredItems.length === 0 && (
          <div className="p-8 text-center text-xs text-on-surface-variant bg-surface-container-low/50 rounded-2xl">
            No personal care products match the selected category or search query.
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalCarePage;
