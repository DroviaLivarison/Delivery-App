// src/components/orders/OrderCard.js (النسخة المصححة)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from '../common/Button';
import Card from '../common/Card';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';

export default function OrderCard({ order, onAccept, onReject, isProcessing }) {
  // ✅ دعم order.id أو order._id
  const formatOrderId = (id) => `#${id?.slice(-8) || '00000000'}`;
  const orderId = order.id || order._id;
  const storeName = order.store?.name || order.storeId || 'متجر';
  const itemCount = order.items?.length || 0;
  const totalPrice = order.totalPrice || 0;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.orderId}>{formatOrderId(orderId)}</Text>
        <View style={styles.storeBadge}>
          <Text style={styles.storeName}>{storeName}</Text>
        </View>
      </View>

      <View style={styles.priceSection}>
        <Text style={styles.totalPrice}>{totalPrice} د.ع</Text>
        <Text style={styles.itemsCount}>
          {itemCount} {itemCount === 1 ? 'طبق' : 'أطباق'}
        </Text>
      </View>

      <View style={styles.addressSection}>
        <Text style={styles.addressLabel}>📍 عنوان التوصيل</Text>
        <Text style={styles.addressText} numberOfLines={2}>
          {order.deliveryAddress?.addressLine || 'عنوان غير متوفر'}
        </Text>
        {order.deliveryAddress?.city && (
          <Text style={styles.cityText}>{order.deliveryAddress.city}</Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="رفض"
          onPress={onReject}
          variant="outline"
          style={styles.rejectButton}
          loading={isProcessing}
          disabled={isProcessing}
        />
        <Button
          title="قبول"
          onPress={onAccept}
          variant="primary"
          style={styles.acceptButton}
          loading={isProcessing}
          disabled={isProcessing}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  storeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  storeName: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  totalPrice: {
    fontSize: typography.h5,
    fontWeight: typography.bold,
    color: colors.success,
  },
  itemsCount: {
    fontSize: typography.body2,
    color: colors.textSecondary,
  },
  addressSection: {
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: typography.body2,
    color: colors.text,
    marginBottom: 2,
  },
  cityText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
});