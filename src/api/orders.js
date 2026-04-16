// src/api/orders.js - الإصدار المصحح بالكامل
import apiClient from './client';
import DriverService from './driverService';

// استخدام DriverService للطلبات (لتجنب الازدواجية)
export const getDriverOrders = async (status = null) => {
  if (status === 'pending') {
    const result = await DriverService.getAvailableOrders();
    return { success: true, data: result.orders };
  }

  try {
    const params = status ? { status } : {};
    const response = await apiClient.get('/driver/orders', { params });
    return { success: true, data: response.data.data?.orders || [] };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'فشل جلب الطلبات',
    };
  }
};

export const getCurrentOrder = async () => {
  const order = await DriverService.getActiveOrder();
  return { success: !!order, data: order };
};

export const acceptOrder = async (orderId) => {
  return await DriverService.acceptOrder(orderId);
};

export const rejectOrder = async (orderId, reason = '') => {
  return await DriverService.rejectOrder(orderId, reason);
};


export const updateOrderStatus = async (orderId, status, location = null) => {
  return await DriverService.updateOrderStatus(orderId, status);
};
export const startDelivery = async (orderId) => {
  return await DriverService.startDelivery(orderId);
};

export const completeOrder = async (orderId, signature = null, deliveryPhoto = null) => {
  return await DriverService.completeOrder(orderId, signature, deliveryPhoto);
};

export const getOrderHistory = async (page = 1, limit = 20) => {
  const result = await DriverService.getOrderHistory(page, limit);
  return { success: true, data: result.orders, pagination: result.pagination, stats: result.stats };
};

export const getOrderDetails = async (orderId) => {
  const order = await DriverService.getOrderDetails(orderId);
  return { success: !!order, data: order };
};