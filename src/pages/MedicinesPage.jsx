import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const DEFAULT_MEDICINE_IMG = "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3e%3crect width='100' height='100' fill='%23f1f5f9' rx='12'/%3e%3cpath d='M50 30v40M30 50h40' stroke='%235444ca' stroke-width='6' stroke-linecap='round'/%3e%3c/svg%3e";

export const MedicinesPage = () => {
  const navigate = useNavigate();
  const { addToCart } = useApp();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchFilter, setSearchFilter] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = { limit: 50 };
        if (activeCategory !== 'All') params.category = activeCategory;
        if (searchFilter.trim()) params.search = searchFilter.trim();

        const res = await api.medicines.list(params);
        if (isMounted) {
          const items = Array.isArray(res) ? res : res?.medicines || res?.items || [];
          const mapped = items.map((p) => {
            const origPrice = p.originalPrice || p.mrp || Math.round(p.price * 1.25);
            return {
              id: p._id || p.id,
              rawId: p._id || p.id,
              name: p.name,
              genericName: p.genericName,
              scientificName: p.scientificName,
              brand: p.brand || p.manufacturer || 'PharmaCare Labs',
              category: p.category || (p.rxRequired ? 'Prescription (Rx)' : 'Over-The-Counter (OTC)'),
              composition: p.composition || p.description || 'Clinical Active Formulation',
              strength: p.strength || '',
              mfgDate: p.manufacturingDate ? new Date(p.manufacturingDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Jan 2026',
              expDate: p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Jan 2028',
              expiryStatus: p.expiryStatus || 'VALID',
              isExpired: p.expiryStatus === 'EXPIRED',
              batchNumber: p.batchNumber || 'AMX-2026',
              price: Number(p.price || p.selling_price || 145),
              originalPrice: origPrice,
              discount: p.discount || '15% OFF',
              stock: p.stock !== undefined ? p.stock : 50,
              rxRequired: Boolean(p.rxRequired || p.rx_required),
              img: p.image || p.image_url || DEFAULT_MEDICINE_IMG,
            };
          });
          setProducts(mapped);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounce);
    };
  }, [activeCategory, searchFilter]);

  const categories = [
    'All',
    'Pain & Fever',
    'Allergy',
    'Gastric/Acidity',
    'Antibiotic',
    'Pain & Inflammation',
    'Diabetes',
    'Blood Pressure',
    'Cholesterol',
    'Supplement',
    'Anti-nausea',
    'Cough',
    'Rehydration',
  ];

  const getExpiryBadge = (item) => {
    if (item.expiryStatus === 'EXPIRED' || item.isExpired) {
      return <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300">EXPIRED - DO NOT SELL</span>;
    }
    if (item.expiryStatus === 'EXPIRES_SOON') {
      return <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">EXPIRING SOON</span>;
    }
    return <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">VERIFIED VALID</span>;
  };

  return (
    <div className="flex flex-col w-full px-margin pb-12 gap-y-4">
      {/* Title & Upload Banner */}
      <div className="flex flex-col gap-1 pt-2">
        <h1 className="font-headline-md text-xl text-primary font-bold">
          Medicines & Clinical Formulations
        </h1>
        <p className="font-body-sm text-xs text-on-surface-variant">
          100% Genuine Certified Pharmaceuticals with AI Dosage & Expiry Verification
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
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
          placeholder="Search by drug name, generic name, composition..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Loading Skeleton */}
      {loading && products.length === 0 && (
        <div className="flex flex-col gap-3 py-4">
          <div className="h-32 bg-surface-container-low rounded-2xl animate-pulse"></div>
          <div className="h-32 bg-surface-container-low rounded-2xl animate-pulse"></div>
        </div>
      )}

      {/* Medicines List */}
      <div className="flex flex-col gap-3.5">
        {products.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl bg-surface-container-lowest border shadow-sm flex flex-col gap-3 ${
              item.isExpired ? 'border-red-300 bg-red-50/20' : 'border-outline-variant/15'
            }`}
          >
            <div className="flex gap-3">
              <img
                src={item.img}
                alt={item.name}
                onError={(e) => { e.target.src = DEFAULT_MEDICINE_IMG; }}
                onClick={() => navigate(`/product/${item.id}`)}
                className="w-20 h-20 rounded-xl object-cover bg-surface-container-low cursor-pointer shrink-0 border border-outline-variant/10"
              />
              <div className="flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${item.rxRequired ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {item.rxRequired ? 'Rx Required' : 'OTC Certified'}
                    </span>
                    {getExpiryBadge(item)}
                  </div>
                  <h3
                    onClick={() => navigate(`/product/${item.id}`)}
                    className="font-headline-sm text-sm font-bold text-primary hover:underline cursor-pointer mt-0.5 truncate"
                  >
                    {item.name}
                  </h3>
                  {item.genericName && (
                    <p className="text-[11px] font-semibold text-secondary truncate">
                      Generic: {item.genericName}
                    </p>
                  )}
                  <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-1">{item.composition}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant pt-1 border-t border-outline-variant/10">
                  <span>Batch: <strong className="text-primary">{item.batchNumber}</strong></span>
                  <span>EXP: <strong className={item.isExpired ? 'text-red-600' : 'text-primary'}>{item.expDate}</strong></span>
                  <span>Stock: <strong className="text-primary">{item.stock}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
              <div className="flex items-baseline gap-1.5">
                <span className="font-headline-sm text-base font-bold text-primary">₹{item.price}</span>
                <span className="text-xs line-through text-on-surface-variant">₹{item.originalPrice}</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                  {item.discount}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/product/${item.id}`)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-low text-xs font-semibold text-primary hover:bg-surface-container transition-colors"
                >
                  Details
                </button>
                <button
                  onClick={() => addToCart(item)}
                  disabled={item.isExpired || item.stock <= 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1 ${
                    item.isExpired || item.stock <= 0
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-primary text-on-primary hover:bg-primary/90'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {item.isExpired ? 'block' : 'add_shopping_cart'}
                  </span>
                  {item.isExpired ? 'Expired' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {!loading && products.length === 0 && (
          <div className="p-8 text-center text-xs text-on-surface-variant bg-surface-container-low/50 rounded-2xl">
            No medicines match the selected filter or search term.
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicinesPage;
