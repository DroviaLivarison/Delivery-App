// src/api/driverService.js - الملف الكامل المعدل

import apiClient from './client';
import { getSecureItem, saveSecureItem, deleteSecureItem } from '../utils/storage';

class DriverService {
  constructor() {
    this.baseUrl = '/driver';
    this.cachedAvailability = null;
  }

  async getProfile() {
    try {
      const response = await apiClient.get(`${this.baseUrl}/profile`);
      console.log('📊 Profile API response:', JSON.stringify(response.data, null, 2));
      const user = this.normalizeUser(response.data.data);
      console.log('📊 Normalized user:', {
        id: user?.id,
        name: user?.name,
        role: user?.role,
        isActive: user?.isActive,
        isVerified: user?.isVerified,
        isAvailable: user?.isAvailable,
        isOnline: user?.isOnline,
        statusText: user?.statusText
      });
      this.cachedAvailability = user?.isAvailable || false;
      return user;
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  async updateProfile(data) {
    try {
      const response = await apiClient.put(`${this.baseUrl}/profile`, data);
      return response.data.data;
    } catch (error) {
      console.error('Update profile error:', error);
      return null;
    }
  }

  async updateAvatar(imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageFile,
        type: 'image/jpeg',
        name: 'avatar.jpg'
      });

      const response = await apiClient.put(`${this.baseUrl}/profile/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.data;
    } catch (error) {
      console.error('Update avatar error:', error);
      return null;
    }
  }

  async toggleAvailability(isAvailable) {
    try {
      console.log('📤 Toggling availability:', { isAvailable });

      const response = await apiClient.put(`${this.baseUrl}/availability`, {
        isAvailable: isAvailable
      });

      console.log('✅ Toggle availability response:', response.data);

      if (response.data?.success) {
        this.cachedAvailability = isAvailable;
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Toggle availability error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل تغيير حالة التوفر'
      };
    }
  }

  async toggleOnline(isOnline) {
    try {
      console.log('📤 Toggling online status:', { isOnline });

      const response = await apiClient.put(`${this.baseUrl}/online`, {
        isOnline: isOnline
      });

      console.log('✅ Toggle online response:', response.data);

      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }

      return { success: false, message: 'فشل تغيير حالة الاتصال' };
    } catch (error) {
      console.error('❌ Toggle online error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل تغيير حالة الاتصال'
      };
    }
  }

  async getDetailedStatus() {
    try {
      const response = await apiClient.get(`${this.baseUrl}/status`);
      return response.data.data;
    } catch (error) {
      console.error('Get detailed status error:', error);
      return {
        isOnline: false,
        isAvailable: false,
        hasActiveOrder: false,
        statusText: 'غير متصل 📴'
      };
    }
  }

  async updateLocation(latitude, longitude, orderId = null) {
    try {
      if (!latitude || !longitude) {
        console.warn('Invalid coordinates:', { latitude, longitude });
        return { success: false, message: 'إحداثيات غير صالحة' };
      }
      
      const updateTime = new Date().toISOString();
      
      const response = await apiClient.put(`${this.baseUrl}/location`, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        orderId: orderId || null,
        timestamp: updateTime
      });
      
      console.log(`📍 Location updated at ${updateTime}: ${latitude}, ${longitude}`);
      
      return { success: true, data: response.data, timestamp: updateTime };
    } catch (error) {
      if (error.response?.status !== 400) {
        console.error('Update location error:', error.response?.status, error.response?.data);
      }
      return {
        success: false,
        message: error.response?.data?.message || 'فشل تحديث الموقع'
      };
    }
  }

  async getCurrentLocation() {
    try {
      const response = await apiClient.get(`${this.baseUrl}/location/current`);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('Get current location error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل جلب الموقع الحالي'
      };
    }
  }

  async getOrderLocation(orderId) {
    try {
      const response = await apiClient.get(`${this.baseUrl}/location/order/${orderId}`);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('Get order location error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل جلب موقع الطلب'
      };
    }
  }

  async getAvailableOrders() {
    try {
      console.log('🔄 Fetching available orders from /orders/available');

      const response = await apiClient.get(`${this.baseUrl}/orders/available`);

      console.log('📦 Available orders API response:', JSON.stringify(response.data, null, 2));

      let orders = [];
      let stats = {};
      let isAvailable = false;
      let isOnline = false;

      if (response.data?.success && response.data?.data) {
        orders = response.data.data.orders || [];
        stats = response.data.data.stats || {};

        if (response.data.data.driverStatus) {
          isAvailable = response.data.data.driverStatus.isAvailable || false;
          isOnline = response.data.data.driverStatus.isOnline || false;
        } else {
          isAvailable = response.data.data.isAvailable || false;
          isOnline = response.data.data.isOnline || false;
        }
      }

      console.log(`✅ Found ${orders.length} available orders`);
      console.log(`📊 Driver status from server: isAvailable=${isAvailable}, isOnline=${isOnline}`);

      this.cachedAvailability = isAvailable;

      return {
        orders: this.normalizeOrders(orders),
        stats: stats,
        isAvailable: isAvailable,
        isOnline: isOnline
      };
    } catch (error) {
      console.error('❌ Get available orders error:', error);
      return { orders: [], stats: {}, isAvailable: false, isOnline: false };
    }
  }

  async getActiveOrder() {
    try {
      console.log('🔄 Fetching active order from /orders/active');
      const response = await apiClient.get(`${this.baseUrl}/orders/active`);

      if (!response.data?.data) {
        console.log('📭 No active order found');
        return null;
      }

      const order = this.normalizeOrder(response.data.data.order || response.data.data);
      console.log('✅ Active order found:', order?.id);
      return order;
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('⚠️ Backend error (500) on getActiveOrder - treating as no active order');
        return null;
      }
      console.error('Get active order error:', error);
      return null;
    }
  }

  async getOrderHistory(page = 1, limit = 20) {
    try {
      const response = await apiClient.get(`${this.baseUrl}/orders/history`, {
        params: { page, limit }
      });
      return {
        orders: this.normalizeOrders(response.data.data?.orders || []),
        pagination: response.data.data?.pagination || { page, limit, total: 0, pages: 0 },
        stats: response.data.data?.stats || { totalOrders: 0, totalEarnings: 0 }
      };
    } catch (error) {
      console.error('Get order history error:', error);
      return { orders: [], pagination: { page, limit, total: 0, pages: 0 }, stats: {} };
    }
  }

  async getOrderDetails(orderId) {
    try {
      const response = await apiClient.get(`${this.baseUrl}/orders/${orderId}`);
      return this.normalizeOrder(response.data.data?.order || response.data.data);
    } catch (error) {
      console.error('Get order details error:', error);
      return null;
    }
  }

  async acceptOrder(orderId) {
    try {
      const response = await apiClient.put(`${this.baseUrl}/orders/${orderId}/accept`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Accept order error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل قبول الطلب'
      };
    }
  }

  async rejectOrder(orderId, reason = '') {
    try {
      const response = await apiClient.put(`${this.baseUrl}/orders/${orderId}/reject`, { reason });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Reject order error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل رفض الطلب'
      };
    }
  }

  async updateOrderStatus(orderId, status, location = null) {
    try {
      const validStatuses = ['pending', 'accepted', 'ready', 'picked', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        console.error('❌ Invalid status:', status);
        return {
          success: false,
          message: `حالة غير صالحة: ${status}`
        };
      }

      const payload = { status };

      if (location && typeof location === 'object') {
        if (location.latitude && location.longitude) {
          payload.location = {
            latitude: location.latitude,
            longitude: location.longitude
          };
          console.log('📍 Adding location to payload:', payload.location);
        }
      }

      console.log('📤 Updating order status:', { orderId, status, hasLocation: !!payload.location });

      const response = await apiClient.put(`${this.baseUrl}/orders/${orderId}/status`, payload);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Update order status error:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        data: error.response?.data
      });
      return {
        success: false,
        message: error.response?.data?.message || 'فشل تحديث الحالة'
      };
    }
  }

  async startDelivery(orderId) {
    try {
      const response = await apiClient.post(`${this.baseUrl}/orders/${orderId}/start`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Start delivery error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل بدء التوصيل'
      };
    }
  }

  async completeOrder(orderId, signature = null, deliveryPhoto = null) {
    try {
      const response = await apiClient.post(`${this.baseUrl}/orders/${orderId}/complete`, {
        signature,
        deliveryPhoto
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Complete order error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل إنهاء الطلب'
      };
    }
  }

  async getEarnings(period = 'week') {
    try {
      const response = await apiClient.get(`${this.baseUrl}/earnings`, { params: { period } });
      return response.data.data;
    } catch (error) {
      console.error('Get earnings error:', error);
      return { earnings: [], totals: { totalOrders: 0, totalEarnings: 0 } };
    }
  }

  async getEarningsHistory(page = 1, limit = 20) {
    try {
      const response = await apiClient.get(`${this.baseUrl}/earnings/history`, {
        params: { page, limit }
      });
      return response.data.data;
    } catch (error) {
      console.error('Get earnings history error:', error);
      return { earnings: [], stats: {}, pagination: { page, limit, total: 0, pages: 0 } };
    }
  }

  async getStats() {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats`);
      return response.data.data;
    } catch (error) {
      console.error('Get stats error:', error);
      return null;
    }
  }

  async getPerformance() {
    try {
      const response = await apiClient.get(`${this.baseUrl}/performance`);
      return response.data.data;
    } catch (error) {
      console.error('Get performance error:', error);
      return null;
    }
  }

  async checkAccountStatus() {
    try {
      const profile = await this.getProfile();
      if (!profile) return { isActive: true, isVerified: true, isOnline: false, isAvailable: false };

      return {
        isActive: profile.isActive === true,
        isVerified: profile.isVerified === true,
        isOnline: profile.isOnline === true,
        isAvailable: profile.isAvailable === true
      };
    } catch (error) {
      console.error('Check account status error:', error);
      return { isActive: true, isVerified: true, isOnline: false, isAvailable: false };
    }
  }

  async updateAccountStatus(isActive) {
    try {
      const response = await apiClient.put(`${this.baseUrl}/profile/status`, { isActive });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update account status error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل تحديث حالة الحساب'
      };
    }
  }

  normalizeOrder(order) {
    if (!order) return null;

    return {
      ...order,
      id: order._id,
      statusText: this.getStatusText(order.status),
      canCancel: ['pending', 'accepted'].includes(order.status),
      canStart: order.status === 'accepted' || order.status === 'ready',
      canComplete: order.status === 'picked',
      itemCount: order.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0,
      formattedTotal: this.formatCurrency(order.totalPrice),
      createdAtFormatted: this.formatDate(order.createdAt),
      deliveredAtFormatted: this.formatDate(order.deliveredAt)
    };
  }

  normalizeOrders(orders) {
    return (orders || []).map(order => this.normalizeOrder(order));
  }

  getDriverStatusText(driver) {
    if (driver.hasActiveOrder) return 'مشغول (في توصيلة)';
    if (driver.isOnline && driver.isAvailable) return 'متاح ✅';
    if (driver.isOnline && !driver.isAvailable) return 'غير متاح ⛔';
    return 'غير متصل 📴';
  }

  normalizeUser(user) {
    if (!user) return null;

    console.log('📊 Raw user data:', JSON.stringify(user, null, 2));

    const isActiveValue = user.isActive === true;
    const isVerifiedValue = user.isVerified === true;
    const isOnlineValue = user.isOnline === true;
    const isAvailableValue = user.driverInfo?.isAvailable === true;

    console.log('📊 Status values:', {
      raw_isOnline: user.isOnline,
      raw_isAvailable: user.driverInfo?.isAvailable,
      raw_isActive: user.isActive,
      raw_isVerified: user.isVerified,
      computed_isActive: isActiveValue,
      computed_isVerified: isVerifiedValue,
      computed_isOnline: isOnlineValue,
      computed_isAvailable: isAvailableValue
    });

    return {
      ...user,
      id: user._id,
      fullName: user.name,
      name: user.name,
      avatar: user.image,
      image: user.image,
      phone: user.phone,
      email: user.email,
      isActive: isActiveValue,
      isVerified: isVerifiedValue,
      isOnline: isOnlineValue,
      isAvailable: isAvailableValue,
      statusText: this.getDriverStatusText({
        isOnline: isOnlineValue,
        isAvailable: isAvailableValue,
        hasActiveOrder: false
      }),
      totalDeliveries: user.driverInfo?.totalDeliveries || 0,
      earnings: user.driverInfo?.earnings || 0,
      rating: user.driverInfo?.rating || 0,
      totalRatings: user.driverInfo?.totalRatings || 0,
      currentLocation: user.driverInfo?.currentLocation,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role || 'driver'
    };
  }

  getStatusText(status) {
    const statusMap = {
      pending: 'قيد الانتظار',
      accepted: 'تم القبول',
      ready: 'جاهز',
      picked: 'تم الاستلام',
      delivered: 'تم التوصيل',
      cancelled: 'ملغي'
    };
    return statusMap[status] || status;
  }

  formatCurrency(amount) {
    if (!amount && amount !== 0) return '0 د.ع';
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
  }

  formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleString('ar-SA');
  }
}

export default new DriverService();