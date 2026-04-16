import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// حفظ البيانات الحساسة (التوكن)
export const saveSecureItem = async (key, value) => {
  try {
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch (error) {
    console.error('Error saving secure item:', error);
    return false;
  }
};

// قراءة البيانات الحساسة
export const getSecureItem = async (key) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error('Error getting secure item:', error);
    return null;
  }
};

// حذف البيانات الحساسة
export const deleteSecureItem = async (key) => {
  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (error) {
    console.error('Error deleting secure item:', error);
    return false;
  }
};

// حفظ بيانات عادية
export const saveItem = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Error saving item:', error);
    return false;
  }
};

// قراءة بيانات عادية
export const getItem = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Error getting item:', error);
    return null;
  }
};

// حذف بيانات عادية
export const deleteItem = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    return false;
  }
};