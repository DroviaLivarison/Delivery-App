import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // primary, outline, danger, success
  size = 'medium', // small, medium, large
  fullWidth = false,
  icon = null,
  style,
  textStyle,
}) {
  const getButtonStyle = () => {
    const baseStyle = [styles.button];
    
    if (variant === 'primary') baseStyle.push(styles.primary);
    if (variant === 'outline') baseStyle.push(styles.outline);
    if (variant === 'danger') baseStyle.push(styles.danger);
    if (variant === 'success') baseStyle.push(styles.success);
    
    if (size === 'small') baseStyle.push(styles.small);
    if (size === 'large') baseStyle.push(styles.large);
    
    if (fullWidth) baseStyle.push(styles.fullWidth);
    if (disabled) baseStyle.push(styles.disabled);
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text];
    
    if (variant === 'outline') baseStyle.push(styles.outlineText);
    
    if (size === 'small') baseStyle.push(styles.textSmall);
    if (size === 'large') baseStyle.push(styles.textLarge);
    
    return baseStyle;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[getButtonStyle(), style]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.surface} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  success: {
    backgroundColor: colors.success,
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: typography.body1,
    fontWeight: typography.bold,
  },
  textSmall: {
    fontSize: typography.body2,
  },
  textLarge: {
    fontSize: typography.h6,
  },
  outlineText: {
    color: colors.primary,
  },
});