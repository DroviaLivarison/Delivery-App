import React, { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';

// شاشات المصادقة
import LoginScreen from '../screens/auth/LoginScreen';

// شاشات التطبيق الرئيسية
import OrdersScreen from '../screens/main/OrdersScreen';
import ActiveOrderScreen from '../screens/main/ActiveOrderScreen';
import OrderHistoryScreen from '../screens/main/OrderHistoryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ChatListScreen from '../screens/main/ChatListScreen';
import ChatScreen from '../screens/main/ChatScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import MapScreen from '../screens/main/MapScreen';

import { colors } from '../styles/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Orders':
              iconName = focused ? 'restaurant' : 'restaurant-outline';
              break;
            case 'ActiveOrder':
              iconName = focused ? 'bicycle' : 'bicycle-outline';
              break;
            case 'History':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'Chats':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 60 + (insets.bottom || 0) : 85,
          paddingBottom: Platform.OS === 'android' ? (insets.bottom || 10) : 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginBottom: Platform.OS === 'android' ? 0 : 5,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'الطلبات' }} />
      <Tab.Screen name="ActiveOrder" component={ActiveOrderScreen} options={{ title: 'الطلب الحالي' }} />
      <Tab.Screen name="History" component={OrderHistoryScreen} options={{ title: 'السجل' }} />
      <Tab.Screen name="Chats" component={ChatListScreen} options={{ title: 'المحادثات' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'الملف الشخصي' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loadUser, isLoading } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen} 
            options={{ 
              headerShown: true, 
              title: 'الدردشة',
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.text,
              headerBackTitle: 'رجوع',
            }} 
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationsScreen} 
            options={{ 
              headerShown: true, 
              title: 'الإشعارات',
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.text,
            }} 
          />
          <Stack.Screen 
            name="Map" 
            component={MapScreen} 
            options={{ 
              headerShown: true, 
              title: 'الخريطة',
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.text,
            }} 
          />
        </>
      )}
    </Stack.Navigator>
  );
}