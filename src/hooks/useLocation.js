import { useEffect, useRef, useState, useCallback } from 'react';
import LocationService from '../api/location';
import DriverService from '../api/driverService';
import { getSocket, onEvent, offEvent } from '../api/socket';

export const useLocation = (isOnline = true, updateInterval = 15000) => { // ✅ زيادة الوقت إلى 15 ثانية
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const isUpdatingRef = useRef(false);

  const updateLocation = useCallback(async () => {
    if (!isOnline) return null;
    if (isUpdatingRef.current) {
      console.log('⏳ Location update already in progress, skipping...');
      return null;
    }
    
    isUpdatingRef.current = true;
    
    try {
      const result = await LocationService.updateLocationToServer();
      
      if (result.success) {
        const locationData = result.data?.data || result.data;
        const newLocation = {
          latitude: locationData?.location?.latitude || locationData?.latitude,
          longitude: locationData?.location?.longitude || locationData?.longitude,
          timestamp: new Date()
        };
        setCurrentLocation(newLocation);
        return result;
      } else {
        setError(result.message);
        return null;
      }
    } catch (error) {
      console.error('Update location error:', error);
      return null;
    } finally {
      isUpdatingRef.current = false;
    }
  }, [isOnline]);

  const updateOnlineStatus = useCallback(async (status) => {
    try {
      const result = await DriverService.toggleAvailability(status);
      if (result.success) {
        if (status) {
          await startTracking();
        } else {
          await stopTracking();
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Update online status error:', error);
      return false;
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (!isOnline) {
      console.log('Driver is offline, not starting tracking');
      return;
    }
    
    if (isTracking) {
      console.log('Tracking already started');
      return;
    }
    
    setError(null);
    setIsTracking(true);
    
    await updateLocation();
    
    intervalRef.current = setInterval(async () => {
      await updateLocation();
    }, updateInterval);
    
    console.log(`Location tracking started with interval ${updateInterval}ms`);
  }, [isOnline, isTracking, updateLocation, updateInterval]);

  const stopTracking = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    await LocationService.stopTracking();
    setIsTracking(false);
    console.log('Location tracking stopped');
  }, []);

  const setupSocketListeners = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    
    onEvent('driver:location:request', async (data) => {
      console.log('📍 Location requested:', data);
      await updateLocation();
    });
  }, [updateLocation]);

  useEffect(() => {
    if (isOnline) {
      startTracking();
      setupSocketListeners();
    }
    
    return () => {
      stopTracking();
      offEvent('driver:location:request');
    };
  }, [isOnline, startTracking, stopTracking, setupSocketListeners]);

  return {
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking,
    updateLocation,
    updateLocationToServer: updateLocation,
    updateOnlineStatus
  };
};

export default useLocation;