import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/', // Endereço do seu Django
  withCredentials: true, // Importante para cookies/sessões se usarmos no futuro
});

export default api;