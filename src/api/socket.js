// src/api/socket.js - الملف الكامل المعدل

import { io } from 'socket.io-client';
import { getSecureItem } from '../utils/storage';
import { CONFIG } from './client';
import * as Notifications from 'expo-notifications';

const SOCKET_URL = CONFIG.SOCKET_URL;

console.log(`🔌 Using Socket: ${SOCKET_URL}`);

let socket = null;
let listeners = new Map();
let continuousInterval = null;

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
    console.log('Socket connected successfully to:', SOCKET_URL);
  });

  socket.on('connect_error', (error) => {
    console.log('Socket connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('notification:new', (data) => {
    console.log('🔔 New notification via socket:', data);

    Notifications.scheduleNotificationAsync({
      content: {
        title: data.title,
        body: data.content,
        data: data.data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    }).catch(err => console.log('Notification error:', err));
  });

  socket.on('driver:new-order', (data) => {
    console.log('🆕 New order notification:', data);

    Notifications.scheduleNotificationAsync({
      content: {
        title: 'طلب جديد!',
        body: `لديك طلب جديد بقيمة ${data.totalPrice} د.ع`,
        data: { type: 'new_order', orderId: data.orderId },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    }).catch(err => console.log('Notification error:', err));
  });

  socket.on('order:status:changed', (data) => {
    Notifications.scheduleNotificationAsync({
      content: {
        title: 'تحديث الطلب',
        body: `تم تحديث حالة الطلب #${data.orderId?.slice(-6) || '000000'} إلى ${data.status}`,
        data: { type: 'order_update', orderId: data.orderId },
        sound: true,
      },
      trigger: null,
    }).catch(err => console.log('Notification error:', err));
  });

  return socket;
};

export const disconnectSocket = () => {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
  }
};

export const getSocket = () => socket;

export const onEvent = (eventName, callback) => {
  if (socket) {
    socket.on(eventName, callback);
    if (!listeners.has(eventName)) {
      listeners.set(eventName, []);
    }
    listeners.get(eventName).push(callback);
  }
};

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

export const emitEvent = (eventName, data) => {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
    return true;
  }
  return false;
};

export const onDriverLocationUpdate = (callback) => {
  onEvent('driver:location:updated', callback);
};

export const requestDriverLocation = (driverId) => {
  emitEvent('admin:request:driver:location', { driverId });
};

export const startContinuousLocationUpdates = (callback, interval = 10000) => {
  if (continuousInterval) clearInterval(continuousInterval);
  
  continuousInterval = setInterval(async () => {
    if (socket && socket.connected && callback) {
      callback();
    }
  }, interval);
};

export const stopContinuousLocationUpdates = () => {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
  }
};

export const onNewOrder = (callback) => {
  onEvent('driver:new-order', callback);
};

export const onOrderUpdated = (callback) => {
  onEvent('order:status:updated', callback);
};

export const onOrderCancelled = (callback) => {
  onEvent('driver:order-cancelled', callback);
};

export const onDriverLocationRequest = (callback) => {
  onEvent('driver:location:request', callback);
};

export const emitLocationUpdate = (latitude, longitude, orderId = null) => {
  emitEvent('driver:location:updated', { latitude, longitude, orderId });
};