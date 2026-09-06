import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Inject Bearer token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('neotheatre_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
