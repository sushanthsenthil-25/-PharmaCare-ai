import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getProductImageUrl, handleImageError } from '../utils/productImages';

export const MedicinesPage = () => {
  const navigate = useNavigate();

  // Search & filters for unified 11,621 Medicine catalogue
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDosage, setSelectedDosage] = useState('All');
  const [sortBy, setSortBy] = useState('name');

  // Server-side pagination
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

  // Dosage filter chips
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

  // Fetch unified Medicine Catalogue (11,621 items)
  const fetchMedicines = async (currentQuery, currentPage, currentDosage, currentSort) => {
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
        manufacturer: item.manufacturer || 'Standard Pharmaceutical Laboratories',
        packSize: item.packSize || 'Standard Packaging',
        dosageForm: item.dosageForm || 'Tablet',
        composition: Array.isArray(item.composition) ? item.composition.join(' + ') : String(item.composition || ''),
        priceINR: item.priceINR !== null ? item.priceINR : null,
        isDiscontinued: Boolean(item.isDiscontinued),
        source: item.source || 'junioralive/Indian-Medicine-Dataset',
        isLiveInventory: Boolean(item.isLiveInventory),
        availabilityStatus: item.availabilityStatus || (item.isLiveInventory ? 'IN_STOCK' : 'UNVERIFIED'),
        stock: item.stock !== undefined ? item.stock : null,
        liveMedicineId: item.liveMedicineId || null,
        pharmacyCount: item.pharmacyCount || 0,
        img: getProductImageUrl(item),
      }));

      setProducts(mapped);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error loading medicine formulary');
      }
    } finally {
      setLoading(false);
    }
  };

  // Debounced search & filter effect
  useEffect(() => {
    const isSearching = Boolean(searchFilter.trim());
    const delay = isSearching ? 300 : 0;

    const timer = setTimeout(() => {
      fetchMedicines(searchFilter, page, selectedDosage, sortBy);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchFilter, page, selectedDosage, sortBy]);

  return (
    <div className="flex flex-col w-full px-margin pb-8 gap-y-3">
      {/* Page Header */}
      <div className="flex flex-col gap-0.5 pt-1">
        <div className="flex items-center justify-between flex-wrap gap-1.5">
          <h1 className="font-headline-md text-lg text-primary font-bold">
            Medicine
          </h1>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {totalCount.toLocaleString()} Formulations
          </span>
        </div>
        <p className="font-body-sm text-xs text-on-surface-variant">
          Complete National Medicine Catalogue & Verified Nearby Pharmacy Inventory
        </p>
      </div>

      {/* Filter Row: Dosage Form Filter Chips */}
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

      {/* Search Input & Sort Selector */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Search 11,621 medicines, generic salts, or manufacturers..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

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
      </div>

      {/* Catalogue Info Banner */}
      <div className="p-2.5 px-3 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-center justify-between text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-[17px]">verified</span>
          <span className="text-[11px]">
            Showing {products.length} of <strong>{totalCount.toLocaleString()}</strong> formulations
          </span>
        </div>
        <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
          Formulary Database
        </span>
      </div>

      {/* Skeleton Loading State */}
      {loading && products.length === 0 && (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-surface-container-low rounded-xl animate-pulse"></div>
          ))}
        </div>
      )}

      {/* Error State Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchMedicines(searchFilter, page, selectedDosage, sortBy)}
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
              item.isDiscontinued ? 'border-red-200 bg-red-50/10' : 'border-outline-variant/15'
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
                    {item.isDiscontinued ? (
                      <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                        DISCONTINUED
                      </span>
                    ) : item.availabilityStatus === 'IN_STOCK' ? (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        IN STOCK ({item.stock !== null ? `${item.stock} UNITS` : 'VERIFIED'})
                      </span>
                    ) : item.availabilityStatus === 'OUT_OF_STOCK' ? (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded">
                        OUT OF STOCK
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded">
                        CATALOGUE (UNVERIFIED)
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
                    <span>
                      Packaging: <strong>{item.packSize}</strong>
                    </span>
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
                ) : (
                  <span className="text-xs font-semibold text-on-surface-variant">Price on Request</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {item.availabilityStatus === 'IN_STOCK' ? (
                  <button
                    onClick={() => navigate(`/product/${item.id}`)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[14px]">local_pharmacy</span>
                    View & Order
                  </button>
                ) : item.availabilityStatus === 'OUT_OF_STOCK' ? (
                  <button
                    onClick={() => navigate(`/product/${item.id}`)}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold hover:bg-amber-200 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Out of Stock
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/product/${item.id}`)}
                    className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                    Check Nearby Stock
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
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
