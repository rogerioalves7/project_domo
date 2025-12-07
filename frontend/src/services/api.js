import axios from 'axios';

const api = axios.create({
  // Se o backend roda na porta 8000, deve ser assim:
  baseURL: 'http://localhost:8000/', 
});

export default api;