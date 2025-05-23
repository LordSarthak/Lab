// src/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000',  // MUST be HTTP, not HTTPS
  withCredentials: false,           // only true if you're using cookies
});

export default api;
