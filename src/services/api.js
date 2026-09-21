/**
 * Centralized API Client for PharmaCare AI
 * Connects the React/Vite Stitch frontend to the Node.js / Express / MongoDB backend.
 * Handles JWT authentication, profile photos, product catalog, cart, orders, and Gemini AI interactions.
 */

// Production & Development API URL resolver
const getInitialApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }
  // If in browser production environment and no env var provided, use same-origin relative /api
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '/api';
  }
  // Local development fallback
  return 'http://localhost:5000';
};

const API_BASE_URL = getInitialApiUrl();

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // ---------------------------------------------------------------------------
  // Token & User Storage Helpers
  // ---------------------------------------------------------------------------
  getAccessToken() {
    return localStorage.getItem('pharmacare_access_token');
  }

  getRefreshToken() {
    return localStorage.getItem('pharmacare_refresh_token');
  }

  setTokens(accessToken, refreshToken) {
    if (accessToken) localStorage.setItem('pharmacare_access_token', accessToken);
    if (refreshToken) localStorage.setItem('pharmacare_refresh_token', refreshToken);
  }

  clearTokens() {
    localStorage.removeItem('pharmacare_access_token');
    localStorage.removeItem('pharmacare_refresh_token');
    localStorage.removeItem('pharmacare_user');
  }

  getUser() {
    const raw = localStorage.getItem('pharmacare_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setUser(user) {
    if (user) {
      localStorage.setItem('pharmacare_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('pharmacare_user');
    }
  }

  // ---------------------------------------------------------------------------
  // Clean URL Builder that prevents duplicate /api/api
  // ---------------------------------------------------------------------------
  buildUrl(endpoint) {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // If baseUrl already ends with /api and endpoint starts with /api/, avoid duplicate
    if (this.baseUrl.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
      return `${this.baseUrl}${cleanEndpoint.slice(4)}`;
    }

    // If baseUrl is empty or just '/api', handle cleanly
    if (this.baseUrl === '/api') {
      return cleanEndpoint.startsWith('/api') ? cleanEndpoint : `/api${cleanEndpoint}`;
    }

    return `${this.baseUrl}${cleanEndpoint}`;
  }

  // ---------------------------------------------------------------------------
  // Core HTTP Request Handler with Automatic Refresh & Error Handling
  // ---------------------------------------------------------------------------
  async request(endpoint, options = {}) {
    const url = this.buildUrl(endpoint);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getAccessToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 204) {
        return null;
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ||
          data?.message ||
          data?.detail?.[0]?.msg ||
          data?.detail ||
          `Request failed with status ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        error.code = data?.error?.code || data?.code || (response.status === 401 ? 'AUTH_ERROR' : 'API_ERROR');
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const netErr = new Error('Unable to connect to PharmaCare AI backend. Please verify your internet connection or backend server.');
        netErr.status = 0;
        netErr.code = 'BACKEND_OFFLINE';
        throw netErr;
      }
      throw err;
    }
  }

  async get(endpoint, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request(`${endpoint}${queryString}`, { method: 'GET' });
  }

  async post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ---------------------------------------------------------------------------
  // Domain API Modules
  // ---------------------------------------------------------------------------

  // 1. Health Check Module
  health = {
    check: async () => {
      try {
        const res = await this.get('/api/health');
        return {
          connected: true,
          status: 'online',
          message: res?.message || 'PharmaCare AI backend is running',
          environment: res?.environment || 'production',
          database: res?.database || 'connected',
          timestamp: res?.timestamp,
        };
      } catch (err) {
        return {
          connected: false,
          status: 'offline',
          errorType: err.code || 'BACKEND_OFFLINE',
          message: err.message || 'Backend unavailable',
        };
      }
    },
  };

  // 2. Authentication & User Profile
  auth = {
    login: async ({ email, password }) => {
      const res = await this.post('/api/auth/login', { email, password });
      this.setTokens(res.token || res.access_token);
      this.setUser(res.user);
      return res;
    },

    register: async (registrationData) => {
      const res = await this.post('/api/auth/register', registrationData);
      this.setTokens(res.token || res.access_token);
      this.setUser(res.user);
      return res;
    },

    me: async () => {
      const res = await this.get('/api/auth/me');
      if (res?.user) this.setUser(res.user);
      return res?.user || res;
    },

    updateProfile: async (profileData) => {
      const res = await this.patch('/api/auth/profile', profileData);
      if (res?.user) this.setUser(res.user);
      return res?.user || res;
    },

    uploadPhoto: async (photoData) => {
      const res = await this.post('/api/auth/profile/photo', { photo: photoData });
      if (res?.user) this.setUser(res.user);
      return res?.user || res;
    },

    removePhoto: async () => {
      const res = await this.delete('/api/auth/profile/photo');
      if (res?.user) this.setUser(res.user);
      return res?.user || res;
    },

    logout: async () => {
      this.clearTokens();
    },
  };

  // 3. Medicines Catalog
  medicines = {
    list: async (params = {}) => {
      const res = await this.get('/api/medicines', params);
      return res?.medicines || res?.items || res;
    },

    getById: async (id) => {
      const res = await this.get(`/api/medicines/${id}`);
      return res?.medicine || res;
    },

    search: async (q, limit = 20) => {
      const res = await this.get('/api/medicines/search', { q, limit });
      return res?.medicines || res?.items || res;
    },
  };

  // Compatibility alias for generic product listings
  products = {
    list: async (params = {}) => {
      const res = await this.get('/api/medicines', params);
      return res?.medicines || res?.items || res;
    },
    getById: async (productId) => {
      try {
        const res = await this.get(`/api/medicines/${productId}`);
        return res?.medicine || res;
      } catch {
        try {
          const res = await this.get(`/api/health-products/${productId}`);
          return res?.product || res;
        } catch {
          const res = await this.get(`/api/personal-care/${productId}`);
          return res?.product || res;
        }
      }
    },
  };

  // 4. Health Products
  healthProducts = {
    list: async (params = {}) => {
      const res = await this.get('/api/health-products', params);
      return res?.products || res?.items || res;
    },

    getById: async (id) => {
      const res = await this.get(`/api/health-products/${id}`);
      return res?.product || res;
    },
  };

  // 5. Personal Care Products
  personalCare = {
    list: async (params = {}) => {
      const res = await this.get('/api/personal-care', params);
      return res?.products || res?.items || res;
    },

    getById: async (id) => {
      const res = await this.get(`/api/personal-care/${id}`);
      return res?.product || res;
    },
  };

  // 6. Cart Management
  cart = {
    get: async () => {
      return this.get('/api/cart');
    },

    calculate: async (items = [], discountAmount = 0) => {
      return this.post('/api/cart/calculate', { items, discountAmount });
    },

    add: async ({ productId, productType = 'Medicine', qty = 1 }) => {
      return this.post('/api/cart', { productId, productType, qty });
    },

    update: async (itemId, qty) => {
      return this.patch(`/api/cart/${itemId}`, { qty });
    },

    remove: async (itemId) => {
      return this.delete(`/api/cart/${itemId}`);
    },

    clear: async () => {
      return this.delete('/api/cart');
    },
  };

  // 7. Orders & Live Tracking
  orders = {
    create: async (orderData) => {
      return this.post('/api/orders', orderData);
    },

    list: async (params = {}) => {
      const res = await this.get('/api/orders', params);
      return res?.orders || res;
    },

    getById: async (orderId) => {
      const res = await this.get(`/api/orders/${orderId}`);
      return res?.order || res;
    },

    getTracking: async (orderId) => {
      return this.get(`/api/orders/${orderId}/tracking`);
    },

    updateStatus: async (orderId, statusData) => {
      return this.patch(`/api/orders/${orderId}/status`, statusData);
    },
  };

  // 8. Live Alerts & Dashboard
  alerts = {
    list: async (params = {}) => {
      const res = await this.get('/api/alerts', params);
      return res?.alerts || res;
    },
    markRead: async (alertId) => {
      return { success: true };
    },
  };

  dashboard = {
    getSummary: async () => {
      return this.get('/api/dashboard/summary');
    },
  };

  // 9. Gemini AI Assistant & Voice Pipeline
  ai = {
    chat: async ({ message, history = [], context = null, conversationId }) => {
      return this.post('/api/ai/chat', { message, history, context, conversationId });
    },

    voice: async ({ command_text, history = [], context = null, conversationId, language_hint = 'auto' }) => {
      return this.post('/api/ai/voice', { command_text, history, context, conversationId, language_hint });
    },

    confirmVoice: async ({ command_id, confirmed }) => {
      return this.post('/api/ai/voice/confirm', { command_id, confirmed });
    },
  };
}

export const api = new ApiClient();
export default api;
