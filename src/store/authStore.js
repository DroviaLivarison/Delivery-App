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

        await connectSocket();

        if (profile?.isAvailable) {
          await LocationService.startTracking();
        }

        set({
          user: profile,
          isAuthenticated: true,
          isLoading: false,
          isOnline: profile?.isAvailable || false,
          stats: stats || get().stats
        });

        return true;
      } else {
        set({ error: result.message, isLoading: false });
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
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

        await connectSocket();

        if (profile.isAvailable) {
          await LocationService.startTracking();
        }

        set({
          user: profile,
          isAuthenticated: true,
          isLoading: false,
          isOnline: profile.isAvailable || false,
          stats: stats || get().stats
        });

        return true;
      } else {
        set({ isAuthenticated: false, isLoading: false });
        return false;
      }
    } catch (error) {
      console.error('Load user error:', error);
      set({ isAuthenticated: false, isLoading: false });
      return false;
    }
  },

  toggleOnlineStatus: async () => {
    const newStatus = !get().isOnline;
    console.log('🔄 Toggling online status to:', newStatus);
    
    const result = await DriverService.toggleAvailability(newStatus);

    if (result && result.success) {
      console.log('✅ Toggle successful, updating state');
      
      set({ isOnline: newStatus });

      if (get().user) {
        set({ user: { ...get().user, isAvailable: newStatus, isOnline: newStatus } });
      }

      if (newStatus) {
        await LocationService.startTracking();
      } else {
        await LocationService.stopTracking();
      }
      
      setTimeout(async () => {
        console.log('🔄 Verifying status after toggle...');
        const freshOrders = await DriverService.getAvailableOrders();
        console.log('📦 Status after verification:', freshOrders.isAvailable);
      }, 500);

      return true;
    }
    
    console.log('❌ Toggle failed');
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