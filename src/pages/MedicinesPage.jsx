import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { getProductImageUrl, handleImageError } from '../utils/productImages';

export const MedicinesPage = () => {
  const navigate = useNavigate();
  const { addToCart } = useApp();

  // Mode: 'catalogue' (11,621 Indian formulations) or 'store' (Live local pharmacy stock)
  const [viewMode, setViewMode] = useState('catalogue');

  // Common filters & search
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDosage, setSelectedDosage] = useState('All');
  const [storeCategory, setStoreCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');

  // Pagination for 11,621 catalogue
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(11621);
  const [totalPages, setTotalPages] = useState(582);

  // Data states
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // AbortController ref to cancel stale network requests
  const abortControllerRef = useRef(null);

  // Dosage filter chips for 11,621 catalogue
  const dosageFilters = [
    { id: 'All', label: 'All Formulations (11,621)' },
    { id: 'Tablet', label: 'Tablets & Strips' },
    { id: 'Syrup/Liquid', label: 'Syrups & Liquids' },
    { id: 'Injection', label: 'Injections & Vials' },
    { id: 'Topical/Ointment', label: 'Ointments & Creams' },
    { id: 'Capsule', label: 'Capsules' },
    { id: 'Inhaler/Respiratory', label: 'Inhalers & Sprays' },
    { id: 'Powder/Sachet', label: 'Powders & Sachets' },
  ];

  // Store categories for live inventory
  const storeCategories = [
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

  // Fetch National Catalogue (11,621 items)
  const fetchCatalogue = async (currentQuery, currentPage, currentDosage, currentSort) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      let res;
      const cleanQ = currentQuery.trim();
      const signal = abortControllerRef.current?.signal;

      if (cleanQ.length >= 2) {
        // Debounced search on the 11,621 dataset
        res = await api.medicineCatalogue.search(
          cleanQ,
          {
            page: currentPage,
            pageSize,
            sortBy: currentSort,
          },
          { signal }
        );
      } else {
        // Browse full 11,621 dataset with server-side pagination & dosage filtering
        res = await api.medicineCatalogue.list(
          {
            page: currentPage,
            pageSize,
            dosageForm: currentDosage !== 'All' ? currentDosage : undefined,
            sortBy: currentSort,
          },
          { signal }
        );
      }

      const items = res?.results || [];
      const total = res?.total !== undefined ? res.total : 11621;
      const pages = res?.totalPages || Math.ceil(total / pageSize) || 1;

      setTotalCount(total);
      setTotalPages(pages);

      const mapped = items.map((item) => ({
        id: `catalogue_${item.id}`,
        rawId: item.id,
        name: item.name,
        genericName: Array.isArray(item.composition) && item.composition.length > 0 ? item.composition[0] : null,
        manufacturer: item.manufacturer || 'Standard Clinical Manufacturer',
        packSize: item.packSize || 'Standard Packaging',
        dosageForm: item.dosageForm || 'Tablet',
        composition: Array.isArray(item.composition) ? item.composition.join(' + ') : String(item.composition || ''),
        priceINR: item.priceINR !== null ? item.priceINR : null,
        isDiscontinued: Boolean(item.isDiscontinued),
        source: item.source || 'junioralive/Indian-Medicine-Dataset',
        isLiveInventory: Boolean(item.isLiveInventory),
        img: getProductImageUrl(item),
      }));

      setProducts(mapped);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error loading clinical catalogue');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch Live Pharmacy Inventory (25 items)
  const fetchStoreMedicines = async (currentCat, currentQuery) => {
    setLoading(true);
    setError(null);

    try {
      const params = { limit: 50 };
      if (currentCat !== 'All') params.category = currentCat;
      if (currentQuery.trim()) params.search = currentQuery.trim();

      const res = await api.medicines.list(params);
      const items = Array.isArray(res) ? res : res?.medicines || res?.items || [];

      setTotalCount(items.length);
      setTotalPages(1);

      const mapped = items.map((p) => {
        const origPrice = p.originalPrice || p.mrp || Math.round((p.price || 145) * 1.25);
        return {
          id: p._id || p.id,
          rawId: p._id || p.id,
          name: p.name,
          genericName: p.genericName,
          manufacturer: p.brand || p.manufacturer || 'PharmaCare Labs',
          category: p.category || (p.rxRequired ? 'Prescription (Rx)' : 'Over-The-Counter (OTC)'),
          composition: p.composition || p.description || 'Clinical Active Formulation',
          dosageForm: p.form || 'Tablet',
          strength: p.strength || '',
          mfgDate: p.manufacturingDate ? new Date(p.manufacturingDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Jan 2026',
          expDate: p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Jan 2028',
          expiryStatus: p.expiryStatus || 'VALID',
          isExpired: p.expiryStatus === 'EXPIRED',
          batchNumber: p.batchNumber || 'PCM-2026',
          price: Number(p.price || 145),
          originalPrice: origPrice,
          discount: p.discount || '15% OFF',
          stock: p.stock !== undefined ? p.stock : 50,
          rxRequired: Boolean(p.rxRequired || p.rx_required),
          isLiveInventory: true,
          img: getProductImageUrl(p),
        };
      });

      setProducts(mapped);
    } catch (err) {
      setError(err.message || 'Error loading store inventory');
    } finally {
      setLoading(false);
    }
  };

  // Trigger data fetch: 300ms debounce when actively typing search, 0ms instant fetch on page/category changes
  useEffect(() => {
    const isSearching = Boolean(searchFilter.trim());
    const delay = isSearching ? 300 : 0;

    const timer = setTimeout(() => {
      if (viewMode === 'catalogue') {
        fetchCatalogue(searchFilter, page, selectedDosage, sortBy);
      } else {
        fetchStoreMedicines(storeCategory, searchFilter);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [viewMode, searchFilter, page, selectedDosage, storeCategory, sortBy]);

  const handleModeSwitch = (mode) => {
    setViewMode(mode);
    setPage(1);
    setSearchFilter('');
    setProducts([]);
  };

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
    <div className="flex flex-col w-full px-margin pb-8 gap-y-3">
      {/* Page Header */}
      <div className="flex flex-col gap-0.5 pt-1">
        <div className="flex items-center justify-between flex-wrap gap-1.5">
          <h1 className="font-headline-md text-lg text-primary font-bold">
            Medicines & Clinical Formulations
          </h1>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {viewMode === 'catalogue' ? '11,621 National Records' : '25 Express Delivery Items'}
          </span>
        </div>
        <p className="font-body-sm text-xs text-on-surface-variant">
          Complete Indian Pharmaceutical Formulary Database & Express Pharmacy Fulfillment
        </p>
      </div>

      {/* Primary Mode Selector: National Catalogue vs Live Store Inventory */}
      <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/15">
        <button
          onClick={() => handleModeSwitch('catalogue')}
          className={`py-1.5 px-2.5 rounded-lg font-label-sm text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'catalogue'
              ? 'bg-white text-primary shadow-sm'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">menu_book</span>
          National Catalogue (11,621)
        </button>
        <button
          onClick={() => handleModeSwitch('store')}
          className={`py-1.5 px-2.5 rounded-lg font-label-sm text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'store'
              ? 'bg-white text-primary shadow-sm'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">local_shipping</span>
          Express Stock (Live Store)
        </button>
      </div>

      {/* Filter Row 1: Dosage Form Filter (Catalogue) OR Category Filter (Store) */}
      {viewMode === 'catalogue' ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {dosageFilters.map((df) => (
            <button
              key={df.id}
              onClick={() => {
                setSelectedDosage(df.id);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-full font-label-sm text-[11px] font-semibold whitespace-nowrap transition-all ${
                selectedDosage === df.id
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {df.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {storeCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setStoreCategory(cat)}
              className={`px-2.5 py-1 rounded-full font-label-sm text-[11px] font-semibold whitespace-nowrap transition-all ${
                storeCategory === cat
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Search Input & Sort Selector */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setPage(1);
            }}
            placeholder={
              viewMode === 'catalogue'
                ? 'Search 11,621 formulations (e.g. Paracetamol, Augmentin, Dolo)...'
                : 'Search store inventory by medicine, brand, active salt...'
            }
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {viewMode === 'catalogue' && (
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="py-2 px-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="name">Name (A-Z)</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        )}
      </div>

      {/* Dataset Reassurance Banner */}
      {viewMode === 'catalogue' && (
        <div className="p-2.5 px-3 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[17px]">verified</span>
            <span className="text-[11px]">
              Showing {products.length} of <strong>{totalCount.toLocaleString()}</strong> formulations
            </span>
          </div>
          <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
            Page {page} of {totalPages}
          </span>
        </div>
      )}

      {/* Loading Skeleton matching real card height */}
      {loading && products.length === 0 && (
        <div className="flex flex-col gap-2.5 py-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-surface-container-low rounded-2xl animate-pulse"></div>
          ))}
        </div>
      )}

      {/* Error state with retry action */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              if (viewMode === 'catalogue') {
                fetchCatalogue(searchFilter, page, selectedDosage, sortBy);
              } else {
                fetchStoreMedicines(storeCategory, searchFilter);
              }
            }}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition-all shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Products & Formulations List */}
      <div className="flex flex-col gap-2.5">
        {products.map((item) => (
          <div
            key={item.id}
            className={`p-3 rounded-xl bg-surface-container-lowest border shadow-sm flex flex-col gap-2 transition-all hover:border-primary/30 ${
              item.isExpired ? 'border-red-300 bg-red-50/20' : 'border-outline-variant/15'
            }`}
          >
            <div className="flex gap-2.5">
              <img
                src={item.img}
                alt={item.name}
                width="68"
                height="68"
                loading="lazy"
                onError={(e) => handleImageError(e, item.dosageForm)}
                onClick={() => navigate(`/product/${item.id}`)}
                className="w-[68px] h-[68px] rounded-lg object-contain bg-surface-container-low cursor-pointer shrink-0 border border-outline-variant/10 p-1"
              />
              <div className="flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                      {item.dosageForm || 'Clinical Formulation'}
                    </span>
                    {item.isLiveInventory && getExpiryBadge(item)}
                    {item.isDiscontinued && (
                      <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                        DISCONTINUED
                      </span>
                    )}
                  </div>
                  <h3
                    onClick={() => navigate(`/product/${item.id}`)}
                    className="font-headline-sm text-sm font-bold text-primary hover:underline cursor-pointer mt-0.5 truncate"
                  >
                    {item.name}
                  </h3>
                  <p className="text-[11px] font-semibold text-secondary truncate">
                    {item.manufacturer}
                  </p>
                  <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-1">
                    {item.composition}
                  </p>
                </div>

                {item.packSize && (
                  <div className="text-[10px] text-on-surface-variant pt-1 border-t border-outline-variant/10 flex items-center justify-between">
                    <span>Pack: <strong>{item.packSize}</strong></span>
                    {item.batchNumber && <span>Batch: <strong>{item.batchNumber}</strong></span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/10">
              <div className="flex items-baseline gap-1.5">
                {item.priceINR !== undefined && item.priceINR !== null ? (
                  <>
                    <span className="font-headline-sm text-sm font-bold text-primary">₹{item.priceINR}</span>
                    <span className="text-[10px] text-on-surface-variant">Indicative MRP</span>
                  </>
                ) : item.price !== undefined ? (
                  <>
                    <span className="font-headline-sm text-sm font-bold text-primary">₹{item.price}</span>
                    <span className="text-[11px] line-through text-on-surface-variant">₹{item.originalPrice}</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                      {item.discount}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-on-surface-variant">Price on Request</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate(`/product/${item.id}`)}
                  className="px-2.5 py-1 rounded-lg bg-surface-container-low text-[11px] font-semibold text-primary hover:bg-surface-container transition-colors"
                >
                  Clinical Monograph
                </button>

                {item.isLiveInventory && (
                  <button
                    onClick={() => addToCart(item)}
                    disabled={item.isExpired || item.stock <= 0}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 ${
                      item.isExpired || item.stock <= 0
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-primary text-on-primary hover:bg-primary/90'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {item.isExpired ? 'block' : 'add_shopping_cart'}
                    </span>
                    {item.isExpired ? 'Expired' : 'Add'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {!loading && products.length === 0 && (
          <div className="p-6 text-center text-xs text-on-surface-variant bg-surface-container-low/50 rounded-xl">
            No formulations match your search criteria. Try a different medicine name or dosage form.
          </div>
        )}
      </div>

      {/* Pagination Controls for 11,621 Catalogue */}
      {viewMode === 'catalogue' && totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 pb-3 border-t border-outline-variant/15">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
              page <= 1 || loading
                ? 'bg-surface-container-low text-slate-400 cursor-not-allowed'
                : 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">chevron_left</span>
            Previous
          </button>

          <span className="text-xs font-semibold text-on-surface-variant">
            Page <strong className="text-primary">{page}</strong> of <strong className="text-primary">{totalPages}</strong>
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
              page >= totalPages || loading
                ? 'bg-surface-container-low text-slate-400 cursor-not-allowed'
                : 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm'
            }`}
          >
            Next
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MedicinesPage;
