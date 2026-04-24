// src/screens/main/OrdersScreen.js - النسخة النهائية (زر واحد فقط)

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import OrderCard from '../../components/orders/OrderCard';
import Header from '../../components/common/Header';
import DriverService from '../../api/driverService';
import { connectSocket, onEvent, offEvent } from '../../api/socket';
import { sendLocalNotification } from '../../utils/notifications';
import useAuthStore from '../../store/authStore';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';
import OrderStatusBadge from '../../components/orders/OrderStatusBadge';

export default function OrdersScreen() {
  const navigation = useNavigation();
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalMessage, setStatusModalMessage] = useState('');
  const [accountStatus, setAccountStatus] = useState({ isActive: true, isVerified: false });
  
  // ✅ من useAuthStore - نأخذ isOnline فقط (زر الاتصال)
  const { isOnline, toggleOnlineStatus, user } = useAuthStore();
  
  const flatListRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const switchAnim = useRef(new Animated.Value(isOnline ? 1 : 0)).current;

  // ✅ حالة استقبال الطلبات (تتغير تلقائياً حسب وجود طلب جاري)
  const canAcceptOrders = !activeOrder && isOnline;

  // ✅ التحقق من حالة الحساب
  const checkAccountStatus = async () => {
    const status = await DriverService.checkAccountStatus();
    setAccountStatus(status);

    if (!status.isActive) {
      Alert.alert('تنبيه', 'حسابك غير نشط. يرجى التواصل مع الدعم الفني.');
    }
  };

  // ✅ تحديث حالة التوفر في الباك اند بناءً على وجود طلب جاري
  const updateDriverAvailability = useCallback(async () => {
    if (!accountStatus.isActive) return;
    
    // إذا كان متصلاً وليس لديه طلب جاري → متاح
    // إذا كان متصلاً ولديه طلب جاري → غير متاح
    // إذا كان غير متصل → غير متاح
    const shouldBeAvailable = isOnline && !activeOrder;
    
    console.log('🔄 Updating driver availability:', {
      isOnline,
      hasActiveOrder: !!activeOrder,
      shouldBeAvailable
    });
    
    // ✅ تحديث حالة التوفر في الباك اند
    await DriverService.toggleAvailability(shouldBeAvailable);
  }, [isOnline, activeOrder, accountStatus.isActive]);

  // ✅ عندما يتغير activeOrder أو isOnline، نحدث حالة التوفر
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
      // 1. جلب الطلبات المتاحة
      const availableResult = await DriverService.getAvailableOrders();
      setAvailableOrders(availableResult.orders || []);

      // 2. جلب الطلب النشط للمندوب
      try {
        const activeOrderResult = await DriverService.getActiveOrder();
        setActiveOrder(activeOrderResult);
      } catch (activeError) {
        console.log('No active order:', activeError?.message);
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
  }, []);

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
          sendLocalNotification('طلب جديد', `لديك طلب جديد`, { orderId: data?.orderId });
        });

        onEvent('driver:status:changed', () => {
          loadOrders();
        });

        onEvent('order:status:updated', (data) => {
          if (data.orderId === activeOrder?.id || data.orderId === activeOrder?._id) {
            loadOrders();
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
  }, [isOnline, loadOrders, activeOrder, accountStatus.isActive]);

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

  // ✅ تبديل حالة الاتصال فقط (الزر الرئيسي الوحيد)
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

  // ✅ عرض الطلب النشط
  const ActiveOrderCard = () => {
    if (!activeOrder) return null;

    const orderId = activeOrder.id || activeOrder._id;
    const displayOrderId = orderId?.slice(-8) || '00000000';

    return (
      <TouchableOpacity onPress={goToActiveOrder} activeOpacity={0.8}>
        <Card style={styles.activeOrderCard}>
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
        </Card>
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.statusToggleText}>
          {isOnline ? '🟢 متصل' : '🔴 غير متصل'}
        </Text>
      </View>
    </TouchableOpacity>
  );

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

      {/* ✅ بطاقة حالة استقبال الطلبات (للإعلام فقط) */}
      <View style={[styles.availabilityCard, canAcceptOrders ? styles.availabilityCardActive : styles.availabilityCardInactive]}>
        <Ionicons 
          name={canAcceptOrders ? "checkmark-circle" : "close-circle"} 
          size={24} 
          color={canAcceptOrders ? colors.success : colors.danger} 
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.availabilityLabel}>حالة استقبال الطلبات</Text>
          <Text style={[styles.availabilityValue, canAcceptOrders ? styles.availabilityActive : styles.availabilityInactive]}>
            {!isOnline ? 'غير متاح (غير متصل)' : 
             (activeOrder ? 'غير متاح (لديك طلب جاري)' : 'متاح ✅')}
          </Text>
        </View>
      </View>

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
        <Header title="الطلبات" showNotification />
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.initialLoadingText}>جاري تحميل الطلبات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea} edges={['top']}>
      <Header title="الطلبات" showNotification />
      
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

