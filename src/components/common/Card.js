import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../styles/colors';

export default function Card({
  children,
  onPress,
  style,
  elevation = true,
  padding = true,
}) {
  const Content = onPress ? TouchableOpacity : View;
  
  return (
    <Content
      style={[
        styles.card,
        elevation && styles.elevation,
        !padding && styles.noPadding,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {children}
    </Content>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
  },
  noPadding: {
    padding: 0,
  },
  elevation: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});