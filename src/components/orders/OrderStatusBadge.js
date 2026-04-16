import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ORDER_STATUS_AR, ORDER_STATUS_COLORS } from '../../utils/constants';
import { typography } from '../../styles/typography';

export default function OrderStatusBadge({ status, size = 'normal' }) {
  const getStatusColor = () => {
    return ORDER_STATUS_COLORS[status] || '#999';
  };

  const getStatusText = () => {
    return ORDER_STATUS_AR[status] || status;
  };

  const getSizeStyles = () => {
    if (size === 'small') {
      return {
        paddingHorizontal: 8,
        paddingVertical: 3,
        fontSize: typography.caption,
      };
    }
    return {
      paddingHorizontal: 12,
      paddingVertical: 6,
      fontSize: typography.body2,
    };
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: getStatusColor() + '20' },
        { paddingHorizontal: sizeStyles.paddingHorizontal },
        { paddingVertical: sizeStyles.paddingVertical },
      ]}
    >
      <Text style={[styles.text, { color: getStatusColor(), fontSize: sizeStyles.fontSize }]}>
        {getStatusText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: typography.bold,
  },
});