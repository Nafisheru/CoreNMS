// frontend/js/api.js
const api = {
  baseUrl: '/api',

  async request(path, options = {}) {
    const token = localStorage.getItem('core_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.clearAuth();
        window.location.href = '/index.html';
      }
      throw new Error(data.error || 'Terjadi kesalahan');
    }

    return data;
  },

  get(path) { return this.request(path, { method: 'GET' }); },
  post(path, data) { return this.request(path, { method: 'POST', body: JSON.stringify(data) }); },
  put(path, data) { return this.request(path, { method: 'PUT', body: JSON.stringify(data) }); },
  delete(path) { return this.request(path, { method: 'DELETE' }); },

  setAuth(token, user) {
    localStorage.setItem('core_token', token);
    localStorage.setItem('core_user', JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem('core_token');
    localStorage.removeItem('core_user');
  },

  getUser() {
    try {
      const user = localStorage.getItem('core_user');
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('core_token');
  }
};
