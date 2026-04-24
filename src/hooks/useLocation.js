// src/hooks/useLocation.js - نسخة مستقلة بدون أخطاء

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import DriverService from '../api/driverService';
import { emitEvent, getSocket } from '../api/socket';
import { LOCATION_TASK_NAME } from '../tasks/locationTask';

const useLocation = (isOnline = true, updateInterval = 10000) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [isInBackground, setIsInBackground] = useState(false);
  const watchPositionRef = useRef(null);
  const mountedRef = useRef(true);
  const backgroundTaskStarted = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // طلب الصلاحيات
  const requestPermissions = useCallback(async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        setError('صلاحية الموقع مطلوبة للتطبيق');
        return false;
      }
      
      if (Platform.OS === 'android') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.log('Background location permission not granted - will use foreground only');
        }
      }
      
      return true;
    } catch (err) {
      console.error('Permission error:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // بدء التتبع المباشر (في المقدمة)
  const startForegroundTracking = useCallback(async () => {
    if (!isOnline || !mountedRef.current) return;
    if (watchPositionRef.current) return;
    
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    
    try {
      watchPositionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: updateInterval,
          distanceInterval: 5,
        },
        async (location) => {
          if (!mountedRef.current) return;
          
          const { latitude, longitude, speed, heading } = location.coords;
          
          console.log(`📍 Foreground location: ${latitude}, ${longitude}`);
          
          setCurrentLocation({
            latitude,
            longitude,
            speed,
            heading,
            timestamp: new Date()
          });
          
          const result = await DriverService.updateLocation(latitude, longitude);
          
          const socket = getSocket();
          if (socket?.connected && result.success) {
            emitEvent('driver:location:updated', {
              latitude,
              longitude,
              speed,
              heading,
              timestamp: new Date().toISOString(),
              source: 'foreground'
            });
          }
        }
      );
      
      console.log('✅ Foreground tracking started (every 10 seconds)');
    } catch (err) {
      console.error('Watch position error:', err);
      setError(err.message);
    }
  }, [isOnline, requestPermissions, updateInterval]);

  // إيقاف التتبع المباشر
  const stopForegroundTracking = useCallback(() => {
    if (watchPositionRef.current) {
      watchPositionRef.current.remove();
      watchPositionRef.current = null;
      console.log('🛑 Foreground tracking stopped');
    }
  }, []);

  // بدء تتبع الخلفية
  const startBackgroundTracking = useCallback(async () => {
    if (!isOnline || !mountedRef.current) return;
    if (backgroundTaskStarted.current) return;
    if (Platform.OS !== 'android') return;
    
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    
    try {
      // التحقق من أن المهمة مسجلة
      if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
        console.error('Background task not defined');
        return;
      }
      
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: updateInterval,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        deferredUpdatesInterval: updateInterval,
        deferredUpdatesDistance: 10,
      });
      
      backgroundTaskStarted.current = true;
      console.log('✅ Background tracking started');
    } catch (err) {
      console.error('Start background tracking error:', err?.message);
      // لا نعرض الخطأ للمستخدم لأن هذا ليس حرجاً
    }
  }, [isOnline, requestPermissions, updateInterval]);

  // إيقاف تتبع الخلفية
  const stopBackgroundTracking = useCallback(async () => {
    if (!backgroundTaskStarted.current) return;
    
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      backgroundTaskStarted.current = false;
      console.log('🛑 Background tracking stopped');
    } catch (err) {
      // تجاهل الخطأ - المهمة قد لا تكون موجودة
      console.log('Stop background tracking ignored:', err?.message);
    }
  }, []);

  // تحديث موقع فوري
  const updateLocationOnce = useCallback(async () => {
    if (!isOnline || !mountedRef.current) return null;
    
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return null;
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const { latitude, longitude, speed, heading } = location.coords;
      
      setCurrentLocation({
        latitude,
        longitude,
        speed,
        heading,
        timestamp: new Date()
      });
      
      const result = await DriverService.updateLocation(latitude, longitude);
      
      if (result?.success && error) {
        setError(null);
      }
      
      return result;
    } catch (err) {
      console.log('Update location once error:', err?.message);
      return null;
    }
  }, [isOnline, requestPermissions, error]);

  // مراقبة حالة التطبيق
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const wasBackground = appStateRef.current === 'background';
      appStateRef.current = nextAppState;
      const isNowBackground = nextAppState === 'background';
      
      setIsInBackground(isNowBackground);
      
      if (isNowBackground && !wasBackground) {
        // انتقل إلى الخلفية
        console.log('📱 App moved to background');
        stopForegroundTracking();
        await startBackgroundTracking();
      } 
      else if (!isNowBackground && wasBackground) {
        // عاد إلى المقدمة
        console.log('📱 App returned to foreground');
        await stopBackgroundTracking();
        startForegroundTracking();
        await updateLocationOnce();
      }
    });
    
    return () => subscription.remove();
  }, [startForegroundTracking, stopForegroundTracking, startBackgroundTracking, stopBackgroundTracking, updateLocationOnce]);

  // بدء/إيقاف التتبع بناءً على حالة الاتصال
  useEffect(() => {
    const initTracking = async () => {
      if (isOnline) {
        if (!isInBackground) {
          await startForegroundTracking();
        } else {
          await startBackgroundTracking();
        }
        setIsTracking(true);
      } else {
        await stopForegroundTracking();
        await stopBackgroundTracking();
        setIsTracking(false);
      }
    };
    
    initTracking();
    
    return () => {
      stopForegroundTracking();
      stopBackgroundTracking();
    };
  }, [isOnline, isInBackground, startForegroundTracking, stopForegroundTracking, startBackgroundTracking, stopBackgroundTracking]);

  // تنظيف عند إلغاء تحميل المكون
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopForegroundTracking();
      stopBackgroundTracking();
    };
  }, [stopForegroundTracking, stopBackgroundTracking]);

  return {
    currentLocation,
    isTracking,
    error,
    isInBackground,
    startForegroundTracking,
    stopForegroundTracking,
    startBackgroundTracking,
    stopBackgroundTracking,
    updateLocation: updateLocationOnce,
  };
};

export default useLocation;