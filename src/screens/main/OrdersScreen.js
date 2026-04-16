import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const { width, height } = Dimensions.get('window');

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
  const [flatListKey, setFlatListKey] = useState(0);
  const { isOnline, toggleOnlineStatus, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const switchAnim = useRef(new Animated.Value(isOnline ? 1 : 0)).current;

  useEffect(() => {
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

  useEffect(() => {
    setFlatListKey(prev => prev + 1);
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
        
        // ✅ إذا كان هناك طلب نشط ولم نكن في صفحة الطلب الحالي، ننتقل إليه
        if (activeOrderResult) {
          const currentRoute = navigation.getState()?.routes[navigation.getState().index]?.name;
          if (currentRoute !== 'ActiveOrder') {
            // نعرض إشعار بأن هناك طلب نشط
            console.log('📢 Active order exists:', activeOrderResult.id);
          }
        }
      } catch (activeError) {
        console.log('No active order or error fetching:', activeError?.message);
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
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  useEffect(() => {
    const initSocket = async () => {
      if (isOnline) {
        await connectSocket();
        
        onEvent('driver:new-order', (data) => {
          loadOrders();
          
          const storeName = data?.storeName || data?.store?.name || 'متجر';
          sendLocalNotification(
            'طلب جديد',
            `لديك طلب جديد من ${storeName}`,
            { orderId: data?.orderId || data?._id }
          );
        });
        
        onEvent('driver:status:changed', (data) => {
          loadOrders();
        });
        
        onEvent('driver:available:orders:refresh', () => {
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
      offEvent('driver:available:orders:refresh');
      offEvent('order:status:updated');
    };
  }, [isOnline, loadOrders, activeOrder]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
  }, [loadOrders]);

  const handleAccept = async (orderId) => {
    setProcessingId(orderId);
    try {
      const result = await DriverService.acceptOrder(orderId);
      
      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        const acceptedOrderData = availableOrders.find(order => 
          (order.id === orderId || order._id === orderId)
        );
        
        Alert.alert('نجاح', 'تم قبول الطلب بنجاح');
        
        // ✅ إعادة تحميل الطلبات
        await loadOrders();
        
        // ✅ التنقل إلى صفحة الطلب الحالي
        if (acceptedOrderData) {
          navigation.navigate('ActiveOrder', { 
            order: acceptedOrderData 
          });
        }
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
    if (isToggling) return;
    
    setIsToggling(true);
    setShowStatusModal(true);
    setStatusModalMessage(isOnline ? 'جاري إيقاف الاستقبال...' : 'جاري تفعيل الاستقبال...');
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {}

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
      }, 800);
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

  const StatusChangeModal = () => (
    <Modal
      transparent
      visible={showStatusModal}
      animationType="fade"
      onRequestClose={() => setShowStatusModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.modalText}>{statusModalMessage}</Text>
        </View>
      </View>
    </Modal>
  );

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
            <View style={styles.activeOrderPrice}>
              <Text style={styles.activeOrderPriceValue}>{activeOrder.totalPrice || 0} د.ع</Text>
            </View>
            <View style={styles.activeOrderStatus}>
              <OrderStatusBadge status={activeOrder.status} size="small" />
            </View>
          </View>
          
          <View style={styles.activeOrderButton}>
            <Text style={styles.activeOrderButtonText}>تابع الطلب →</Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const EmptyStateComponent = () => (
    <View style={styles.emptyContainer}>
      <Animated.View
        style={[
          styles.emptyContent,
          {
            opacity: pulseAnim.interpolate({
              inputRange: [1, 1.2],
              outputRange: [1, 0.8],
            }),
          }
        ]}
      >
        <Ionicons
          name={isOnline ? "bicycle" : "fast-food-outline"}
          size={80}
          color={isOnline ? colors.primary : colors.textDisabled}
        />
        <Text style={[styles.emptyTitle, isOnline ? styles.emptyTitleOnline : styles.emptyTitleOffline]}>
          {isOnline ? '✨ جاهز للاستلام ✨' : '⚠️ غير متصل'}
        </Text>
        <Text style={styles.emptySubtext}>
          {isOnline
            ? 'الطلبات الجديدة ستظهر هنا تلقائياً'
            : 'فعّل حالة الاستقبال لتبدأ باستلام الطلبات'}
        </Text>
        {!isOnline && (
          <TouchableOpacity
            style={styles.enableButton}
            onPress={handleToggleOnline}
            activeOpacity={0.8}
          >
            <Ionicons name="power" size={20} color={colors.surface} />
            <Text style={styles.enableButtonText}>تفعيل الاستقبال</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );

  const StatusToggleButton = () => (
    <TouchableOpacity
      style={[
        styles.statusToggleButton,
        isOnline ? styles.statusToggleOnline : styles.statusToggleOffline,
      ]}
      onPress={handleToggleOnline}
      disabled={isToggling}
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
      <View style={styles.statusToggleIcons}>
        <Ionicons
          name="checkmark-circle"
          size={18}
          color={isOnline ? colors.surface : colors.textDisabled}
          style={styles.statusToggleIconLeft}
        />
        <Ionicons
          name="close-circle"
          size={18}
          color={!isOnline ? colors.surface : colors.textDisabled}
          style={styles.statusToggleIconRight}
        />
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={[styles.statusCard, isOnline && styles.statusCardOnline]}>
        <View style={styles.statusInfo}>
          <Animated.View
            style={[
              styles.statusDotContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View style={[styles.statusDot, isOnline && styles.onlineDot]} />
          </Animated.View>
          <View>
            <Text style={styles.statusLabel}>حالة الاستقبال</Text>
            <Text style={[styles.statusValue, isOnline ? styles.onlineText : styles.offlineText]}>
              {isOnline ? 'متصل · جاهز للطلبات' : 'غير متصل · غير متاح'}
            </Text>
          </View>
        </View>
        <StatusToggleButton />
      </View>

      <View style={styles.driverCard}>
        <View style={[styles.driverAvatar, isOnline && styles.driverAvatarOnline]}>
          <Text style={styles.driverAvatarText}>{user?.name?.charAt(0) || 'م'}</Text>
          {isOnline && (
            <View style={styles.onlineBadge}>
              <Ionicons name="checkmark" size={10} color={colors.surface} />
            </View>
          )}
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{user?.name || 'مندوب'}</Text>
          <Text style={styles.driverPhone}>{user?.phone}</Text>
        </View>
        <View style={[styles.statsBadge, isOnline && styles.statsBadgeOnline]}>
          <Text style={styles.statsNumber}>{availableOrders.length}</Text>
          <Text style={styles.statsLabel}>طلب جديد</Text>
        </View>
      </View>

      {/* ✅ عرض الطلب النشط إن وجد */}
      <ActiveOrderCard />

      {isOnline && availableOrders.length > 0 && !activeOrder && (
        <View style={styles.ordersInfoCard}>
          <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
          <Text style={styles.ordersInfoText}>
            {availableOrders.length} {availableOrders.length === 1 ? 'طلب جديد' : 'طلبات جديدة'} في انتظارك
          </Text>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item }) => {
    const orderId = item._id || item.id;

    const orderForCard = {
      ...item,
      id: orderId,
      _id: orderId,
    };

    return (
      <OrderCard
        order={orderForCard}
        onAccept={() => handleAccept(orderId)}
        onReject={() => handleReject(orderId)}
        isProcessing={processingId === orderId}
      />
    );
  };

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
      
      <StatusChangeModal />

      <FlatList
        key={flatListKey}
        ref={flatListRef}
        data={availableOrders}
        keyExtractor={(item) => (item._id || item.id || Math.random().toString())}
        ListHeaderComponent={renderHeader}
        renderItem={renderItem}
        ListEmptyComponent={!activeOrder ? EmptyStateComponent : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            enabled={isOnline}
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

const Card = ({ children, style, onPress }) => {
  const Content = onPress ? TouchableOpacity : View;
  return (
    <Content style={[styles.card, style]} onPress={onPress} activeOpacity={0.7}>
      {children}
    </Content>
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  headerSection: {
    marginBottom: 16,
  },
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
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  statusCardOnline: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surface,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDotContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.offline,
  },
  onlineDot: {
    backgroundColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  statusLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  statusValue: {
    fontSize: typography.body2,
    fontWeight: typography.bold,
  },
  onlineText: {
    color: colors.success,
  },
  offlineText: {
    color: colors.danger,
  },
  statusToggleButton: {
    width: 60,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  statusToggleOnline: {
    backgroundColor: colors.success,
  },
  statusToggleOffline: {
    backgroundColor: colors.danger,
  },
  statusToggleInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    position: 'absolute',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusToggleIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  statusToggleIconLeft: {
    opacity: 0.8,
  },
  statusToggleIconRight: {
    opacity: 0.8,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  driverAvatarOnline: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  driverAvatarText: {
    fontSize: typography.h4,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: typography.body1,
    fontWeight: typography.bold,
    color: colors.text,
  },
  driverPhone: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: 'center',
    minWidth: 70,
  },
  statsBadgeOnline: {
    backgroundColor: colors.primaryLight,
  },
  statsNumber: {
    fontSize: typography.h5,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  statsLabel: {
    fontSize: typography.caption,
    color: colors.primary,
  },
  ordersInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primaryLight + '10',
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginTop: 0,
    marginBottom: 12,
  },
  ordersInfoText: {
    fontSize: typography.body2,
    color: colors.primary,
    fontWeight: typography.medium,
    flex: 1,
  },
  activeOrderCard: {
    marginBottom: 16,
    backgroundColor: colors.primaryLight + '15',
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  activeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeOrderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  activeOrderBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: colors.surface,
  },
  activeOrderId: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  activeOrderStore: {
    fontSize: typography.body1,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 8,
  },
  activeOrderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeOrderPrice: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeOrderPriceValue: {
    fontSize: typography.h6,
    fontWeight: typography.bold,
    color: colors.success,
  },
  activeOrderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeOrderButton: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    alignItems: 'flex-end',
  },
  activeOrderButtonText: {
    fontSize: typography.body2,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyTitleOnline: {
    color: colors.primary,
  },
  emptyTitleOffline: {
    color: colors.textDisabled,
  },
  emptySubtext: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  enableButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  enableButtonText: {
    color: colors.surface,
    fontSize: typography.body1,
    fontWeight: typography.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalText: {
    fontSize: typography.body1,
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  initialLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  initialLoadingText: {
    fontSize: typography.body1,
    color: colors.textSecondary,
    marginTop: 16,
  },
});