import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api'
});

API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const getAgents = () => API.get('/users/agents');
export const getUsers = () => API.get('/users');
export const getDashboard = () => API.get('/dashboard');
export const getFields = () => API.get('/fields');
export const createField = (data) => API.post('/fields', data);
export const updateField = (id, data) => API.put(`/fields/${id}`, data);
export const deleteField = (id) => API.delete(`/fields/${id}`);
export const getFieldUpdates = (id) => API.get(`/fields/${id}/updates`);
export const addFieldUpdate = (id, data) => API.post(`/fields/${id}/updates`, data);
