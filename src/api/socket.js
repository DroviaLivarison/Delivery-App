// src/api/socket.js - الإصدار المصحح
import { io } from 'socket.io-client';
import { getSecureItem } from '../utils/storage';

const SOCKET_URL = 'https://backend-walid-yahaya.onrender.com';

let socket = null;
let listeners = new Map();

// الاتصال بخادم WebSocket
export const connectSocket = async () => {
  const token = await getSecureItem('accessToken');
  if (!token) {
    console.log('No token found, cannot connect socket');
    return null;
  }

  if (socket && socket.connected) {
    console.log('Socket already connected');
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected successfully');
  });

  socket.on('connect_error', (error) => {
    console.log('Socket connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

// قطع الاتصال
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
  }
};

// الحصول على كائن socket
export const getSocket = () => socket;

// الاستماع للأحداث
export const onEvent = (eventName, callback) => {
  if (socket) {
    socket.on(eventName, callback);
    if (!listeners.has(eventName)) {
      listeners.set(eventName, []);
    }
    listeners.get(eventName).push(callback);
  }
};

// إزالة الاستماع
export const offEvent = (eventName, callback) => {
  if (socket) {
    socket.off(eventName, callback);
    if (listeners.has(eventName)) {
      const callbacks = listeners.get(eventName).filter(cb => cb !== callback);
      if (callbacks.length === 0) {
        listeners.delete(eventName);
      } else {
        listeners.set(eventName, callbacks);
      }
    }
  }
};

// إرسال حدث
export const emitEvent = (eventName, data) => {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
    return true;
  }
  return false;
};

// ========== أحداث المندوب ==========

// استماع لحدث طلب جديد
export const onNewOrder = (callback) => {
  onEvent('driver:new-order', callback);
};

// استماع لحدث تحديث الطلب
export const onOrderUpdated = (callback) => {
  onEvent('order:status:updated', callback);
};

// استماع لحدث إلغاء الطلب
export const onOrderCancelled = (callback) => {
  onEvent('driver:order-cancelled', callback);
};

// استماع لحدث طلب موقع
export const onDriverLocationRequest = (callback) => {
  onEvent('driver:location:request', callback);
};

// إرسال تحديث الموقع
export const emitLocationUpdate = (latitude, longitude, orderId = null) => {
  emitEvent('driver:location:updated', { latitude, longitude, orderId });
};