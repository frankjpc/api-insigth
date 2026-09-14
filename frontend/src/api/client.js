import axios from 'axios';

// Axios requiere que baseURL termine con "/" para que preserve el path base (/api/)
// al concatenar sub-rutas como "/auth/login". Sin la barra final, /api se descarta.
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const normalizedUrl = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
const API_URL = normalizedUrl.endsWith('/') ? normalizedUrl : `${normalizedUrl}/`;

const client = axios.create({
  baseURL: API_URL,
});

// Interceptor: adjuntar token JWT en cada request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: manejar errores de autenticación
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default client;
