import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [location, setLocation] = useState('Indiranagar, 560038');
  const [aiState, setAiState] = useState('ready'); // ready, listening, thinking, speaking

  // Stored user or default state
  const storedUser = api.getUser();
  const hasToken = !!api.getAccessToken();

  const [user, setUser] = useState({
    name: storedUser?.name || storedUser?.full_name || 'Rahul',
    email: storedUser?.email || 'owner@pharmacare.ai',
    role: storedUser?.role || 'OWNER',
    businessName: storedUser?.businessName || storedUser?.business_name || 'PharmaCare Central',
    isLoggedIn: hasToken,
    avatar: storedUser?.avatar || 'https://lh3.googleusercontent.com/aida/AEtjO1UXIyqn0rViTj34nY5-ERNwCnA7Zwj8rGPIMHsg29hvs-twt6_AsDLdWcg9buDJTuJC142qVvPhhA65hX8te1Q20d7ykmZ16UYBm10zL3vVzdOm-CKDgKRO-sszyTtnTOK4Iz192j94dxxY5Ki9HoZV9D4RFUYCj-z37Kd6PAUuICxpSIMc1eqzbjv6hSg8G8Q2x4bXE7V_7DDyNDA48lK3-lYsqCJyvcQQF_FGoZ1Z-z0lkB3yGmMKbA1w',
  });

  const [cart, setCart] = useState([
    { id: 'm1', name: 'Amoxicillin Trihydrate 500mg', price: 145, qty: 1, type: 'Rx' },
    { id: 'h1', name: 'Optima Multivitamin AI Gold', price: 399, qty: 1, type: 'OTC' }
  ]);

  const [activeOrder, setActiveOrder] = useState({
    id: 'ORD-8942',
    orderNumber: 'ORD-8942',
    status: 'OUT_FOR_DELIVERY',
    etaMinutes: 18,
    riderName: 'Vikram Singh',
    riderPhone: '+91 98765 43210',
    totalAmount: 544,
    items: [
      { name: 'Amoxicillin Trihydrate 500mg', qty: 1, price: 145 },
      { name: 'Optima Multivitamin AI Gold', qty: 1, price: 399 }
    ]
  });

  const [alerts, setAlerts] = useState([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

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
    if (!api.getAccessToken()) return;
    try {
      const res = await api.cart.get();
      if (res && Array.isArray(res.items)) {
        setCart(res.items);
      }
    } catch {
      // Keep local cart
    }
  }, []);

  const loadActiveOrder = useCallback(async () => {
    try {
      const orders = await api.orders.list({ limit: 5 });
      if (Array.isArray(orders) && orders.length > 0) {
        const latest = orders[0];
        setActiveOrder({
          id: latest.id || latest.orderNumber || latest._id,
          orderNumber: latest.orderNumber,
          status: latest.status,
          etaMinutes: latest.etaMinutes || latest.eta_minutes || 18,
          riderName: latest.riderName || latest.rider_name || 'Vikram Singh',
          riderPhone: latest.riderPhone || latest.rider_phone || '+91 98765 43210',
          totalAmount: latest.total || latest.total_amount,
          items: latest.items || [],
        });
      }
    } catch {
      // Keep default
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Initial Hydration
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const hydrateSession = async () => {
      loadDashboardSummary();
      loadAlerts();

      if (api.getAccessToken()) {
        try {
          const profile = await api.auth.me();
          if (profile) {
            setUser((prev) => ({
              ...prev,
              name: profile.name || profile.full_name || prev.name,
              email: profile.email || prev.email,
              role: profile.role || prev.role,
              businessName: profile.businessName || profile.business_name || prev.businessName,
              isLoggedIn: true,
              avatar: profile.avatar || prev.avatar,
            }));
            await Promise.allSettled([
              loadCart(),
              loadActiveOrder(),
            ]);
          }
        } catch {
          // Token may be expired
        }
      }
    };

    hydrateSession();
  }, [loadAlerts, loadDashboardSummary, loadCart, loadActiveOrder]);

  // ---------------------------------------------------------------------------
  // Authentication Actions
  // ---------------------------------------------------------------------------
  const login = async (email, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.login({ email, password });
      const profile = res.user;
      setUser({
        name: profile.name || profile.full_name,
        email: profile.email,
        role: profile.role,
        businessName: profile.businessName || profile.business_name,
        isLoggedIn: true,
        avatar: profile.avatar,
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
      setUser({
        name: profile.name || profile.full_name,
        email: profile.email,
        role: profile.role,
        businessName: profile.businessName || profile.business_name,
        isLoggedIn: true,
        avatar: profile.avatar,
      });
      await Promise.allSettled([
        loadCart(),
        loadAlerts(),
        loadDashboardSummary(),
        loadActiveOrder(),
      ]);
      return { success: true };
    } catch (err) {
      const msg = err.message || 'Registration failed.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await api.auth.logout();
    setUser((prev) => ({ ...prev, isLoggedIn: false }));
  };

  const markAlertRead = async (alertId) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
    );
    setUnreadAlertsCount((prev) => Math.max(0, prev - 1));
  };

  // ---------------------------------------------------------------------------
  // Cart Actions & Checkout with Expiry Validation
  // ---------------------------------------------------------------------------
  const addToCart = async (product, qty = 1) => {
    // Check if medicine has expired locally as first layer
    if (product.expiryStatus === 'EXPIRED' || (product.expiryDate && new Date(product.expiryDate) < new Date())) {
      alert('This medicine has expired and cannot be purchased.');
      return { success: false, message: 'This medicine has expired and cannot be purchased.' };
    }

    const pId = product.id || product._id;
    const pType = product.productType || (product.rxRequired !== undefined || product.genericName ? 'Medicine' : 'HealthProduct');

    if (api.getAccessToken()) {
      try {
        const res = await api.cart.add({ productId: pId, productType: pType, qty });
        if (res?.items) {
          setCart(res.items);
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
      if (existing) {
        return prev.map((item) =>
          item.id === pId || item.productId === pId ? { ...item, qty: item.qty + qty } : item
        );
      }
      return [
        ...prev,
        {
          id: pId,
          productId: pId,
          name: product.name,
          price: product.price,
          qty,
          image: product.image || product.img,
          type: product.rxRequired ? 'Rx' : 'OTC',
          productType: pType,
        },
      ];
    });

    return { success: true };
  };

  const removeFromCart = async (id) => {
    if (api.getAccessToken()) {
      try {
        const res = await api.cart.remove(id);
        if (res?.items) setCart(res.items);
        return;
      } catch {
        // Fallback local
      }
    }
    setCart((prev) => prev.filter((item) => item.id !== id && item._id !== id));
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
        status: created.status || 'OUT_FOR_DELIVERY',
        etaMinutes: created.etaMinutes || created.eta_minutes || 18,
        riderName: created.riderName || created.rider_name || 'Vikram Singh',
        riderPhone: created.riderPhone || created.rider_phone || '+91 98765 43210',
        totalAmount: created.total || created.total_amount,
        items: created.items || [],
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
        addToCart,
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
