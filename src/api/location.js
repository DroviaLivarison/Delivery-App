// src/api/location.js - الإصدار النهائي المصحح
import * as Location from 'expo-location';
import DriverService from './driverService';
import { getSocket, emitEvent } from './socket';

class LocationService {
  constructor() {
    this.watchId = null;
    this.isTracking = false;
    this.lastLocation = null;
  }

  // الحصول على الموقع الحالي من الجهاز
  async getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, message: 'سماح الوصول إلى الموقع مطلوب' };
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      return {
        success: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp
      };
    } catch (error) {
      console.error('Get current location error:', error);
      return {
        success: false,
        message: 'فشل الحصول على الموقع'
      };
    }
  }

  // تحديث الموقع إلى الخادم
  async updateLocationToServer(latitude = null, longitude = null, orderId = null) {
    try {
      let lat = latitude;
      let lng = longitude;
      
      if (!lat || !lng) {
        const location = await this.getCurrentLocation();
        if (!location.success) return { success: false };
        lat = location.latitude;
        lng = location.longitude;
      }
      
      this.lastLocation = { latitude: lat, longitude: lng, timestamp: new Date() };
      
      // إرسال عبر HTTP
      const result = await DriverService.updateLocation(lat, lng, orderId);
      
      // إرسال عبر Socket للتحديث المباشر
      const socket = getSocket();
      if (socket && socket.connected) {
        emitEvent('driver:location:updated', {
          latitude: lat,
          longitude: lng,
          orderId,
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (error) {
      console.error('Update location to server error:', error);
      return { success: false };
    }
  }

  // بدء تتبع الموقع
  async startTracking(updateInterval = 10000, onLocationUpdate = null) {
    if (this.isTracking) {
      console.log('Location tracking already started');
      return;
    }
    
    this.isTracking = true;
    
    // تحديث فوري
    const initialLocation = await this.updateLocationToServer();
    if (onLocationUpdate && initialLocation.success) {
      onLocationUpdate(initialLocation);
    }
    
    // بدء التتبع الدوري
    this.watchId = setInterval(async () => {
      const result = await this.updateLocationToServer();
      if (onLocationUpdate && result.success) {
        onLocationUpdate(result);
      }
    }, updateInterval);
    
    console.log('Location tracking started');
  }

  // إيقاف تتبع الموقع
  async stopTracking() {
    if (this.watchId) {
      clearInterval(this.watchId);
      this.watchId = null;
    }
    
    this.isTracking = false;
    console.log('Location tracking stopped');
  }

  // الحصول على موقع الطلب
  async getOrderLocation(orderId) {
    return await DriverService.getOrderLocation(orderId);
  }

  // تغيير حالة الاتصال
  async updateOnlineStatus(isOnline) {
    return await DriverService.toggleAvailability(isOnline);
  }

  // الحصول على آخر موقع معروف
  getLastLocation() {
    return this.lastLocation;
  }

  // حساب المسافة بين نقطتين
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // تنسيق المسافة للعرض
  formatDistance(distanceKm) {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} م`;
    }
    return `${distanceKm.toFixed(1)} كم`;
  }
}

export default new LocationService();