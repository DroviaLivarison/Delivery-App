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
      const user = this.normalizeUser(response.data.data);
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

  async toggleAvailability(isOnline) {
    try {
      console.log('📤 Toggling availability:', { isOnline: isOnline });
      
      const response = await apiClient.put(`${this.baseUrl}/profile/availability`, {
        isOnline: isOnline,
        isAvailable: isOnline
      });
      
      console.log('✅ Toggle response:', response.data);
      
      if (response.data?.success) {
        this.cachedAvailability = isOnline;
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

  async updateLocation(latitude, longitude, orderId = null) {
    try {
      const response = await apiClient.put(`${this.baseUrl}/location`, {
        latitude,
        longitude,
        orderId
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update location error:', error);
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
        isAvailable = response.data.data.isAvailable || false;
        isOnline = response.data.data.isOnline || false;
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
      // ✅ معالجة خاصة لخطأ 500 - نعتبر أنه لا يوجد طلب نشط
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

  // ✅ الدالة الكاملة المعدلة لـ updateOrderStatus
  async updateOrderStatus(orderId, status, location = null) {
    try {
      // ✅ التحقق من صحة الحالة
      const validStatuses = ['pending', 'accepted', 'ready', 'picked', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        console.error('❌ Invalid status:', status);
        return {
          success: false,
          message: `حالة غير صالحة: ${status}`
        };
      }
      
      // ✅ بناء الـ payload
      const payload = { status };
      
      // ✅ فقط أضف location إذا كان object صالح وله الخصائص المطلوبة
      if (location && typeof location === 'object') {
        if (location.latitude && location.longitude) {
          payload.location = {
            latitude: location.latitude,
            longitude: location.longitude
          };
          console.log('📍 Adding location to payload:', payload.location);
        } else if (location.coordinates || location.lat || location.lng) {
          // دعم صيغ مختلفة للموقع
          payload.location = {
            latitude: location.latitude || location.lat || location.coordinates?.[1],
            longitude: location.longitude || location.lng || location.coordinates?.[0]
          };
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

  // ========== دوال مساعدة ==========

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

  normalizeUser(user) {
    if (!user) return null;

    return {
      ...user,
      id: user._id,
      fullName: user.name,
      avatar: user.image,
      phone: user.phone,
      email: user.email,
      isAvailable: user.driverInfo?.isAvailable || false,
      totalDeliveries: user.driverInfo?.totalDeliveries || 0,
      earnings: user.driverInfo?.earnings || 0,
      rating: user.driverInfo?.rating || 0,
      totalRatings: user.driverInfo?.totalRatings || 0
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