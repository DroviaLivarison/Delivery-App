import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';
import { getSecureItem } from '../utils/storage';

// تكوين سلوك الإشعارات
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

const useNotification = () => {
  const navigation = useNavigation();
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(null);
  const notificationListener = useRef();
  const responseListener = useRef();

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
        console.log('❌ Failed to get push token');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: '1d383938-720e-42d0-a230-69bd85cff0eb',
      });

      setExpoPushToken(token.data);
      await sendTokenToServer(token.data);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'الإشعارات العامة',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#f64008',
          sound: 'default',
        });
      }

      return token.data;
    } catch (error) {
      console.log('⚠️ Push notification registration skipped:', error?.message);
      return null;
    }
  };

  const sendTokenToServer = async (token) => {
    try {
      const accessToken = await getSecureItem('accessToken');
      if (!accessToken) return;

      await apiClient.post('/notifications/devices', {
        deviceToken: token,
        platform: Platform.OS,
        deviceId: await Device.getDeviceIdAsync(),
        deviceModel: Device.modelName,
        osVersion: Device.osVersion,
        appVersion: '1.0.0',
      });
    } catch (error) {
      console.log('Device registration skipped:', error?.message);
    }
  };

  const sendLocalNotification = async (title, body, data = {}) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true, priority: Notifications.AndroidNotificationPriority.HIGH },
      trigger: null,
    });
  };

  const updateBadgeCount = async (count) => {
    await Notifications.setBadgeCountAsync(count);
  };

  const clearAllNotifications = async () => {
    await Notifications.dismissAllNotificationsAsync();
    await updateBadgeCount(0);
  };

  const handleNotificationNavigation = (data) => {
    if (data.type === 'new_order') {
      navigation.navigate('Orders');
    } else if (data.type === 'order_update') {
      navigation.navigate('ActiveOrder');
    }
  };

  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
      if (notification.request.content.data?.badge) {
        updateBadgeCount(notification.request.content.data.badge);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const { data } = response.notification.request.content;
      handleNotificationNavigation(data);
    });

    // ✅ الطريقة الصحيحة لإزالة المستمعين
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