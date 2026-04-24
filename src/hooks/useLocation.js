// src/hooks/useLocation.js - النسخة المتقدمة الكاملة
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import DriverService from '../api/driverService';
import { getSocket, emitEvent, connectSocket } from '../api/socket';
import { colors } from '../styles/colors';

// ✅ اسم مهمة الخلفية
const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
const HEARTBEAT_TASK_NAME = 'HEARTBEAT_TASK';

// ✅ تعريف مهمة تحديث الموقع في الخلفية
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('❌ Background location error:', error);
    return;
  }
  
  const { locations } = data;
  if (!locations || locations.length === 0) return;
  
  const location = locations[locations.length - 1];
  const { latitude, longitude, accuracy, heading, speed } = location.coords;
  
  console.log(`📍 [Background] Location: ${latitude}, ${longitude}`);
  
  try {
    // إرسال الموقع إلى الخادم
    await DriverService.updateLocation(latitude, longitude, null);
    
    // إرسال عبر Socket إذا كان متصلاً
    const socket = getSocket();
    if (socket?.connected) {
      emitEvent('driver:location:updated', {
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        background: true,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('❌ Failed to send background location:', err);
  }
});

// ✅ تعريف مهمة نبضات القلب
TaskManager.defineTask(HEARTBEAT_TASK_NAME, async () => {
  console.log('💓 [Background] Heartbeat task running');
  
  try {
    const socket = getSocket();
    const isConnected = socket?.connected;
    
    // إرسال نبضة قلب إلى الخادم
    emitEvent('driver:heartbeat', {
      timestamp: new Date().toISOString(),
      isConnected,
      batteryLevel: await getBatteryLevel()
    });
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Heartbeat error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ✅ دالة مساعدة لجلب مستوى البطارية
const getBatteryLevel = async () => {
  try {
    const battery = await require('expo-battery').getBatteryLevelAsync();
    return battery;
  } catch {
    return null;
  }
};

class LocationService {
  constructor() {
    this.watchId = null;
    this.isTracking = false;
    this.lastLocation = null;
    this.isBackgroundTracking = false;
    this.heartbeatInterval = null;
  }

  // ✅ طلب جميع الصلاحيات
  async requestPermissions() {
    try {
      // صلاحيات الموقع في المقدمة
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        return { success: false, message: 'صلاحية الموقع في المقدمة مطلوبة' };
      }
      
      // صلاحيات الموقع في الخلفية
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('⚠️ Background location permission not granted');
        return { success: false, message: 'صلاحية الموقع في الخلفية مطلوبة' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Permission error:', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ بدء تتبع الموقع في الخلفية
  async startBackgroundTracking() {
    if (this.isBackgroundTracking) {
      console.log('⚠️ Background tracking already started');
      return true;
    }
    
    try {
      // التحقق من أن المهمة مسجلة
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isRegistered) {
        console.log('📝 Registering background location task...');
      }
      
      // بدء تحديثات الموقع في الخلفية
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000, // 10 ثواني
        distanceInterval: 30, // 30 متر
        showsBackgroundLocationIndicator: true,
        activityType: Location.ActivityType.OtherNavigation,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: '🚚 تطبيق المندوب',
          notificationBody: 'يعمل في الخلفية لتحديث موقعك وتوصيل الطلبات',
          notificationColor: colors.primary,
          sticky: true,
        },
      });
      
      this.isBackgroundTracking = true;
      console.log('✅ Background location tracking started');
      return true;
    } catch (error) {
      console.error('❌ Start background tracking error:', error);
      return false;
    }
  }

  // ✅ إيقاف تتبع الموقع في الخلفية
  async stopBackgroundTracking() {
    if (!this.isBackgroundTracking) return;
    
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      this.isBackgroundTracking = false;
      console.log('✅ Background location tracking stopped');
    } catch (error) {
      console.error('❌ Stop background tracking error:', error);
    }
  }

  // ✅ بدء نبضات القلب في الخلفية
  async startHeartbeat() {
    if (Platform.OS !== 'android') return;
    
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK_NAME);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(HEARTBEAT_TASK_NAME, {
          minimumInterval: 60, // كل دقيقة
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('✅ Heartbeat task registered');
      }
    } catch (error) {
      console.error('❌ Heartbeat registration error:', error);
    }
  }

  // ✅ الحصول على الموقع الحالي
  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      return {
        success: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('❌ Get current location error:', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ تحديث الموقع إلى الخادم
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
      
      // إرسال عبر Socket
      const socket = getSocket();
      if (socket?.connected) {
        emitEvent('driver:location:updated', {
          latitude: lat,
          longitude: lng,
          orderId,
          timestamp: new Date().toISOString(),
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Update location error:', error);
      return { success: false };
    }
  }

  // ✅ بدء التتبع الكامل (مقدمة + خلفية)
  async startFullTracking(onLocationUpdate = null) {
    if (this.isTracking) {
      console.log('⚠️ Full tracking already started');
      return;
    }
    
    // طلب الصلاحيات
    const permissions = await this.requestPermissions();
    if (!permissions.success) {
      console.error('❌ Permission denied:', permissions.message);
      return;
    }
    
    // بدء تتبع الخلفية
    await this.startBackgroundTracking();
    
    // بدء نبضات القلب
    await this.startHeartbeat();
    
    // تحديث فوري
    const initialLocation = await this.updateLocationToServer();
    if (onLocationUpdate && initialLocation.success) {
      onLocationUpdate(initialLocation);
    }
    
    // بدء التتبع في المقدمة
    this.watchId = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 30,
      },
      async (location) => {
        const result = await this.updateLocationToServer(
          location.coords.latitude,
          location.coords.longitude
        );
        if (onLocationUpdate && result.success) {
          onLocationUpdate(result);
        }
      }
    );
    
    this.isTracking = true;
    console.log('✅ Full tracking started (foreground + background)');
  }

  // ✅ إيقاف التتبع الكامل
  async stopFullTracking() {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }
    
    await this.stopBackgroundTracking();
    
    this.isTracking = false;
    console.log('✅ Full tracking stopped');
  }

  // ✅ التحقق من حالة التتبع
  isTrackingActive() {
    return this.isTracking;
  }

  // ✅ الحصول على آخر موقع معروف
  getLastLocation() {
    return this.lastLocation;
  }
}

