import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import Card from '../../components/common/Card';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // محاكاة جلب الإشعارات (سيتم ربطها مع API لاحقاً)
  const loadNotifications = async () => {
    // TODO: استبدال مع API حقيقي
    setTimeout(() => {
      const mockNotifications = [
        {
          id: '1',
          title: 'طلب جديد',
          body: 'لديك طلب جديد من مطعم الأندلس',
          type: 'order',
          read: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'تحديث الطلب',
          body: 'تم تغيير حالة الطلب #12345 إلى جاهز للتوصيل',
          type: 'order',
          read: true,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3',
          title: 'رسالة جديدة',
          body: 'لديك رسالة جديدة من مطعم الأندلس',
          type: 'message',
          read: false,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ];
      setNotifications(mockNotifications);
      setLoading(false);
      setRefreshing(false);
    }, 1000);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const getIcon = (type) => {
    switch (type) {
      case 'order':
        return <Ionicons name="restaurant-outline" size={24} color={colors.primary} />;
      case 'message':
        return <Ionicons name="chatbubble-outline" size={24} color={colors.info} />;
      default:
        return <Ionicons name="notifications-outline" size={24} color={colors.warning} />;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (minutes < 1440) return `منذ ${Math.floor(minutes / 60)} ساعة`;
    return date.toLocaleDateString('ar');
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => markAsRead(item.id)} activeOpacity={0.7}>
      <Card style={[styles.notificationCard, !item.read && styles.unread]}>
        <View style={styles.iconContainer}>{getIcon(item.type)}</View>
        <View style={styles.content}>
          <Text style={[styles.title, !item.read && styles.unreadText]}>
            {item.title}
          </Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={globalStyles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color={colors.textDisabled} />
      <Text style={globalStyles.emptyText}>لا توجد إشعارات</Text>
    </View>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <Header title="الإشعارات" showBack />
        <LoadingOverlay visible={true} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <Header 
        title="الإشعارات" 
        showBack
        rightComponent={
          unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllText}>تحديد الكل كمقروء</Text>
            </TouchableOpacity>
          )
        }
      />
      
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={notifications.length === 0 && styles.emptyList}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emptyList: {
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: 16,
  },
  unread: {
    backgroundColor: colors.primaryLight + '20',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.body1,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 4,
  },
  unreadText: {
    color: colors.text,
  },
  body: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  time: {
    fontSize: typography.caption,
    color: colors.textDisabled,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  markAllText: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: typography.medium,
  },
});