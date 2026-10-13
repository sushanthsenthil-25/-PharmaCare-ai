import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

export function OwnerDashboardPage({ initialTab = 'overview' }) {
  const navigate = useNavigate();
  const { user } = useApp();
  const userRole = (user?.role || '').toUpperCase();
  const isOwnerRole = userRole === 'OWNER' || userRole === 'PHARMACIST' || userRole === 'ADMIN';

  const defaultTab = initialTab || (typeof window !== 'undefined' && window.location.pathname.includes('inventory') ? 'inventory' : 'overview');
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Real DB Data
  const [stats, setStats] = useState({
    totalMedicines: 0,
    availableMedicines: 0,
    lowStockMedicines: 0,
    outOfStockMedicines: 0,
    expiredMedicines: 0,
    expiringSoonMedicines: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todaysOrders: 0,
  });
  const [pharmacy, setPharmacy] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [orders, setOrders] = useState([]);

  // Inventory Search, Filter & Sort State
  const [invSearch, setInvSearch] = useState('');
  const [invStockFilter, setInvStockFilter] = useState('ALL'); // ALL, IN_STOCK, LOW_STOCK, OUT_OF_STOCK
  const [invCategoryFilter, setInvCategoryFilter] = useState('ALL');
  const [invSortBy, setInvSortBy] = useState('DEFAULT'); // DEFAULT, NAME_ASC, STOCK_LOW, STOCK_HIGH, PRICE_LOW, PRICE_HIGH

  // Add / Edit Medicine Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);

  const initialFormState = {
    name: '',
    genericName: '',
    category: 'Pain & Fever',
    strength: '650 mg',
    form: 'Tablet',
    manufacturer: 'PharmaCare Laboratories',
    batchNumber: 'PC-2026-01',
    manufacturingDate: '2026-01-01',
    expiryDate: '2028-01-01',
    price: 30,
    discount: '0% OFF',
    stock: 100,
    rxRequired: false,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    description: '',
  };

  const [medForm, setMedForm] = useState(initialFormState);
  const [formError, setFormError] = useState(null);

  // Pharmacy Profile Form
  const [pharmaForm, setPharmaForm] = useState({
    businessName: '',
    phone: '',
    address: '',
    latitude: 12.9784,
    longitude: 77.6408,
    openingTime: '08:00 AM',
    closingTime: '11:00 PM',
    isOpen: true,
  });

  // Fetch Dashboard & Inventory Data
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.owner.getDashboard();
      if (res?.stats) setStats(res.stats);
      if (res?.pharmacy) {
        setPharmacy(res.pharmacy);
        setPharmaForm({
          businessName: res.pharmacy.businessName || '',
          phone: res.pharmacy.phone || '',
          address: res.pharmacy.address || '',
          latitude: res.pharmacy.latitude || 12.9784,
          longitude: res.pharmacy.longitude || 77.6408,
          openingTime: res.pharmacy.openingTime || '08:00 AM',
          closingTime: res.pharmacy.closingTime || '11:00 PM',
          isOpen: res.pharmacy.isOpen !== false,
        });
      }

      const meds = await api.owner.getMedicines();
      if (Array.isArray(meds)) setMedicines(meds);

      const ords = await api.owner.getOrders();
      if (Array.isArray(ords)) setOrders(ords);
    } catch (err) {
      console.error('[Owner Dashboard Error]:', err);
      setError(err.message || 'Failed to load owner dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwnerRole) {
      fetchDashboardData();
    }
  }, [isOwnerRole]);

  // Quick Stock Adjustment (+ / -)
  const handleStockChange = async (medId, delta) => {
    try {
      const target = medicines.find((m) => m._id === medId || m.id === medId);
      if (!target) return;
      const newStock = Math.max(0, target.stock + delta);

      // Optimistic update
      setMedicines((prev) =>
        prev.map((m) => (m._id === medId || m.id === medId ? { ...m, stock: newStock } : m))
      );

      await api.owner.updateStock(medId, { delta });
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to update stock:', err);
      fetchDashboardData(); // Revert on failure
    }
  };

  // Submit Add / Edit Medicine
  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!medForm.name.trim()) return setFormError('Medicine Name is required.');
    if (!medForm.genericName.trim()) return setFormError('Generic Name is required.');
    if (!medForm.category.trim()) return setFormError('Category is required.');
    if (!medForm.batchNumber.trim()) return setFormError('Batch Number is required.');
    if (Number(medForm.price) < 0 || isNaN(medForm.price)) return setFormError('Price cannot be negative.');
    if (Number(medForm.stock) < 0 || isNaN(medForm.stock)) return setFormError('Stock cannot be negative.');
    if (!medForm.expiryDate) return setFormError('Valid expiry date is required.');

    try {
      if (editingMedicine) {
        await api.owner.updateMedicine(editingMedicine._id || editingMedicine.id, medForm);
        setSuccessMsg('Medicine updated successfully!');
      } else {
        await api.owner.addMedicine(medForm);
        setSuccessMsg('New medicine added to inventory!');
      }

      setIsAddModalOpen(false);
      setEditingMedicine(null);
      setMedForm(initialFormState);
      fetchDashboardData();

      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setFormError(err.message || 'Failed to save medicine');
    }
  };

  // Handle Edit Click
  const handleOpenEdit = (med) => {
    setEditingMedicine(med);
    setMedForm({
      name: med.name || '',
      genericName: med.genericName || '',
      category: med.category || 'Pain & Fever',
      strength: med.strength || '650 mg',
      form: med.form || 'Tablet',
      manufacturer: med.manufacturer || 'PharmaCare Laboratories',
      batchNumber: med.batchNumber || 'PC-2026-01',
      manufacturingDate: med.manufacturingDate ? med.manufacturingDate.slice(0, 10) : '2026-01-01',
      expiryDate: med.expiryDate ? med.expiryDate.slice(0, 10) : '2028-01-01',
      price: med.price || 30,
      discount: med.discount || '0% OFF',
      stock: med.stock !== undefined ? med.stock : 100,
      rxRequired: Boolean(med.rxRequired),
      image: med.image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
      description: med.description || '',
    });
    setIsAddModalOpen(true);
  };

  // Delete Medicine
  const handleDeleteMedicine = async (medId) => {
    if (!window.confirm('Are you sure you want to remove this medicine from inventory?')) return;
    try {
      await api.owner.deleteMedicine(medId);
      setSuccessMsg('Medicine deleted successfully');
      fetchDashboardData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete medicine');
    }
  };

  // Update Order Status
  const handleOrderStatusUpdate = async (orderId, newStatus) => {
    try {
      await api.owner.updateOrderStatus(orderId, newStatus);
      setSuccessMsg(`Order ${orderId} updated to ${newStatus}`);
      fetchDashboardData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update order status');
    }
  };

  // Save Pharmacy Profile & Map Coordinates
  const handleSavePharmacy = async (e) => {
    e.preventDefault();
    try {
      await api.owner.updatePharmacyProfile(pharmaForm);
      setSuccessMsg('Pharmacy details and map coordinates updated!');
      fetchDashboardData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update pharmacy profile');
    }
  };

  if (!isOwnerRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
        <span className="material-symbols-outlined text-5xl text-rose-500 mb-3">lock</span>
        <h2 className="text-base font-bold text-on-surface mb-1">Access Denied</h2>
        <p className="text-xs text-on-surface-variant mb-4 max-w-xs">
          The Owner Dashboard is restricted to verified Pharmacy Owners. Your current role is '{user?.role || 'USER'}'.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md hover:opacity-90 transition-all"
        >
          Return to User Dashboard
        </button>
      </div>
    );
  }

  // Filtered and Sorted Inventory Records
  const filteredMedicines = medicines
    .filter((med) => {
      if (invSearch.trim()) {
        const q = invSearch.toLowerCase().trim();
        const matchesName = med.name?.toLowerCase().includes(q);
        const matchesGeneric = med.genericName?.toLowerCase().includes(q);
        const matchesCategory = med.category?.toLowerCase().includes(q);
        const matchesBatch = med.batchNumber?.toLowerCase().includes(q);
        if (!matchesName && !matchesGeneric && !matchesCategory && !matchesBatch) return false;
      }
      if (invStockFilter === 'IN_STOCK' && med.stock <= 10) return false;
      if (invStockFilter === 'LOW_STOCK' && (med.stock === 0 || med.stock > 10)) return false;
      if (invStockFilter === 'OUT_OF_STOCK' && med.stock !== 0) return false;
      if (invCategoryFilter !== 'ALL' && med.category !== invCategoryFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (invSortBy === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '');
      if (invSortBy === 'STOCK_LOW') return a.stock - b.stock;
      if (invSortBy === 'STOCK_HIGH') return b.stock - a.stock;
      if (invSortBy === 'PRICE_LOW') return a.price - b.price;
      if (invSortBy === 'PRICE_HIGH') return b.price - a.price;
      return 0;
    });

  const availableCategories = ['ALL', ...Array.from(new Set(medicines.map((m) => m.category).filter(Boolean)))];

  const inStockCount = medicines.filter((m) => m.stock > 10).length;
  const lowStockCount = medicines.filter((m) => m.stock > 0 && m.stock <= 10).length;
  const outOfStockCount = medicines.filter((m) => m.stock === 0).length;

  return (
    <div className="flex flex-col gap-4 px-4 py-2 pb-12 w-full">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-1 bg-gradient-to-r from-amber-600/20 via-primary/15 to-emerald-600/10 p-3.5 rounded-2xl border border-amber-500/20 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-2xl">local_pharmacy</span>
            <div>
              <h1 className="font-bold text-base text-on-surface">Pharmacy Owner Dashboard</h1>
              <p className="text-[11px] text-on-surface-variant font-medium">
                {pharmacy?.businessName || 'PharmaCare Central Pharmacy'} • Indiranagar
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[10px] tracking-wider uppercase">
            👑 OWNER VERIFIED
          </span>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container-low border border-outline-variant/20 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: 'dashboard' },
          { id: 'inventory', label: `Inventory (${medicines.length})`, icon: 'inventory_2' },
          { id: 'orders', label: `Orders (${orders.length})`, icon: 'shopping_bag' },
          { id: 'pharmacy', label: 'Pharmacy Map & Info', icon: 'store' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/15'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading && medicines.length === 0 && orders.length === 0 && (
        <div className="flex items-center justify-center p-8 text-xs text-on-surface-variant gap-2">
          <span className="material-symbols-outlined animate-spin text-primary text-base">progress_activity</span>
          <span>Loading verified pharmacy statistics...</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW STATS */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-3">
          {/* Action Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xs text-on-surface">Real-Time Pharmacy Metrics</h2>
            <button
              type="button"
              onClick={() => {
                setEditingMedicine(null);
                setMedForm(initialFormState);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Medicine
            </button>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Inventory</span>
              <span className="text-xl font-extrabold text-primary">{stats.totalMedicines}</span>
              <span className="text-[10px] font-medium text-emerald-600">{stats.availableMedicines} Available & Active</span>
            </div>

            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-sm">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Low Stock (≤10)</span>
              <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{stats.lowStockMedicines}</span>
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Requires Reorder</span>
            </div>

            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-sm">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Out of Stock (0)</span>
              <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{stats.outOfStockMedicines}</span>
              <span className="text-[10px] font-medium text-rose-700 dark:text-rose-300">Unavailable for Customer</span>
            </div>

            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 shadow-sm">
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Total Orders</span>
              <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400">{stats.totalOrders}</span>
              <span className="text-[10px] font-medium text-purple-700 dark:text-purple-300">{stats.todaysOrders} Placed Today</span>
            </div>
          </div>

          {/* Low Stock Alerts Section */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-lg">warning</span>
                <h3 className="font-bold text-xs text-on-surface">Low Stock Alerts</h3>
              </div>
              <span className="text-[10px] font-bold text-amber-600">Threshold: 10 units</span>
            </div>

            {medicines.filter((m) => m.stock > 0 && m.stock <= 10).length === 0 ? (
              <p className="text-xs text-on-surface-variant py-2 font-medium">All medicines have adequate stock levels.</p>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                {medicines
                  .filter((m) => m.stock > 0 && m.stock <= 10)
                  .map((med) => (
                    <div
                      key={med._id || med.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <img src={med.image} alt={med.name} className="w-7 h-7 rounded object-cover" />
                        <div>
                          <span className="font-bold text-on-surface">{med.name}</span>
                          <p className="text-[10px] text-on-surface-variant">{med.strength} • ₹{med.price}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-600">{med.stock} units left</span>
                        <button
                          type="button"
                          onClick={() => handleStockChange(med._id || med.id, 20)}
                          className="px-2 py-1 rounded bg-amber-500 text-white font-bold text-[10px] hover:bg-amber-600 transition-all"
                        >
                          + Restock 20
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MEDICINE INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-on-surface">Medicine Inventory ({medicines.length})</h2>
            <button
              type="button"
              onClick={() => {
                setEditingMedicine(null);
                setMedForm(initialFormState);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Medicine
            </button>
          </div>

          {medicines.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-1">inventory_2</span>
              <h3 className="font-bold text-sm text-on-surface">No Medicines in Inventory</h3>
              <p className="text-xs text-on-surface-variant font-medium max-w-xs">
                You have not stocked any medicines yet. Add medications to make them available for patients and express deliveries.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingMedicine(null);
                  setMedForm(initialFormState);
                  setIsAddModalOpen(true);
                }}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Medicine
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Search, Filter & Sort Controls */}
              <div className="flex flex-col gap-2.5 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs">
                <div className="relative flex items-center">
                  <span className="absolute left-3 material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    placeholder="Search inventory by name, generic, batch or category..."
                    className="w-full pl-9 pr-9 py-2 rounded-xl bg-surface-container-low border border-outline-variant/25 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
                  />
                  {invSearch && (
                    <button onClick={() => setInvSearch('')} className="absolute right-3 text-on-surface-variant hover:text-on-surface">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>

                {/* Quick Status Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setInvStockFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all ${
                      invStockFilter === 'ALL'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    All ({medicines.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvStockFilter('IN_STOCK')}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all ${
                      invStockFilter === 'IN_STOCK'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    In Stock ({inStockCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvStockFilter('LOW_STOCK')}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all ${
                      invStockFilter === 'LOW_STOCK'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    Low Stock ({lowStockCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvStockFilter('OUT_OF_STOCK')}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all ${
                      invStockFilter === 'OUT_OF_STOCK'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    Out of Stock ({outOfStockCount})
                  </button>
                </div>

                {/* Category Filter & Sorting Dropdowns */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-outline-variant/10">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Category</label>
                    <select
                      value={invCategoryFilter}
                      onChange={(e) => setInvCategoryFilter(e.target.value)}
                      className="p-1.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                    >
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat === 'ALL' ? 'All Categories' : cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Sort By</label>
                    <select
                      value={invSortBy}
                      onChange={(e) => setInvSortBy(e.target.value)}
                      className="p-1.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="DEFAULT">Latest Added</option>
                      <option value="NAME_ASC">Name (A–Z)</option>
                      <option value="STOCK_LOW">Stock (Low to High)</option>
                      <option value="STOCK_HIGH">Stock (High to Low)</option>
                      <option value="PRICE_LOW">Price (Low to High)</option>
                      <option value="PRICE_HIGH">Price (High to Low)</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredMedicines.length === 0 ? (
                <div className="p-6 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col items-center gap-2 shadow-xs">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-1">filter_alt_off</span>
                  <p className="font-bold text-xs text-on-surface">No medicines match your current filter</p>
                  <button
                    type="button"
                    onClick={() => {
                      setInvSearch('');
                      setInvStockFilter('ALL');
                      setInvCategoryFilter('ALL');
                      setInvSortBy('DEFAULT');
                    }}
                    className="mt-1 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-all"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                filteredMedicines.map((med) => (
                  <div
                    key={med._id || med.id}
                  className="flex flex-col gap-2 p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={med.image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'}
                        alt={med.name}
                        className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20 flex-shrink-0"
                      />
                      <div>
                        <h4 className="font-bold text-xs text-on-surface">{med.name}</h4>
                        <p className="text-[11px] text-on-surface-variant">{med.genericName} • {med.strength}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-bold text-xs text-primary">₹{med.price}</span>
                          <span className="text-[10px] text-on-surface-variant">Batch: {med.batchNumber || 'PC-2026'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          med.stock === 0
                            ? 'bg-rose-500/15 text-rose-600'
                            : med.stock <= 10
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {med.stock === 0 ? 'OUT OF STOCK' : med.stock <= 10 ? `LOW STOCK (${med.stock})` : `IN STOCK (${med.stock})`}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        Exp: {med.expiryDate ? med.expiryDate.slice(0, 10) : '2028-01-01'}
                      </span>
                    </div>
                  </div>

                  {/* Controls Bar: Quick Stock Adjust & Edit Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15 mt-1 text-xs">
                    {/* Stock Adjuster */}
                    <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-lg border border-outline-variant/20">
                      <span className="text-[10px] font-bold text-on-surface-variant">Stock:</span>
                      <button
                        type="button"
                        onClick={() => handleStockChange(med._id || med.id, -1)}
                        className="w-5 h-5 rounded bg-surface border border-outline-variant/30 flex items-center justify-center font-bold hover:bg-primary/20 text-on-surface"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs text-on-surface px-1">{med.stock}</span>
                      <button
                        type="button"
                        onClick={() => handleStockChange(med._id || med.id, 1)}
                        className="w-5 h-5 rounded bg-surface border border-outline-variant/30 flex items-center justify-center font-bold hover:bg-primary/20 text-on-surface"
                      >
                        +
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(med)}
                        className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold text-[11px] hover:bg-primary/20 transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMedicine(med._id || med.id)}
                        className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-bold text-[11px] hover:bg-rose-500/20 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ORDER MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-sm text-on-surface">Customer Orders ({orders.length})</h2>

          {orders.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">shopping_bag</span>
              <p className="text-xs text-on-surface-variant font-medium">No customer orders placed yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((order) => (
                <div
                  key={order._id || order.id || order.orderNumber}
                  className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm text-xs"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
                    <div>
                      <span className="font-extrabold text-primary">{order.orderNumber || order.id || 'ORD-8942'}</span>
                      <p className="text-[10px] text-on-surface-variant">Customer: {order.customerName || order.user?.name || 'Rahul'}</p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 font-bold text-[10px]">
                      STATUS: {order.status}
                    </span>
                  </div>

                  {/* Order Items */}
                  <div className="flex flex-col gap-1">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-on-surface font-medium">
                        <span>{item.qty}x {item.name || item.title}</span>
                        <span className="font-bold">₹{(item.price || 30) * (item.qty || 1)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Status Progression Controls */}
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/15 mt-1">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Update Order Status:</span>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {['CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleOrderStatusUpdate(order._id || order.id, st)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            order.status === st
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'bg-surface-container-low text-on-surface-variant hover:bg-primary/20'
                          }`}
                        >
                          {st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PHARMACY PROFILE & LOCATION */}
      {activeTab === 'pharmacy' && (
        <form onSubmit={handleSavePharmacy} className="flex flex-col gap-4 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-sm text-xs">
          <h2 className="font-bold text-sm text-on-surface">Pharmacy Info & Map Location</h2>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-primary">Business Name</label>
            <input
              type="text"
              value={pharmaForm.businessName}
              onChange={(e) => setPharmaForm({ ...pharmaForm, businessName: e.target.value })}
              className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface font-medium focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-primary">Phone Number</label>
            <input
              type="text"
              value={pharmaForm.phone}
              onChange={(e) => setPharmaForm({ ...pharmaForm, phone: e.target.value })}
              className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface font-medium focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-primary">Address</label>
            <input
              type="text"
              value={pharmaForm.address}
              onChange={(e) => setPharmaForm({ ...pharmaForm, address: e.target.value })}
              className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface font-medium focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary">Latitude</label>
              <input
                type="number"
                step="any"
                value={pharmaForm.latitude}
                onChange={(e) => setPharmaForm({ ...pharmaForm, latitude: parseFloat(e.target.value) })}
                className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface font-medium focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary">Longitude</label>
              <input
                type="number"
                step="any"
                value={pharmaForm.longitude}
                onChange={(e) => setPharmaForm({ ...pharmaForm, longitude: parseFloat(e.target.value) })}
                className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface font-medium focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-all shadow-md mt-2"
          >
            Save Pharmacy Location & Profile
          </button>
        </form>
      )}

      {/* ADD / EDIT MEDICINE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface p-5 rounded-3xl border border-outline-variant/30 shadow-2xl flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <h3 className="font-bold text-base text-on-surface">
                {editingMedicine ? 'Edit Medicine Record' : 'Add New Medicine to MongoDB'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveMedicine} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-primary">Medicine Name *</label>
                <input
                  type="text"
                  value={medForm.name}
                  onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                  placeholder="e.g. Paracetamol 650"
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-primary">Generic Name *</label>
                <input
                  type="text"
                  value={medForm.genericName}
                  onChange={(e) => setMedForm({ ...medForm, genericName: e.target.value })}
                  placeholder="e.g. Paracetamol"
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-primary">Category *</label>
                  <select
                    value={medForm.category}
                    onChange={(e) => setMedForm({ ...medForm, category: e.target.value })}
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="Pain & Fever">Pain & Fever</option>
                    <option value="Allergy">Allergy</option>
                    <option value="Gastric/Acidity">Gastric/Acidity</option>
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Blood Pressure">Blood Pressure</option>
                    <option value="Diabetes">Diabetes</option>
                    <option value="Supplement">Supplement</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-primary">Strength</label>
                  <input
                    type="text"
                    value={medForm.strength}
                    onChange={(e) => setMedForm({ ...medForm, strength: e.target.value })}
                    placeholder="e.g. 650 mg"
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-primary">Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={medForm.price}
                    onChange={(e) => setMedForm({ ...medForm, price: parseFloat(e.target.value) })}
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-primary">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={medForm.stock}
                    onChange={(e) => setMedForm({ ...medForm, stock: parseInt(e.target.value, 10) })}
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-primary">Batch Number *</label>
                  <input
                    type="text"
                    value={medForm.batchNumber}
                    onChange={(e) => setMedForm({ ...medForm, batchNumber: e.target.value })}
                    placeholder="PC-2026-01"
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-primary">Expiry Date *</label>
                  <input
                    type="date"
                    value={medForm.expiryDate}
                    onChange={(e) => setMedForm({ ...medForm, expiryDate: e.target.value })}
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-primary">Medicine Image URL</label>
                <input
                  type="text"
                  value={medForm.image}
                  onChange={(e) => setMedForm({ ...medForm, image: e.target.value })}
                  placeholder="https://..."
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rxReq"
                  checked={medForm.rxRequired}
                  onChange={(e) => setMedForm({ ...medForm, rxRequired: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="rxReq" className="font-semibold text-on-surface">Prescription Required (Rx)</label>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/20 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-bold hover:bg-surface-container-highest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-all shadow-md"
                >
                  {editingMedicine ? 'Update Record' : 'Save to MongoDB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerDashboardPage;
