import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useOfflineSync = () => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
      if (state.isConnected) {
        syncPendingData();
      }
    });

    return () => unsubscribe();
  }, []);

  const cacheData = async (key, data) => {
    try {
      const cached = await AsyncStorage.getItem(key);
      const items = cached ? JSON.parse(cached) : [];
      items.push({ data, timestamp: Date.now() });
      await AsyncStorage.setItem(key, JSON.stringify(items));
      return true;
    } catch (error) {
      console.error('Error caching data:', error);
      return false;
    }
  };

  const syncPendingData = async () => {
    const keys = ['pending_orders', 'pending_messages'];
    
    for (const key of keys) {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const items = JSON.parse(cached);
        for (const item of items) {
          await syncItem(key, item);
        }
        await AsyncStorage.removeItem(key);
      }
    }
  };

  const syncItem = async (key, item) => {
    // Implement sync logic based on key type
    console.log(`Syncing ${key}:`, item);
  };

  return { isConnected, cacheData };
};