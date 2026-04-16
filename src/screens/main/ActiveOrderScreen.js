import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import OrderStatusBadge from '../../components/orders/OrderStatusBadge';
import DriverService from '../../api/driverService';
import { emitEvent, getSocket } from '../../api/socket';
import useLocation from '../../hooks/useLocation';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';
import { ORDER_STATUS, ORDER_STATUS_AR } from '../../utils/constants';

export default function ActiveOrderScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const [order, setOrder] = useState(route?.params?.order || null);
  const [loading, setLoading] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(ORDER_STATUS.PENDING);
  const { updateLocationToServer, currentLocation } = useLocation(true, 10000);

  const orderId = order?.id || order?._id || route?.params?.orderId;

  // جلب بيانات الطلب إذا تم تمرير orderId فقط
  useEffect(() => {
    const fetchOrderIfNeeded = async () => {
      const passedOrder = route?.params?.order;
      const passedOrderId = route?.params?.orderId;

      if (passedOrder) {
        setOrder(passedOrder);
        setCurrentStatus(passedOrder.status || ORDER_STATUS.PENDING);
        return;
      }

      if (passedOrderId && !passedOrder) {
        setLoadingOrder(true);
        try {
          const fetchedOrder = await DriverService.getOrderDetails(passedOrderId);
          if (fetchedOrder) {
            setOrder(fetchedOrder);
            setCurrentStatus(fetchedOrder.status || ORDER_STATUS.PENDING);
          } else {
            Alert.alert('خطأ', 'لم يتم العثور على الطلب');
            navigation.goBack();
          }
        } catch (error) {
          console.error('Error fetching order:', error);
          Alert.alert('خطأ', 'حدث خطأ أثناء جلب بيانات الطلب');
          navigation.goBack();
        } finally {
          setLoadingOrder(false);
        }
      }
    };

    fetchOrderIfNeeded();
  }, [route?.params]);

  const statusSteps = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.READY,
    ORDER_STATUS.PICKED,
    ORDER_STATUS.DELIVERED,
  ];
  const currentStepIndex = statusSteps.indexOf(currentStatus);

  // ✅ الدالة المعدلة بالكامل لتحديث الحالة
  const updateStatus = async (newStatus) => {
    if (!orderId) {
      Alert.alert('خطأ', 'معرف الطلب غير موجود');
      return;
    }

    if (newStatus === currentStatus) {
      console.log('⚠️ Skipping status update - same status:', newStatus);
      Alert.alert('تنبيه', 'الطلب بالفعل في هذه الحالة');
      return;
    }

    setLoading(true);

    // ✅ الحصول على الموقع الحالي إذا كان متاحاً
    let locationData = null;
    try {
      const locationResult = await updateLocationToServer();
      if (locationResult?.success && currentLocation) {
        locationData = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        };
        console.log('📍 Current location for status update:', locationData);
      }
    } catch (error) {
      console.log('Location update error (non-critical):', error);
    }

    let result;

    try {
      // ✅ إرسال طلب تحديث الحالة مع الموقع إذا كان متاحاً
      if (newStatus === ORDER_STATUS.READY) {
        result = await DriverService.updateOrderStatus(orderId, 'ready', locationData);
      } else if (newStatus === ORDER_STATUS.PICKED) {
        result = await DriverService.updateOrderStatus(orderId, 'picked', locationData);
      } else if (newStatus === ORDER_STATUS.DELIVERED) {
        result = await DriverService.updateOrderStatus(orderId, 'delivered', locationData);
      } else {
        result = await DriverService.updateOrderStatus(orderId, newStatus, locationData);
      }
    } catch (error) {
      console.error('API Error:', error);
      result = { success: false, message: error.message || 'حدث خطأ في الاتصال' };
    }

    if (result.success) {
      setCurrentStatus(newStatus);

      if (order) {
        setOrder({ ...order, status: newStatus });
      }

      const socket = getSocket();
      if (socket && socket.connected) {
        emitEvent('order:status:updated', {
          orderId: orderId,
          status: newStatus,
          location: locationData,
          timestamp: new Date().toISOString(),
        });
      }

      if (newStatus === ORDER_STATUS.DELIVERED) {
        Alert.alert('نجاح', 'تم تسليم الطلب بنجاح');
        navigation.goBack();
      } else {
        Alert.alert('تم', 'تم تحديث حالة الطلب');
      }
    } else {
      Alert.alert('خطأ', result.message || 'فشل تحديث حالة الطلب');
    }

    setLoading(false);
  };

  const handleStartDelivery = async () => {
    if (!orderId) {
      Alert.alert('خطأ', 'معرف الطلب غير موجود');
      return;
    }

    if (currentStatus !== ORDER_STATUS.READY) {
      Alert.alert('تنبيه', 'لا يمكن بدء التوصيل إلا بعد أن يصبح الطلب جاهزاً');
      return;
    }

    setLoading(true);

    // ✅ الحصول على الموقع الحالي
    let locationData = null;
    try {
      const locationResult = await updateLocationToServer();
      if (locationResult?.success && currentLocation) {
        locationData = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        };
      }
    } catch (error) {
      console.log('Location update error (non-critical):', error);
    }

    const result = await DriverService.updateOrderStatus(orderId, 'picked', locationData);
    setLoading(false);

    if (result.success) {
      setCurrentStatus(ORDER_STATUS.PICKED);
      if (order) {
        setOrder({ ...order, status: ORDER_STATUS.PICKED });
      }
      Alert.alert('نجاح', 'تم بدء التوصيل');
    } else {
      Alert.alert('خطأ', result.message);
    }
  };

  const handleCancelOrder = () => {
    if (!orderId) {
      Alert.alert('خطأ', 'معرف الطلب غير موجود');
      return;
    }

    if (currentStatus === ORDER_STATUS.DELIVERED) {
      Alert.alert('تنبيه', 'لا يمكن إلغاء طلب تم تسليمه');
      return;
    }

    Alert.alert(
      'إلغاء الطلب',
      'هل أنت متأكد من إلغاء هذا الطلب؟',
      [
        { text: 'لا', style: 'cancel' },
        {
          text: 'نعم، إلغاء',
          onPress: async () => {
            setLoading(true);
            const result = await DriverService.updateOrderStatus(orderId, ORDER_STATUS.CANCELLED);
            setLoading(false);
            if (result.success) {
              Alert.alert('تم', 'تم إلغاء الطلب');
              navigation.goBack();
            } else {
              Alert.alert('خطأ', result.message);
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

const getNextAction = () => {
  switch (currentStatus) {
    case ORDER_STATUS.PENDING:
      return { title: '✅ قبول الطلب', action: () => updateStatus(ORDER_STATUS.ACCEPTED) };
    case ORDER_STATUS.ACCEPTED:
      // ✅ في حالة ACCEPTED، المندوب ينتظر المتجر ليغير الحالة إلى READY
      return { 
        title: '⏳ جاري تجهيز الطلب', 
        action: null, 
        disabled: true,
        note: 'الطلب قيد التحضير من قبل المتجر'
      };
    case ORDER_STATUS.READY:
      return { title: '🚚 بدء التوصيل', action: handleStartDelivery };
    case ORDER_STATUS.PICKED:
      return { title: '📦 تم التوصيل', action: () => updateStatus(ORDER_STATUS.DELIVERED) };
    default:
      return null;
  }
};
  if (loadingOrder) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <Header title="الطلب الحالي" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل بيانات الطلب...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <Header title="الطلب الحالي" showBack />
        <View style={globalStyles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🚚</Text>
          <Text style={globalStyles.emptyText}>لا يوجد طلب نشط حالياً</Text>
        </View>
      </SafeAreaView>
    );
  }

  const nextAction = getNextAction();
  const isCompleted = currentStatus === ORDER_STATUS.DELIVERED;
  const isCancelled = currentStatus === ORDER_STATUS.CANCELLED;
  const displayOrderId = orderId?.slice(-8) || '00000000';

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <LoadingOverlay visible={loading} message="جاري التحديث..." />
      <Header title="الطلب الحالي" showBack />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.orderId}>طلب #{displayOrderId}</Text>
            <OrderStatusBadge status={currentStatus} />
          </View>

          <Text style={styles.storeName}>{order.store?.name || 'متجر'}</Text>

          <View style={styles.priceContainer}>
            <Text style={styles.totalPrice}>{order.totalPrice || 0} د.ع</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }
                ]}
              />
            </View>
            <View style={styles.stepsContainer}>
              {statusSteps.map((step, index) => (
                <View key={step} style={styles.stepWrapper}>
                  <View
                    style={[
                      styles.stepDot,
                      index <= currentStepIndex && styles.stepDotActive,
                      index === currentStepIndex && styles.stepDotCurrent,
                    ]}
                  />
                  <Text
                    style={[
                      styles.stepLabel,
                      index <= currentStepIndex && styles.stepLabelActive,
                    ]}
                  >
                    {ORDER_STATUS_AR[step]}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 عنوان التوصيل</Text>
            <Text style={styles.addressText}>
              {typeof order.deliveryAddress === 'object' 
                ? (order.deliveryAddress.addressLine || 'عنوان غير متوفر')
                : (order.deliveryAddress || 'عنوان غير متوفر')}
            </Text>
            {order.deliveryAddress?.city && (
              <Text style={styles.cityText}>{order.deliveryAddress.city}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛍️ المنتجات</Text>
            {order.items && order.items.length > 0 ? (
              order.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>x{item.qty || 1}</Text>
                  <Text style={styles.itemPrice}>{item.price || 0} د.ع</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noItemsText}>لا توجد منتجات لعرضها</Text>
            )}
          </View>

          {order.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📝 ملاحظات</Text>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            {nextAction && !isCompleted && !isCancelled && (
              <Button
                title={nextAction.title}
                onPress={nextAction.action}
                size="large"
                fullWidth
                loading={loading}
              />
            )}

            {!isCompleted && !isCancelled && currentStatus !== ORDER_STATUS.CANCELLED && (
              <Button
                title="🗑️ إلغاء الطلب"
                onPress={handleCancelOrder}
                variant="danger"
                size="large"
                fullWidth
                style={styles.cancelButton}
                loading={loading}
              />
            )}

            {isCompleted && (
              <View style={styles.completedContainer}>
                <Text style={styles.completedText}>✓ تم تسليم الطلب بنجاح</Text>
                <Button
                  title="العودة للطلبات"
                  onPress={() => navigation.goBack()}
                  variant="primary"
                  size="large"
                  fullWidth
                />
              </View>
            )}

            {isCancelled && (
              <View style={styles.completedContainer}>
                <Text style={styles.cancelledText}>✗ تم إلغاء الطلب</Text>
                <Button
                  title="العودة للطلبات"
                  onPress={() => navigation.goBack()}
                  variant="primary"
                  size="large"
                  fullWidth
                />
              </View>
            )}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  storeName: {
    fontSize: typography.h4,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 12,
  },
  priceContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  totalPrice: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.success,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.divider,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.divider,
    marginBottom: 6,
  },
  stepDotActive: {
    backgroundColor: colors.success,
  },
  stepDotCurrent: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  stepLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: typography.bold,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectionTitle: {
    fontSize: typography.body1,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 12,
  },
  addressText: {
    fontSize: typography.body2,
    color: colors.text,
    marginBottom: 4,
  },
  cityText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {
    fontSize: typography.body2,
    color: colors.text,
    flex: 2,
  },
  itemQuantity: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    width: 50,
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: typography.body2,
    color: colors.success,
    width: 70,
    textAlign: 'right',
  },
  noItemsText: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  notesText: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 12,
  },
  completedContainer: {
    alignItems: 'center',
  },
  completedText: {
    fontSize: typography.h5,
    fontWeight: typography.bold,
    color: colors.success,
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelledText: {
    fontSize: typography.h5,
    fontWeight: typography.bold,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.body1,
    color: colors.textSecondary,
    marginTop: 16,
  },
});