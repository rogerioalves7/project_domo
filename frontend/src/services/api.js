import axios from 'axios';

// LÓGICA INTELIGENTE:
// Se existir a variável VITE_API_URL (na Vercel), usa ela.
// Se NÃO existir (na sua máquina), usa o localhost.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
});

api.interceptors.request.use(async config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default api;