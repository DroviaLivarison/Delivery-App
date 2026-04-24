// src/store/authStore.js - النسخة النهائية المصححة

import { create } from 'zustand';
import DriverService from '../api/driverService';
import { connectSocket, disconnectSocket } from '../api/socket';
import { saveSecureItem, deleteSecureItem, getSecureItem } from '../utils/storage';
import { login as loginApi } from '../api/auth';
import LocationService from '../api/location';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isOnline: false,
  stats: {
    todayOrders: 0,
    totalOrders: 0,
    rating: 0,
    earnings: 0,
    todayEarnings: 0,
    weeklyEarnings: 0,
    monthlyEarnings: 0
  },

  login: async (phone, password) => {
    set({ isLoading: true, error: null });

    try {
      const result = await loginApi(phone, password);

      if (result.success && result.user) {
        if (result.accessToken) {
          await saveSecureItem('accessToken', result.accessToken);
        }
        if (result.refreshToken) {
          await saveSecureItem('refreshToken', result.refreshToken);
        }

        const profile = await DriverService.getProfile();
        const stats = await DriverService.getStats();
        const detailedStatus = await DriverService.getDetailedStatus();

        await connectSocket();

        set({
          user: profile,
          isAuthenticated: true,
          isLoading: false,
          isOnline: detailedStatus?.isOnline || false,
          stats: stats || get().stats
        });

        return true;
      } else {
        set({ error: result.message, isLoading: false });
        return false;
      }
    } catch (error) {
      set({ error: error.message || 'فشل تسجيل الدخول', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    await LocationService.stopTracking();
    disconnectSocket();
    await deleteSecureItem('accessToken');
    await deleteSecureItem('refreshToken');

    set({
      user: null,
      isAuthenticated: false,
      isOnline: false,
      stats: { todayOrders: 0, totalOrders: 0, rating: 0, earnings: 0 }
    });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const token = await getSecureItem('accessToken');
      if (!token) {
        set({ isAuthenticated: false, isLoading: false });
        return false;
      }
      
      const profile = await DriverService.getProfile();
      
      if (profile) {
        const stats = await DriverService.getStats();
        const detailedStatus = await DriverService.getDetailedStatus();
        
        await connectSocket();
        
        set({
          user: profile,
          isAuthenticated: true,
          isLoading: false,
          isOnline: detailedStatus?.isOnline || false,
          stats: stats || get().stats
        });
        return true;
      } else {
        await get().logout();
        set({ isAuthenticated: false, isLoading: false });
        return false;
      }
    } catch (error) {
      await get().logout();
      set({ isAuthenticated: false, isLoading: false });
      return false;
    }
  },

  // تبديل حالة الاتصال (isOnline)
  toggleOnlineStatus: async () => {
    const currentState = get();
    const isAccountActive = currentState.user?.isActive === true;
    
    if (!isAccountActive) {
      return false;
    }
    
    const newStatus = !currentState.isOnline;
    const result = await DriverService.toggleOnline(newStatus);

    if (result && result.success) {
      set({ isOnline: newStatus });
      if (currentState.user) {
        set({ 
          user: { 
            ...currentState.user, 
            isOnline: newStatus 
          } 
        });
      }
      return true;
    }
    return false;
  },

  // تبديل حالة التوفر (isAvailable)
  toggleAvailability: async () => {
    const currentState = get();
    const isAccountActive = currentState.user?.isActive === true;
    
    if (!isAccountActive) {
      return false;
    }
    
    if (!currentState.isOnline) {
      return false;
    }
    
    const newStatus = !currentState.user?.isAvailable;
    const result = await DriverService.toggleAvailability(newStatus);
    
    if (result && result.success) {
      set({ 
        user: { ...currentState.user, isAvailable: newStatus }
      });
      return true;
    }
    return false;
  },

  updateProfile: async (profileData) => {
    const result = await DriverService.updateProfile(profileData);
    if (result) {
      set({ user: { ...get().user, ...result } });
      return true;
    }
    return false;
  },

  updateAvatar: async (imageFile) => {
    const result = await DriverService.updateAvatar(imageFile);
    if (result) {
      set({ user: { ...get().user, avatar: result.image, image: result.image } });
      return true;
    }
    return false;
  },

  setStats: (stats) => set({ stats }),

  refreshStats: async () => {
    const stats = await DriverService.getStats();
    if (stats) {
      set({ stats });
    }
    return stats;
  },

  clearError: () => set({ error: null }),

  setOnlineStatus: (status) => {
    const isAccountActive = get().user?.isActive === true;
    if (!isAccountActive && status) {
      return;
    }
    set({ isOnline: status });
  },

  getDriverInfo: () => {
    const { user, stats, isOnline } = get();
    return {
      ...user,
      ...stats,
      isOnline
    };
  }
}));

export default useAuthStore;