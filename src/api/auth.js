import apiClient from './client';
import { saveSecureItem, deleteSecureItem } from '../utils/storage';

// تسجيل الدخول
export const login = async (phone, password) => {
  try {
    const response = await apiClient.post('/auth/login', {
      phone,
      password,
    });
     
    const { accessToken, refreshToken, user } = response.data.data;
    
    await saveSecureItem('accessToken', accessToken);
    await saveSecureItem('refreshToken', refreshToken);
    
    return { success: true, user };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'حدث خطأ في تسجيل الدخول',
    };
  }
};

// تسجيل الخروج
export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    await deleteSecureItem('accessToken');
    await deleteSecureItem('refreshToken');
  }
};

// تغيير كلمة المرور
export const changePassword = async (currentPassword, newPassword, confirmPassword) => {
  try {
    const response = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    return { success: true, message: response.data.message };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'فشل تغيير كلمة المرور',
    };
  }
};

// الحصول على بيانات المندوب
export const getDriverProfile = async () => {
  try {
    const response = await apiClient.get('/driver/profile');
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'فشل جلب البيانات',
    };
  }
};

// تحديث بيانات المندوب
export const updateDriverProfile = async (profileData) => {
  try {
    const response = await apiClient.put('/driver/profile', profileData);
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'فشل تحديث البيانات',
    };
  }
};