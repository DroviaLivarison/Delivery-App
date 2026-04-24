// src/screens/main/OrdersScreen.js - النسخة النهائية مع الإشعارات والتحسينات

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import OrderCard from '../../components/orders/OrderCard';
import Header from '../../components/common/Header';
import DriverService from '../../api/driverService';
import { connectSocket, onEvent, offEvent } from '../../api/socket';
import useNotification from '../../hooks/useNotification';
import useAuthStore from '../../store/authStore';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';
import OrderStatusBadge from '../../components/orders/OrderStatusBadge';

const { width } = Dimensions.get('window');

export default function OrdersScreen() {
  const navigation = useNavigation();
  const { sendLocalNotification, updateBadgeCount } = useNotification();
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalMessage, setStatusModalMessage] = useState('');
  const [accountStatus, setAccountStatus] = useState({ isActive: true, isVerified: false });
  const [notificationCount, setNotificationCount] = useState(0);
  
  const { isOnline, toggleOnlineStatus, user } = useAuthStore();
  
  const flatListRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const switchAnim = useRef(new Animated.Value(isOnline ? 1 : 0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const canAcceptOrders = !activeOrder && isOnline;

  // ✅ تأثير التوهج للزر
  useEffect(() => {
    if (canAcceptOrders && availableOrders.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [canAcceptOrders, availableOrders.length]);

  const checkAccountStatus = async () => {
    const status = await DriverService.checkAccountStatus();
    setAccountStatus(status);
    if (!status.isActive) {
      Alert.alert('تنبيه', 'حسابك غير نشط. يرجى التواصل مع الدعم الفني.');
    }
  };

  const updateDriverAvailability = useCallback(async () => {
    if (!accountStatus.isActive) return;
    const shouldBeAvailable = isOnline && !activeOrder;
    await DriverService.toggleAvailability(shouldBeAvailable);
  }, [isOnline, activeOrder, accountStatus.isActive]);

  useEffect(() => {
    updateDriverAvailability();
  }, [activeOrder, isOnline, updateDriverAvailability]);

  useEffect(() => {
    const initDriver = async () => {
      await checkAccountStatus();
      await loadOrders();
    };

    initDriver();

    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline]);

  const loadOrders = useCallback(async () => {
    try {
      const availableResult = await DriverService.getAvailableOrders();
      setAvailableOrders(availableResult.orders || []);
      setNotificationCount(availableResult.orders?.length || 0);
      await updateBadgeCount(availableResult.orders?.length || 0);

      try {
        const activeOrderResult = await DriverService.getActiveOrder();
        setActiveOrder(activeOrderResult);
      } catch (activeError) {
        setActiveOrder(null);
      }
    } catch (error) {
      console.error('Load orders error:', error);
      setAvailableOrders([]);
      setActiveOrder(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [updateBadgeCount]);

  useFocusEffect(
    useCallback(() => {
      if (accountStatus.isActive) {
        loadOrders();
      }
    }, [loadOrders, accountStatus.isActive])
  );

  useEffect(() => {
    const initSocket = async () => {
      if (isOnline && accountStatus.isActive) {
        await connectSocket();

        onEvent('driver:new-order', (data) => {
          loadOrders();
          sendLocalNotification(
            '🆕 طلب جديد!',
            `لديك طلب جديد بقيمة ${data.totalPrice || 'غير محدد'} د.ع`,
            { type: 'new_order', orderId: data.orderId },
            'orders'
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });

        onEvent('driver:status:changed', () => {
          loadOrders();
        });

        onEvent('order:status:updated', (data) => {
          if (data.orderId === activeOrder?.id || data.orderId === activeOrder?._id) {
            loadOrders();
            sendLocalNotification(
              '📦 تحديث الطلب',
              `تم تحديث حالة الطلب #${data.orderId?.slice(-6)}`,
              { type: 'order_update', orderId: data.orderId },
              'orders'
            );
          }
        });
      }
    };

    initSocket();
    return () => {
      offEvent('driver:new-order');
      offEvent('driver:status:changed');
      offEvent('order:status:updated');
    };
  }, [isOnline, loadOrders, activeOrder, accountStatus.isActive, sendLocalNotification]);

  const onRefresh = useCallback(() => {
    if (accountStatus.isActive) {
      setRefreshing(true);
      loadOrders();
    }
  }, [loadOrders, accountStatus.isActive]);

  const handleAccept = async (orderId) => {
    if (!accountStatus.isActive) {
      Alert.alert('تنبيه', 'حسابك غير نشط');
      return;
    }

    setProcessingId(orderId);
    try {
      const result = await DriverService.acceptOrder(orderId);

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        sendLocalNotification(
          '✅ تم قبول الطلب',
          `تم قبول الطلب #${orderId.slice(-6)} بنجاح`,
          { type: 'order_update', orderId },
          'orders'
        );
        Alert.alert('نجاح', 'تم قبول الطلب بنجاح');
        await loadOrders();
        navigation.navigate('ActiveOrder', { orderId });
      } else {
        Alert.alert('خطأ', result.message || 'فشل قبول الطلب');
      }
    } catch (error) {
      console.error('Accept order error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء قبول الطلب');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (orderId) => {
    if (!accountStatus.isActive) {
      Alert.alert('تنبيه', 'حسابك غير نشط');
      return;
    }

    setProcessingId(orderId);
    try {
      const result = await DriverService.rejectOrder(orderId);

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setAvailableOrders(prev => prev.filter(order =>
          (order.id !== orderId && order._id !== orderId)
        ));
        Alert.alert('تم', 'تم رفض الطلب');
      } else {
        Alert.alert('خطأ', result.message || 'فشل رفض الطلب');
      }
    } catch (error) {
      console.error('Reject order error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء رفض الطلب');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleOnline = async () => {
    if (!accountStatus.isActive) {
      Alert.alert('تنبيه', 'حسابك غير نشط');
      return;
    }
    
    if (isToggling) return;
    
    setIsToggling(true);
    setShowStatusModal(true);
    setStatusModalMessage(isOnline ? 'جاري قطع الاتصال...' : 'جاري الاتصال...');
    
    const success = await toggleOnlineStatus();
    
    if (success) {
      Animated.spring(switchAnim, {
        toValue: isOnline ? 0 : 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
      
      sendLocalNotification(
        isOnline ? '🔴 غير متصل' : '🟢 متصل',
        isOnline ? 'تم قطع الاتصال بنجاح' : 'تم الاتصال بنجاح',
        { type: 'status_change' },
        'default'
      );
      
      setTimeout(async () => {
        await loadOrders();
        setShowStatusModal(false);
      }, 500);
    } else {
      setShowStatusModal(false);
    }
    
    setIsToggling(false);
  };

  const goToActiveOrder = () => {
    if (activeOrder) {
      navigation.navigate('ActiveOrder', { order: activeOrder });
    }
  };

  // ✅ زر تغيير الحالة المحسن
  const StatusToggleButton = () => (
    <TouchableOpacity
      style={[
        styles.statusToggleButton,
        isOnline && accountStatus.isActive ? styles.statusToggleOnline : styles.statusToggleOffline,
      ]}
      onPress={handleToggleOnline}
      disabled={isToggling || !accountStatus.isActive}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.statusToggleInner,
          {
            transform: [{
              translateX: switchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 28],
              }),
            }],
          },
        ]}
      />
      <View style={styles.statusToggleTextContainer}>
        <Animated.Text style={[
          styles.statusToggleText,
          {
            opacity: switchAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 0.5, 1],
            }),
          },
        ]}>
          {isOnline ? '🟢 متصل' : '🔴 غير متصل'}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );

  // ✅ بطاقة الطلب النشط
  const ActiveOrderCard = () => {
    if (!activeOrder) return null;

    const orderId = activeOrder.id || activeOrder._id;
    const displayOrderId = orderId?.slice(-8) || '00000000';

    return (
      <TouchableOpacity onPress={goToActiveOrder} activeOpacity={0.8}>
        <View style={styles.activeOrderCard}>
          <View style={styles.activeOrderHeader}>
            <View style={styles.activeOrderBadge}>
              <Ionicons name="bicycle" size={16} color={colors.surface} />
              <Text style={styles.activeOrderBadgeText}>طلب نشط</Text>
            </View>
            <Text style={styles.activeOrderId}>#{displayOrderId}</Text>
          </View>
          <Text style={styles.activeOrderStore}>{activeOrder.store?.name || 'متجر'}</Text>
          <View style={styles.activeOrderDetails}>
            <Text style={styles.activeOrderPriceValue}>{activeOrder.totalPrice || 0} د.ع</Text>
            <OrderStatusBadge status={activeOrder.status} size="small" />
          </View>
          <View style={styles.activeOrderButton}>
            <Text style={styles.activeOrderButtonText}>تابع الطلب →</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ✅ رأس القائمة
  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* بطاقة حالة الاتصال */}
      <View style={[styles.statusCard, (isOnline && accountStatus.isActive) && styles.statusCardOnline]}>
        <View style={styles.statusInfo}>
          <Animated.View style={[styles.statusDotContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.statusDot, (isOnline && accountStatus.isActive) && styles.onlineDot]} />
          </Animated.View>
          <View>
            <Text style={styles.statusLabel}>حالة المندوب</Text>
            <Text style={[styles.statusValue, (isOnline && accountStatus.isActive) ? styles.onlineText : styles.offlineText]}>
              {!accountStatus.isActive ? 'الحساب غير نشط' : (isOnline ? 'متصل وجاهز' : 'غير متصل')}
            </Text>
          </View>
        </View>
        <StatusToggleButton />
      </View>

      {/* بطاقة حالة استقبال الطلبات */}
      <Animated.View style={[
        styles.availabilityCard,
        canAcceptOrders ? styles.availabilityCardActive : styles.availabilityCardInactive,
        canAcceptOrders && availableOrders.length > 0 && {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glowAnim,
          shadowRadius: 10,
          elevation: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 8],
          }),
        },
      ]}>
        <Ionicons 
          name={canAcceptOrders ? "checkmark-circle" : "close-circle"} 
          size={28} 
          color={canAcceptOrders ? colors.success : colors.danger} 
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.availabilityLabel}>حالة استقبال الطلبات</Text>
          <Text style={[styles.availabilityValue, canAcceptOrders ? styles.availabilityActive : styles.availabilityInactive]}>
            {!isOnline ? 'غير متاح (غير متصل)' : 
             (activeOrder ? 'غير متاح (لديك طلب جاري)' : 'متاح ✅')}
          </Text>
        </View>
        {canAcceptOrders && availableOrders.length > 0 && (
          <View style={styles.newOrdersBadge}>
            <Text style={styles.newOrdersBadgeText}>{availableOrders.length}</Text>
          </View>
        )}
      </Animated.View>

      {/* بطاقة المندوب */}
      <View style={styles.driverCard}>
        <View style={[styles.driverAvatar, (isOnline && accountStatus.isActive) && styles.driverAvatarOnline]}>
          <Text style={styles.driverAvatarText}>{user?.name?.charAt(0) || 'م'}</Text>
          {(isOnline && accountStatus.isActive) && (
            <View style={styles.onlineBadge}>
              <Ionicons name="checkmark" size={10} color={colors.surface} />
            </View>
          )}
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{user?.name || 'مندوب'}</Text>
          <Text style={styles.driverPhone}>{user?.phone}</Text>
        </View>
        <View style={styles.statsBadge}>
          <Text style={styles.statsNumber}>{availableOrders.length}</Text>
          <Text style={styles.statsLabel}>طلب جديد</Text>
        </View>
      </View>

      {/* الطلب النشط */}
      <ActiveOrderCard />

      {/* إشعار الطلبات المتاحة */}
      {(canAcceptOrders && availableOrders.length > 0 && !activeOrder) && (
        <View style={styles.ordersInfoCard}>
          <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
          <Text style={styles.ordersInfoText}>
            {availableOrders.length} طلب جديد في انتظارك
          </Text>
          <TouchableOpacity onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}>
            <Ionicons name="arrow-down" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item }) => (
    <OrderCard
      order={{ ...item, id: item._id }}
      onAccept={() => handleAccept(item._id)}
      onReject={() => handleReject(item._id)}
      isProcessing={processingId === item._id}
    />
  );

  if (loading && availableOrders.length === 0 && !activeOrder) {
    return (
      <SafeAreaView style={globalStyles.safeArea} edges={['top']}>
        <Header title="الطلبات" showNotification notificationCount={notificationCount} />
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.initialLoadingText}>جاري تحميل الطلبات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea} edges={['top']}>
      <Header title="الطلبات" showNotification notificationCount={notificationCount} />
      
      {/* مودال التحميل */}
      <Modal transparent visible={showStatusModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.modalText}>{statusModalMessage}</Text>
          </View>
        </View>
      </Modal>
      
      <FlatList
        ref={flatListRef}
        data={availableOrders}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        ListHeaderComponent={renderHeader}
        renderItem={renderItem}
        ListEmptyComponent={!activeOrder ? EmptyStateComponent : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            enabled={accountStatus.isActive}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          availableOrders.length === 0 && !activeOrder && styles.emptyListContent
        ]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ✅ حالة فارغة محسنة
