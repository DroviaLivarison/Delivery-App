import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import Card from '../../components/common/Card';
import OrderStatusBadge from '../../components/orders/OrderStatusBadge';
import { getOrderHistory } from '../../api/orders';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';
import { ORDER_STATUS_AR } from '../../utils/constants';

export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadHistory = async () => {
    const result = await getOrderHistory();
    if (result.success) {
      setOrders(result.data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'تاريخ غير متوفر';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderCard = ({ item }) => (
    <TouchableOpacity onPress={() => { setSelectedOrder(item); setModalVisible(true); }}>
      <Card style={styles.orderCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>طلب #{item.id?.slice(-8)}</Text>
          <OrderStatusBadge status={item.status} size="small" />
        </View>
        
        <Text style={styles.storeName}>{item.store?.name || 'متجر'}</Text>
        
        <View style={styles.cardDetails}>
          <Text style={styles.totalPrice}>{item.totalPrice} د.ع</Text>
          <Text style={styles.itemsCount}>{item.items?.length || 0} منتجات</Text>
        </View>
        
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        
        <View style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>عرض التفاصيل</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={globalStyles.emptyContainer}>
      <Ionicons name="time-outline" size={64} color={colors.textDisabled} />
      <Text style={globalStyles.emptyText}>لا توجد طلبات سابقة</Text>
      <Text style={styles.emptySubtext}>
        ستظهر هنا الطلبات التي قمت بتوصيلها
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <Header title="سجل الطلبات" showNotification />
        <LoadingOverlay visible={true} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <Header title="سجل الطلبات" showNotification />
      
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderCard}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={orders.length === 0 && styles.emptyList}
        showsVerticalScrollIndicator={false}
      />
      
      {/* مودال تفاصيل الطلب */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تفاصيل الطلب</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>رقم الطلب:</Text>
                  <Text style={styles.detailValue}>#{selectedOrder.id}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>المتجر:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.store?.name}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>الحالة:</Text>
                  <OrderStatusBadge status={selectedOrder.status} />
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>التاريخ:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedOrder.createdAt)}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>المبلغ الإجمالي:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.totalPrice} د.ع</Text>
                </View>
                
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>المنتجات:</Text>
                  {selectedOrder.items?.map((item, index) => (
                    <View key={index} style={styles.productRow}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.productQty}>x{item.qty}</Text>
                      <Text style={styles.productPrice}>{item.price} د.ع</Text>
                    </View>
                  ))}
                </View>
                
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📍 عنوان التوصيل:</Text>
                  <Text style={styles.addressText}>
                    {selectedOrder.deliveryAddress?.addressLine}
                  </Text>
                  <Text style={styles.addressText}>
                    {selectedOrder.deliveryAddress?.city}
                  </Text>
                </View>
                
                {selectedOrder.notes && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📝 ملاحظات:</Text>
                    <Text style={styles.notesText}>{selectedOrder.notes}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emptyList: {
    flexGrow: 1,
  },
  orderCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardHeader: {
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
    fontSize: typography.body1,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 8,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  totalPrice: {
    fontSize: typography.h6,
    fontWeight: typography.bold,
    color: colors.success,
  },
  itemsCount: {
    fontSize: typography.body2,
    color: colors.textSecondary,
  },
  date: {
    fontSize: typography.caption,
    color: colors.textDisabled,
    marginBottom: 8,
  },
  detailsButton: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  detailsButtonText: {
    color: colors.primary,
    fontSize: typography.body2,
    marginRight: 4,
  },
  emptySubtext: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: typography.h5,
    fontWeight: typography.bold,
    color: colors.text,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: typography.body2,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.body2,
    color: colors.text,
    fontWeight: typography.medium,
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  sectionTitle: {
    fontSize: typography.body1,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 12,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productName: {
    fontSize: typography.body2,
    color: colors.text,
    flex: 2,
  },
  productQty: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    width: 40,
    textAlign: 'center',
  },
  productPrice: {
    fontSize: typography.body2,
    color: colors.success,
    width: 70,
    textAlign: 'right',
  },
  addressText: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});