export default new LocationService();

// ✅ Hook مخصص للاستخدام في المكونات
export const useLocation = (isOnline = true, updateInterval = 15000) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const trackingRef = useRef(false);

  const updateLocation = useCallback(async () => {
    if (!isOnline) return null;
    
    const result = await LocationService.updateLocationToServer();
    if (result.success && result.data?.data?.location) {
      setCurrentLocation({
        latitude: result.data.data.location.latitude,
        longitude: result.data.data.location.longitude,
        timestamp: new Date(),
      });
    }
    return result;
  }, [isOnline]);

  const startTracking = useCallback(async () => {
    if (trackingRef.current) return;
    
    trackingRef.current = true;
    setIsTracking(true);
    
    await LocationService.startFullTracking((location) => {
      setCurrentLocation({
        latitude: location.data?.data?.location?.latitude,
        longitude: location.data?.data?.location?.longitude,
        timestamp: new Date(),
      });
    });
    
    console.log('📍 Full tracking started via hook');
  }, []);

  const stopTracking = useCallback(async () => {
    await LocationService.stopFullTracking();
    trackingRef.current = false;
    setIsTracking(false);
    console.log('📍 Full tracking stopped via hook');
  }, []);

  // التعامل مع تغييرات حالة التطبيق
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && isOnline && !trackingRef.current) {
        console.log('📱 App resumed, restarting tracking...');
        await startTracking();
      }
    });
    
    return () => subscription.remove();
  }, [isOnline, startTracking]);

  // بدء/إيقاف التتبع بناءً على حالة الاتصال
  useEffect(() => {
    if (isOnline) {
      startTracking();
    } else {
      stopTracking();
    }
    
    return () => {
      stopTracking();
    };
  }, [isOnline, startTracking, stopTracking]);

  return {
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking,
    updateLocation,
    updateLocationToServer: updateLocation,
  };
};