import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OrderStatusBadge from './OrderStatusBadge';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';

export default function OrderDetailsModal({ visible, order, onClose }) {
  if (!order) return null;

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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>تفاصيل الطلب</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.row}>
              <Text style={styles.label}>رقم الطلب:</Text>
              <Text style={styles.value}>#{order.id}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>المتجر:</Text>
              <Text style={styles.value}>{order.store?.name}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>الحالة:</Text>
              <OrderStatusBadge status={order.status} />
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>التاريخ:</Text>
              <Text style={styles.value}>{formatDate(order.createdAt)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>المبلغ الإجمالي:</Text>
              <Text style={[styles.value, styles.price]}>{order.totalPrice} د.ع</Text>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>المنتجات:</Text>
              {order.items?.map((item, index) => (
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
                {order.deliveryAddress?.addressLine}
              </Text>
              <Text style={styles.addressText}>
                {order.deliveryAddress?.city}
              </Text>
            </View>
            
            {order.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📝 ملاحظات:</Text>
                <Text style={styles.notesText}>{order.notes}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    fontSize: typography.h5,
    fontWeight: typography.bold,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: typography.body2,
    color: colors.textSecondary,
  },
  value: {
    fontSize: typography.body2,
    color: colors.text,
    fontWeight: typography.medium,
  },
  price: {
    color: colors.success,
    fontWeight: typography.bold,
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