const EmptyStateComponent = () => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconContainer}>
      <Ionicons name="bicycle-outline" size={64} color={colors.textDisabled} />
    </View>
    <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
    <Text style={styles.emptySubtext}>عند توفر طلبات جديدة، ستظهر هنا تلقائياً</Text>
  </View>
);

const styles = StyleSheet.create({
  listContent: { padding: 16 },
  emptyListContent: { flex: 1, justifyContent: 'center' },
  headerSection: { marginBottom: 16 },
  
  // بطاقة حالة الاتصال
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusCardOnline: { borderColor: colors.primaryLight },
  statusInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDotContainer: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statusDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.offline },
  onlineDot: { backgroundColor: colors.success, shadowColor: colors.success, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6, elevation: 3 },
  statusLabel: { fontSize: typography.caption, color: colors.textSecondary },
  statusValue: { fontSize: typography.body2, fontWeight: typography.bold },
  onlineText: { color: colors.success },
  offlineText: { color: colors.danger },
  
  // زر التبديل المحسن
  statusToggleButton: {
    width: 110,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statusToggleOnline: { backgroundColor: colors.success },
  statusToggleOffline: { backgroundColor: colors.danger },
  statusToggleInner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  statusToggleTextContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusToggleText: { fontSize: typography.body2, fontWeight: typography.bold, color: colors.surface },
  
  // بطاقة حالة استقبال الطلبات
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  availabilityCardActive: { backgroundColor: colors.success + '10', borderWidth: 1, borderColor: colors.success },
  availabilityCardInactive: { backgroundColor: colors.danger + '10', borderWidth: 1, borderColor: colors.danger },
  availabilityLabel: { fontSize: typography.caption, color: colors.textSecondary },
  availabilityValue: { fontSize: typography.body2, fontWeight: typography.bold },
  availabilityActive: { color: colors.success },
  availabilityInactive: { color: colors.danger },
  newOrdersBadge: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  newOrdersBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: colors.surface,
  },
  
  // بطاقة المندوب
  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  driverAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative' },
  driverAvatarOnline: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  driverAvatarText: { fontSize: typography.h4, fontWeight: typography.bold, color: colors.primary },
  driverAvatarOnlineText: { color: colors.surface },
  onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.surface },
  driverInfo: { flex: 1 },
  driverName: { fontSize: typography.body1, fontWeight: typography.bold, color: colors.text },
  driverPhone: { fontSize: typography.caption, color: colors.textSecondary, marginTop: 2 },
  statsBadge: { backgroundColor: colors.surfaceVariant, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, alignItems: 'center', minWidth: 70 },
  statsNumber: { fontSize: typography.h5, fontWeight: typography.bold, color: colors.primary },
  statsLabel: { fontSize: typography.caption, color: colors.primary },
  
  // الطلب النشط
  activeOrderCard: { backgroundColor: colors.primaryLight + '10', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.primaryLight },
  activeOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeOrderBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, gap: 6 },
  activeOrderBadgeText: { fontSize: typography.caption, fontWeight: typography.bold, color: colors.surface },
  activeOrderId: { fontSize: typography.caption, color: colors.textSecondary },
  activeOrderStore: { fontSize: typography.body1, fontWeight: typography.bold, color: colors.text, marginBottom: 8 },
  activeOrderDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activeOrderPriceValue: { fontSize: typography.h6, fontWeight: typography.bold, color: colors.success },
  activeOrderButton: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: 'flex-end' },
  activeOrderButtonText: { fontSize: typography.body2, color: colors.primary, fontWeight: typography.medium },
  
  // إشعار الطلبات
  ordersInfoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primaryLight + '10', borderWidth: 1, borderColor: colors.primaryLight, padding: 14, borderRadius: 16, marginBottom: 12 },
  ordersInfoText: { fontSize: typography.body2, color: colors.primary, fontWeight: typography.medium, flex: 1 },
  
  // حالة فارغة
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 60 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: typography.bold, color: colors.textDisabled, marginBottom: 8 },
  emptySubtext: { fontSize: typography.body2, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
  
  // مودال
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.surface, borderRadius: 24, padding: 32, alignItems: 'center', minWidth: 200, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  modalText: { fontSize: typography.body1, color: colors.text, marginTop: 16, textAlign: 'center' },
  
  // تحميل أولي
  initialLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  initialLoadingText: { fontSize: typography.body1, color: colors.textSecondary, marginTop: 16 },
});