// src/utils/constants.js - يستورد الإعدادات من client.js
import { CONFIG } from '../api/client';

// استخدام نفس الروابط من client.js
export const API_BASE_URL = CONFIG.API_URL;
export const SOCKET_URL = CONFIG.SOCKET_URL;

// حالة الطلبات
export const ORDER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  READY: 'ready',
  PICKED: 'picked',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const ORDER_STATUS_AR = {
  [ORDER_STATUS.PENDING]: 'قيد الانتظار',
  [ORDER_STATUS.ACCEPTED]: 'تم القبول',
  [ORDER_STATUS.READY]: 'جاهز للتوصيل',
  [ORDER_STATUS.PICKED]: 'تم الاستلام',
  [ORDER_STATUS.DELIVERED]: 'تم التوصيل',
  [ORDER_STATUS.CANCELLED]: 'ملغي',
};

export const ORDER_STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: '#FF9800',
  [ORDER_STATUS.ACCEPTED]: '#2196F3',
  [ORDER_STATUS.READY]: '#9C27B0',
  [ORDER_STATUS.PICKED]: '#3F51B5',
  [ORDER_STATUS.DELIVERED]: '#4CAF50',
  [ORDER_STATUS.CANCELLED]: '#F44336',
};

// إعدادات إضافية
export const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoid2FsaWQyNSIsImEiOiJjbW4xY3Fma3kwdmxiMnJyMHNqbzNuczBvIn0.6T6xCsIWM3wuaL_QZpwjWA';
export const MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/streets-v12';