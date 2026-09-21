import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida/AEtjO1UXIyqn0rViTj34nY5-ERNwCnA7Zwj8rGPIMHsg29hvs-twt6_AsDLdWcg9buDJTuJC142qVvPhhA65hX8te1Q20d7ykmZ16UYBm10zL3vVzdOm-CKDgKRO-sszyTtnTOK4Iz192j94dxxY5Ki9HoZV9D4RFUYCj-z37Kd6PAUuICxpSIMc1eqzbjv6hSg8G8Q2x4bXE7V_7DDyNDA48lK3-lYsqCJyvcQQF_FGoZ1Z-z0lkB3yGmMKbA1w';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [location, setLocation] = useState('Indiranagar, 560038');
  const [aiState, setAiState] = useState('ready'); // ready, listening, thinking, speaking

  // Stored user or default state
  const storedUser = api.getUser();
  const hasToken = !!api.getAccessToken();

  const [user, setUser] = useState({
    id: storedUser?.id || storedUser?._id || 'usr_default',
    _id: storedUser?._id || storedUser?.id || 'usr_default',
    name: storedUser?.name || storedUser?.full_name || 'Rahul',
    email: storedUser?.email || 'owner@pharmacare.ai',
    role: storedUser?.role || 'OWNER',
    businessName: storedUser?.businessName || storedUser?.business_name || 'PharmaCare Central',
    isLoggedIn: hasToken,
    avatar: storedUser?.profilePhoto || storedUser?.avatar || DEFAULT_AVATAR,
    profilePhoto: storedUser?.profilePhoto || storedUser?.avatar || DEFAULT_AVATAR,
  });

  const [cart, setCart] = useState([
    { id: 'm1', name: 'Amoxicillin Trihydrate 500mg', price: 145, qty: 1, type: 'Rx' },
    { id: 'h1', name: 'Optima Multivitamin AI Gold', price: 399, qty: 1, type: 'OTC' }
  ]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartSummary, setCartSummary] = useState(null);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const [activeOrder, setActiveOrder] = useState({
    id: 'ORD-8942',
    orderNumber: 'ORD-8942',
    status: 'CONFIRMED',
    estimatedDeliveryText: 'Today, 30–45 mins',
    currentLocation: 'Live driver location will appear when available.',
    etaMinutes: 30,
    riderName: 'Vikram Singh',
    riderPhone: '+91 98765 43210',
    totalAmount: 544,
    subtotal: 544,
    deliveryFee: 0,
    discount: 0,
    items: [
      { name: 'Amoxicillin Trihydrate 500mg', qty: 1, price: 145 },
      { name: 'Optima Multivitamin AI Gold', qty: 1, price: 399 }
    ],
    trackingEvents: []
  });

  const [alerts, setAlerts] = useState([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [backendHealth, setBackendHealth] = useState({
    connected: true,
    status: 'checking',
    message: 'Checking connectivity...',
    environment: 'production',
    errorType: null,
    isChecking: true,
  });

  // ---------------------------------------------------------------------------
  // Check Backend Health & Status
  // ---------------------------------------------------------------------------
  const checkBackendHealth = useCallback(async () => {
    setBackendHealth((prev) => ({ ...prev, isChecking: true }));
    try {
      const res = await api.health.check();
      setBackendHealth({
        connected: res.connected,
        status: res.status,
        message: res.message,
        environment: res.environment || 'production',
        errorType: res.errorType || null,
        isChecking: false,
      });
      return res;
    } catch (err) {
      setBackendHealth({
        connected: false,
        status: 'offline',
        message: err.message || 'Backend unavailable',
        environment: 'production',
        errorType: 'BACKEND_OFFLINE',
        isChecking: false,
      });
      return { connected: false };
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Sync Cart Calculations with Backend Authoritative Calculation Engine
  // ---------------------------------------------------------------------------
  const syncCartCalculations = useCallback(async (currentItems) => {
    try {
      const calc = await api.cart.calculate(currentItems);
      if (calc) {
        setCartSummary(calc);
      }
    } catch {
      const subtotal = currentItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
      const deliveryFee = subtotal >= 100 ? 0 : 30;
      setCartSummary({
        items: currentItems,
        itemCount: currentItems.reduce((sum, i) => sum + (Number(i.qty) || 1), 0),
        subtotal,
        deliveryFee,
        discount: 0,
        total: subtotal + deliveryFee,
        grandTotal: subtotal + deliveryFee,
        estimatedDeliveryText: 'Today, 30–45 mins',
      });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Load Alerts & Dashboard Summary
  // ---------------------------------------------------------------------------
  const loadAlerts = useCallback(async () => {
    try {
      const data = await api.alerts.list();
      if (Array.isArray(data)) {
        setAlerts(data);
        const unread = data.filter((a) => !a.is_read).length;
        setUnreadAlertsCount(unread);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  const loadDashboardSummary = useCallback(async () => {
    try {
      const data = await api.dashboard.getSummary();
      if (data) {
        setDashboardSummary(data);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  const loadCart = useCallback(async () => {
    if (!api.getAccessToken()) {
      syncCartCalculations(cart);
      return;
    }
    try {
      const res = await api.cart.get();
      if (res && Array.isArray(res.items)) {
        setCart(res.items);
        setCartSummary(res);
      }
    } catch {
      syncCartCalculations(cart);
    }
  }, [cart, syncCartCalculations]);

  const loadActiveOrder = useCallback(async () => {
    try {
      const orders = await api.orders.list({ limit: 5 });
      if (Array.isArray(orders) && orders.length > 0) {
        const latest = orders[0];
        setActiveOrder({
          id: latest.id || latest.orderNumber || latest._id,
          orderNumber: latest.orderNumber,
          status: latest.status || 'CONFIRMED',
          estimatedDeliveryAt: latest.estimatedDeliveryAt,
          estimatedDeliveryText: latest.estimatedDeliveryText || 'Today, 30–45 mins',
          currentLocation: latest.currentLocation || 'Live driver location will appear when available.',
          etaMinutes: latest.etaMinutes || latest.eta_minutes || 30,
          riderName: latest.riderName || latest.rider_name || 'Vikram Singh',
          riderPhone: latest.riderPhone || latest.rider_phone || '+91 98765 43210',
          totalAmount: latest.total || latest.total_amount,
          subtotal: latest.subtotal,
          deliveryFee: latest.deliveryFee,
          discount: latest.discount,
          items: latest.items || [],
          trackingEvents: latest.trackingEvents || [],
        });
      }
    } catch {
      // Keep default
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Initial Hydration & Health Check
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const hydrateSession = async () => {
      await checkBackendHealth();
      loadDashboardSummary();
      loadAlerts();

      if (api.getAccessToken()) {
        try {
          const profile = await api.auth.me();
          if (profile) {
            const photo = profile.profilePhoto || profile.avatar || DEFAULT_AVATAR;
            setUser((prev) => ({
              ...prev,
              id: profile.id || profile._id || prev.id,
              _id: profile._id || profile.id || prev._id,
              name: profile.name || profile.full_name || prev.name,
              email: profile.email || prev.email,
              role: profile.role || prev.role,
              businessName: profile.businessName || profile.business_name || prev.businessName,
              phone: profile.phone || prev.phone,
              address: profile.address || prev.address,
              isLoggedIn: true,
              avatar: photo,
              profilePhoto: photo,
            }));
            await Promise.allSettled([
              loadCart(),
              loadActiveOrder(),
            ]);
          }
        } catch {
          // Token expired or invalid
        }
      }
    };

    hydrateSession();
  }, [checkBackendHealth, loadAlerts, loadDashboardSummary, loadCart, loadActiveOrder]);

  // ---------------------------------------------------------------------------
  // Authentication Actions
  // ---------------------------------------------------------------------------
  const login = async (email, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.login({ email, password });
      const profile = res.user;
      const photo = profile.profilePhoto || profile.avatar || DEFAULT_AVATAR;
      setUser({
        id: profile.id || profile._id,
        _id: profile._id || profile.id,
        name: profile.name || profile.full_name,
        email: profile.email,
        role: profile.role,
        businessName: profile.businessName || profile.business_name,
        phone: profile.phone || '',
        address: profile.address || '',
        isLoggedIn: true,
        avatar: photo,
        profilePhoto: photo,
      });
      await Promise.allSettled([
        loadCart(),
        loadAlerts(),
        loadDashboardSummary(),
        loadActiveOrder(),
      ]);
      return { success: true };
    } catch (err) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async (regData) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.register(regData);
      const profile = res.user;
      const photo = profile.profilePhoto || profile.avatar || DEFAULT_AVATAR;
      setUser({
        id: profile.id || profile._id,
        _id: profile._id || profile.id,
        name: profile.name || profile.full_name,
        email: profile.email,
        role: profile.role,
        businessName: profile.businessName || profile.business_name,
        phone: profile.phone || '',
        address: profile.address || '',
        isLoggedIn: true,
        avatar: photo,
        profilePhoto: photo,
      });
      return { success: true };
    } catch (err) {
      const msg = err.message || 'Registration failed.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    api.auth.logout();
    setUser({
      id: 'usr_guest',
      _id: 'usr_guest',
      name: 'Guest User',
      email: '',
      role: 'USER',
      businessName: 'PharmaCare Central',
      isLoggedIn: false,
      avatar: DEFAULT_AVATAR,
      profilePhoto: DEFAULT_AVATAR,
    });
    setCart([]);
    setCartSummary(null);
  };

  const uploadProfilePhoto = async (dataUrl) => {
    try {
      const res = await api.auth.uploadPhoto(dataUrl);
      if (res && res.user) {
        const photo = res.user.profilePhoto || res.user.avatar;
        setUser((prev) => ({
          ...prev,
          avatar: photo,
          profilePhoto: photo,
        }));
      }
      return res;
    } catch (err) {
      throw err;
    }
  };

  const removeProfilePhoto = async () => {
    try {
      const res = await api.auth.removePhoto();
      if (res && res.user) {
        const photo = res.user.profilePhoto || res.user.avatar || DEFAULT_AVATAR;
        setUser((prev) => ({
          ...prev,
          avatar: photo,
          profilePhoto: photo,
        }));
      }
      return res;
    } catch (err) {
      throw err;
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await api.auth.updateProfile(profileData);
      if (res && res.user) {
        setUser((prev) => ({
          ...prev,
          name: res.user.name || prev.name,
          businessName: res.user.businessName || prev.businessName,
          phone: res.user.phone || prev.phone,
          address: res.user.address || prev.address,
        }));
      }
      return res;
    } catch (err) {
      throw err;
    }
  };

  const markAlertRead = async (alertId) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
    );
    setUnreadAlertsCount((prev) => Math.max(0, prev - 1));
  };

  // ---------------------------------------------------------------------------
  // Cart Actions & Authoritative Calculation
  // ---------------------------------------------------------------------------
  const addToCart = async (product, qty = 1) => {
    if (product.expiryStatus === 'EXPIRED' || (product.expiryDate && new Date(product.expiryDate) < new Date())) {
      alert('This medicine has expired and cannot be purchased.');
      return { success: false, message: 'This medicine has expired and cannot be purchased.' };
    }

    const pId = product.rawId || product._id || product.id;
    const pType = product.productType || (product.rxRequired !== undefined || product.genericName ? 'Medicine' : 'HealthProduct');

    if (api.getAccessToken()) {
      try {
        const res = await api.cart.add({ productId: pId, productType: pType, qty });
        if (res?.items) {
          setCart(res.items);
          setCartSummary(res);
        }
        return { success: true };
      } catch (err) {
        alert(err.message || 'Could not add to cart');
        return { success: false, error: err.message };
      }
    }

    // Local cart fallback
    setCart((prev) => {
      const existing = prev.find((item) => item.id === pId || item.productId === pId);
      let updated;
      if (existing) {
        updated = prev.map((item) =>
          item.id === pId || item.productId === pId ? { ...item, qty: item.qty + qty } : item
        );
      } else {
        updated = [
          ...prev,
          {
            id: pId,
            productId: pId,
            name: product.name,
            price: Number(product.price || 0),
            qty,
            image: product.image || product.img,
            type: product.rxRequired ? 'Rx' : 'OTC',
            productType: pType,
          },
        ];
      }
      syncCartCalculations(updated);
      return updated;
    });

    return { success: true };
  };

  const updateCartQty = async (itemId, newQty) => {
    const targetQty = Math.max(0, parseInt(newQty, 10));

    if (api.getAccessToken()) {
      try {
        if (targetQty === 0) {
          const res = await api.cart.remove(itemId);
          if (res?.items) {
            setCart(res.items);
            setCartSummary(res);
          }
        } else {
          const res = await api.cart.update(itemId, targetQty);
          if (res?.items) {
            setCart(res.items);
            setCartSummary(res);
          }
        }
        return;
      } catch {
        // Fall through to local
      }
    }

    setCart((prev) => {
      let updated;
      if (targetQty === 0) {
        updated = prev.filter((item) => item.id !== itemId && item._id !== itemId && item.productId !== itemId);
      } else {
        updated = prev.map((item) =>
          item.id === itemId || item._id === itemId || item.productId === itemId ? { ...item, qty: targetQty } : item
        );
      }
      syncCartCalculations(updated);
      return updated;
    });
  };

  const removeFromCart = async (id) => {
    if (api.getAccessToken()) {
      try {
        const res = await api.cart.remove(id);
        if (res?.items) {
          setCart(res.items);
          setCartSummary(res);
        }
        return;
      } catch {
        // Fallback local
      }
    }
    setCart((prev) => {
      const updated = prev.filter((item) => item.id !== id && item._id !== id && item.productId !== id);
      syncCartCalculations(updated);
      return updated;
    });
  };

  const clearCart = async () => {
    if (api.getAccessToken()) {
      try {
        await api.cart.clear();
      } catch {
        // Fallback local
      }
    }
    setCart([]);
    setCartSummary(null);
  };

  const checkoutOrder = async (orderPayload = {}) => {
    if (cart.length === 0) return null;

    try {
      const items = cart.map((item) => ({
        productId: item.productId || item.rawId || item.id || item._id,
        name: item.name,
        qty: item.qty,
        unit_price: Number(item.price),
        productType: item.productType || 'Medicine',
      }));

      const payload = {
        items,
        delivery_address: location,
        shippingAddress: location,
        paymentMethod: 'DEMO_EXPRESS_COD',
        ...orderPayload,
      };

      const res = await api.orders.create(payload);
      const created = res.order || res;

      setActiveOrder({
        id: created.id || created.orderNumber || created._id,
        orderNumber: created.orderNumber,
        status: created.status || 'CONFIRMED',
        estimatedDeliveryAt: created.estimatedDeliveryAt,
        estimatedDeliveryText: created.estimatedDeliveryText || 'Today, 30–45 mins',
        currentLocation: created.currentLocation || 'Live driver location will appear when available.',
        etaMinutes: created.etaMinutes || created.eta_minutes || 30,
        riderName: created.riderName || created.rider_name || 'Vikram Singh',
        riderPhone: created.riderPhone || created.rider_phone || '+91 98765 43210',
        totalAmount: created.total || created.total_amount,
        subtotal: created.subtotal,
        deliveryFee: created.deliveryFee,
        discount: created.discount,
        total: created.total,
        items: created.items || [],
        trackingEvents: created.trackingEvents || [],
      });

      clearCart();
      await loadDashboardSummary();
      return created;
    } catch (err) {
      throw err;
    }
  };

  return (
    <AppContext.Provider
      value={{
        location,
        setLocation,
        aiState,
        setAiState,
        cart,
        cartSummary,
        isCartOpen,
        openCart,
        closeCart,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        checkoutOrder,
        user,
        setUser,
        login,
        register,
        logout,
        authLoading,
        authError,
        setAuthError,
        uploadProfilePhoto,
        removeProfilePhoto,
        updateProfile,
        backendHealth,
        checkBackendHealth,
        activeOrder,
        setActiveOrder,
        loadActiveOrder,
        alerts,
        unreadAlertsCount,
        loadAlerts,
        markAlertRead,
        dashboardSummary,
        loadDashboardSummary,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
export default AppContext;