// ✅ حالة فارغة
const EmptyStateComponent = () => (
  <View style={styles.emptyContainer}>
    <Ionicons name="bicycle-outline" size={80} color={colors.textDisabled} />
    <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
    <Text style={styles.emptySubtext}>عند توفر طلبات جديدة، ستظهر هنا تلقائياً</Text>
  </View>
);

const Card = ({ children, style, onPress }) => {
  const Content = onPress ? TouchableOpacity : View;
  return (
    <Content style={[styles.card, style]} onPress={onPress} activeOpacity={0.7}>
      {children}
    </Content>
  );
};

const styles = StyleSheet.create({
  listContent: { padding: 16 },
  emptyListContent: { flex: 1, justifyContent: 'center' },
  headerSection: { marginBottom: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  
  // بطاقة حالة الاتصال
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  statusCardOnline: { borderColor: colors.primaryLight },
  statusInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDotContainer: { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.offline },
  onlineDot: { backgroundColor: colors.success, shadowColor: colors.success, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 2 },
  statusLabel: { fontSize: typography.caption, color: colors.textSecondary },
  statusValue: { fontSize: typography.body2, fontWeight: typography.bold },
  onlineText: { color: colors.success },
  offlineText: { color: colors.danger },
  
  // زر التبديل
  statusToggleButton: {
    width: 100,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  statusToggleOnline: { backgroundColor: colors.success },
  statusToggleOffline: { backgroundColor: colors.danger },
  statusToggleInner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusToggleTextContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusToggleText: { fontSize: typography.body2, fontWeight: typography.bold, color: colors.surface },
  
  // ✅ بطاقة حالة استقبال الطلبات
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  availabilityCardActive: { backgroundColor: colors.success + '15', borderWidth: 1, borderColor: colors.success },
  availabilityCardInactive: { backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger },
  availabilityLabel: { fontSize: typography.caption, color: colors.textSecondary },
  availabilityValue: { fontSize: typography.body2, fontWeight: typography.bold },
  availabilityActive: { color: colors.success },
  availabilityInactive: { color: colors.danger },
  
  driverCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  driverAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative' },
  driverAvatarOnline: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  driverAvatarText: { fontSize: typography.h4, fontWeight: typography.bold, color: colors.primary },
  onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.surface },
  driverInfo: { flex: 1 },
  driverName: { fontSize: typography.body1, fontWeight: typography.bold, color: colors.text },
  driverPhone: { fontSize: typography.caption, color: colors.textSecondary, marginTop: 2 },
  statsBadge: { backgroundColor: colors.surfaceVariant, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, alignItems: 'center', minWidth: 70 },
  statsNumber: { fontSize: typography.h5, fontWeight: typography.bold, color: colors.primary },
  statsLabel: { fontSize: typography.caption, color: colors.primary },
  
  // الطلب النشط
  activeOrderCard: { marginBottom: 16, backgroundColor: colors.primaryLight + '15', borderWidth: 1, borderColor: colors.primaryLight },
  activeOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeOrderBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  activeOrderBadgeText: { fontSize: typography.caption, fontWeight: typography.bold, color: colors.surface },
  activeOrderId: { fontSize: typography.caption, color: colors.textSecondary },
  activeOrderStore: { fontSize: typography.body1, fontWeight: typography.bold, color: colors.text, marginBottom: 8 },
  activeOrderDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activeOrderPriceValue: { fontSize: typography.h6, fontWeight: typography.bold, color: colors.success },
  activeOrderButton: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: 'flex-end' },
  activeOrderButtonText: { fontSize: typography.body2, color: colors.primary, fontWeight: typography.medium },
  
  ordersInfoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primaryLight + '10', borderWidth: 1, borderColor: colors.primaryLight, padding: 12, borderRadius: 12, marginBottom: 12 },
  ordersInfoText: { fontSize: typography.body2, color: colors.primary, fontWeight: typography.medium, flex: 1 },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textDisabled, marginTop: 20, marginBottom: 8 },
  emptySubtext: { fontSize: typography.body2, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.surface, borderRadius: 20, padding: 32, alignItems: 'center', minWidth: 200, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  modalText: { fontSize: typography.body1, color: colors.text, marginTop: 16, textAlign: 'center' },
  
  initialLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  initialLoadingText: { fontSize: typography.body1, color: colors.textSecondary, marginTop: 16 },
});