// src/tasks/locationTask.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import DriverService from '../api/driverService';
import { emitEvent, getSocket } from '../api/socket';

export const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

// ✅ تسجيل المهمة مرة واحدة فقط
if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Background location task error:', error);
      return;
    }
    
    if (data && data.locations) {
      const { locations } = data;
      const location = locations[0];
      
      if (location) {
        const { latitude, longitude } = location.coords;
        
        console.log(`📍 Background location update: ${latitude}, ${longitude}`);
        
        // تحديث الموقع إلى الخادم
        const result = await DriverService.updateLocation(latitude, longitude);
        
        // إرسال عبر Socket إذا كان متصلاً
        const socket = getSocket();
        if (socket && socket.connected && result.success) {
          emitEvent('driver:location:updated', {
            latitude,
            longitude,
            timestamp: new Date().toISOString(),
            source: 'background'
          });
        }
      }
    }
  });
}