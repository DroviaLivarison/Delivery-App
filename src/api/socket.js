// src/api/socket.js - يستورد الإعدادات من client.js
import { io } from 'socket.io-client';
import { getSecureItem } from '../utils/storage';
import { CONFIG } from './client';  // ✅ استيراد الإعدادات من client.js

const SOCKET_URL = CONFIG.SOCKET_URL;

console.log(`🔌 Using Socket: ${SOCKET_URL}`);

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
    console.log('Socket connected successfully to:', SOCKET_URL);
  });

  socket.on('connect_error', (error) => {
    console.log('Socket connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });



  // أضف هذه الأحداث في دالة connectSocket

  socket.on('notification:new', (data) => {
    console.log('🔔 New notification via socket:', data);

    // عرض إشعار محلي
    Notifications.scheduleNotificationAsync({
      content: {
        title: data.title,
        body: data.content,
        data: data.data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
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
    });
  });

  socket.on('order:status:changed', (data) => {
    Notifications.scheduleNotificationAsync({
      content: {
        title: 'تحديث الطلب',
        body: `تم تحديث حالة الطلب #${data.orderId.slice(-6)} إلى ${data.status}`,
        data: { type: 'order_update', orderId: data.orderId },
        sound: true,
      },
      trigger: null,
    });
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