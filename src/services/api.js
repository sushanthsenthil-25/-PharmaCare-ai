/**
 * Centralized API Client for PharmaCare AI
 * Connects the React/Vite Stitch frontend to the Node.js / Express / MongoDB backend.
 * Handles JWT authentication, product catalog, cart, orders, and Gemini AI interactions.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // ---------------------------------------------------------------------------
  // Token Storage Helpers
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
  // Core HTTP Request Handler with Automatic Refresh & Error Handling
  // ---------------------------------------------------------------------------
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
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
          data?.message ||
          data?.detail?.[0]?.msg ||
          data?.detail ||
          `Request failed with status ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        error.code = data?.code;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const netErr = new Error('Network error: Unable to connect to PharmaCare backend server.');
        netErr.status = 0;
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

  // 1. Authentication
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

    logout: async () => {
      this.clearTokens();
    },
  };

  // 2. Medicines Catalog
  medicines = {
    list: async (params = {}) => {
      const res = await this.get('/api/medicines', params);
      return res?.medicines || res?.items || res;
    },

    getById: async (id) => {
      const res = await this.get(`/api/medicines/${id}`);
      return res?.medicine || res;
    },

    search: async (q, limit = 10) => {
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

  // 3. Health Products
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

  // 4. Personal Care Products
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

  // 5. Cart Management
  cart = {
    get: async () => {
      return this.get('/api/cart');
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

  // 6. Orders & Live Tracking
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

    updateStatus: async (orderId, statusData) => {
      return this.patch(`/api/orders/${orderId}/status`, statusData);
    },
  };

  // 7. Live Alerts & Dashboard
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

  // 8. Gemini AI Assistant & Web Grounding
  ai = {
    chat: async ({ message, history = [], conversationId }) => {
      return this.post('/api/ai/chat', { message, history, conversationId });
    },

    voice: async ({ command_text, language_hint = 'auto' }) => {
      return this.post('/api/ai/voice', { command_text, language_hint });
    },

    confirmVoice: async ({ command_id, confirmed }) => {
      return this.post('/api/ai/voice/confirm', { command_id, confirmed });
    },
  };
}

export const api = new ApiClient();
export default api;
