// src/hooks/useNotification.js - النسخة المتقدمة الكاملة
import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import apiClient from '../api/client';
import { getSecureItem } from '../utils/storage';

// ✅ تكوين سلوك الإشعارات عند وصولها
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export const useNotification = () => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(null);
  const notificationListener = useRef();
  const responseListener = useRef();

  // ✅ تسجيل الجهاز للحصول على Push Token
  const registerForPushNotifications = async () => {
    if (!Device.isDevice) {
      console.log('⚠️ Must use physical device for Push Notifications');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Failed to get push token for push notification!');
        return null;
      }

      // الحصول على Expo Push Token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: '1d383938-720e-42d0-a230-69bd85cff0eb', // من eas.json
      });

      console.log('✅ Expo Push Token:', token.data);
      setExpoPushToken(token.data);

      // ✅ إرسال التوكن إلى الخادم
      await sendTokenToServer(token.data);

      // تكوين قنوات Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'الإشعارات العامة',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#f64008',
          sound: 'default',
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        await Notifications.setNotificationChannelAsync('orders', {
          name: 'الطلبات',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4CAF50',
          sound: 'default',
          enableVibrate: true,
        });

        await Notifications.setNotificationChannelAsync('messages', {
          name: 'الرسائل',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250],
          lightColor: '#2196F3',
          sound: 'default',
          enableVibrate: true,
        });
      }

      return token.data;
    } catch (error) {
      console.error('❌ Register for push notifications error:', error);
      return null;
    }
  };

  // ✅ إرسال التوكن إلى الخادم
  const sendTokenToServer = async (token) => {
    try {
      const accessToken = await getSecureItem('accessToken');
      if (!accessToken) {
        console.log('⚠️ No access token, skipping device registration');
        return;
      }

      await apiClient.post('/notifications/devices', {
        deviceToken: token,
        platform: Platform.OS,
        deviceId: await Device.getDeviceIdAsync(),
        deviceModel: Device.modelName,
        osVersion: Device.osVersion,
        appVersion: '1.0.0',
      });

      console.log('✅ Device registered on server');
    } catch (error) {
      console.error('❌ Failed to register device on server:', error);
    }
  };

  // ✅ إرسال إشعار محلي
  const sendLocalNotification = async (title, body, data = {}, channel = 'default') => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        channelId: channel,
        badge: 1,
      },
      trigger: null,
    });
  };

  // ✅ تحديث شارة الإشعارات
  const updateBadgeCount = async (count) => {
    await Notifications.setBadgeCountAsync(count);
  };

  // ✅ حذف جميع الإشعارات
  const clearAllNotifications = async () => {
    await Notifications.dismissAllNotificationsAsync();
    await updateBadgeCount(0);
  };

  // ✅ التعامل مع التنقل عند الضغط على الإشعار
  const handleNotificationNavigation = (data) => {
    console.log('🔔 Notification pressed:', data);
    
    if (data.type === 'new_order') {
      router.push('/OrdersScreen');
    } else if (data.type === 'new_message') {
      router.push(`/ChatScreen?conversationId=${data.conversationId}`);
    } else if (data.type === 'order_update') {
      router.push('/ActiveOrderScreen');
    } else if (data.type === 'order_cancelled') {
      router.push('/OrdersScreen');
    } else if (data.type === 'payment') {
      router.push('/ProfileScreen');
    }
  };

  // ✅ استماع للإشعارات الواردة
  useEffect(() => {
    registerForPushNotifications();

    // الإشعارات التي تصل أثناء تشغيل التطبيق
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📱 Notification received while app is open:', notification);
      setNotification(notification);
      
      // تحديث الشارة
      if (notification.request.content.data?.badge) {
        updateBadgeCount(notification.request.content.data.badge);
      }
    });

    // الرد على الإشعار (عند الضغط عليه)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('🔘 Notification response received:', response);
      const { data } = response.notification.request.content;
      handleNotificationNavigation(data);
    });

    // تنظيف المستمعين عند إلغاء تحميل المكون
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
    sendLocalNotification,
    updateBadgeCount,
    clearAllNotifications,
    registerForPushNotifications,
  };
};

export default useNotification;