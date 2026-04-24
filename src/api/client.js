// src/api/client.js - المصدر الرئيسي للإعدادات
import axios from 'axios';
import { Platform } from 'react-native';
import { getSecureItem, saveSecureItem, deleteSecureItem } from '../utils/storage';

// 👇 غير هذا السطر فقط للتبديل
const USE_LOCAL = true;  // true = localhost, false = production

// 👇 نفس IP المستخدم في client.js (غيره عند الحاجة)
const YOUR_COMPUTER_IP = '10.221.221.136';

// تصدير الإعدادات لاستخدامها في ملفات أخرى
export const CONFIG = {
  USE_LOCAL,
  YOUR_COMPUTER_IP,
  getLocalApiUrl: () => {
    return `http://${YOUR_COMPUTER_IP}:3001/api/v1`;
  },
  getLocalSocketUrl: () => {
    return `http://${YOUR_COMPUTER_IP}:3001`;
  },
  PROD_API: 'https://backend-walid-yahaya.onrender.com/api/v1',
  PROD_SOCKET: 'https://backend-walid-yahaya.onrender.com',
  get API_URL() {
    return this.USE_LOCAL ? this.getLocalApiUrl() : this.PROD_API;
  },
  get SOCKET_URL() {
    return this.USE_LOCAL ? this.getLocalSocketUrl() : this.PROD_SOCKET;
  }
};

const API_BASE_URL = CONFIG.API_URL;

console.log(`📡 Using API: ${API_BASE_URL}`);
console.log(`🖥️  Computer IP: ${CONFIG.YOUR_COMPUTER_IP}`);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// إضافة التوكن لكل request
apiClient.interceptors.request.use(async (config) => {
  const token = await getSecureItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// معالجة انتهاء التوكن
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = await getSecureItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
            refreshToken,
          });
          
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          await saveSecureItem('accessToken', accessToken);
          await saveSecureItem('refreshToken', newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axios(originalRequest);
        } catch (refreshError) {
          console.error('Refresh token error:', refreshError);
          await deleteSecureItem('accessToken');
          await deleteSecureItem('refreshToken');
        }
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout:', error.message);
      return Promise.reject({ message: 'انتهت مهلة الاتصال، يرجى المحاولة مرة أخرى' });
    }
    
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject({ message: 'فشل الاتصال بالخادم، يرجى التحقق من الاتصال بالإنترنت' });
    }
    if (error.response?.status === 400) {
      const validationErrors = error.response?.data?.errors;
      if (validationErrors && Array.isArray(validationErrors)) {
        const errorMessage = validationErrors.map(e => e.message).join(', ');
        return Promise.reject({ 
          message: errorMessage,
          validationErrors 
        });
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;