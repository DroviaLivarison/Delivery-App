import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import SimpleMap from '../../components/maps/SimpleMap';
import { getOrderLocation } from '../../api/location';
import { getCurrentLocation } from '../../api/location';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';

export default function MapScreen({ route, navigation }) {
  const { orderId, destination, store } = route?.params || {};
  const [userLocation, setUserLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [storeLocation, setStoreLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStore, setShowStore] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    
    // جلب موقع المندوب الحالي
    const userLoc = await getCurrentLocation();
    if (userLoc.success) {
      setUserLocation({
        latitude: userLoc.latitude,
        longitude: userLoc.longitude,
      });
    }
    
    // جلب موقع الطلب
    if (orderId) {
      const orderLoc = await getOrderLocation(orderId);
      if (orderLoc.success && orderLoc.data) {
        setDestinationLocation({
          latitude: orderLoc.data.latitude,
          longitude: orderLoc.data.longitude,
        });
      }
    } else if (destination) {
      setDestinationLocation(destination);
    }
    
    // جلب موقع المتجر
    if (store) {
      setStoreLocation(store);
    }
    
    setLoading(false);
  };

  const startNavigation = () => {
    if (!userLocation || !destinationLocation) return;
    
    // فتح تطبيق الخرائط الخارجي
    const url = `https://www.google.com/maps/dir/${userLocation.latitude},${userLocation.longitude}/${destinationLocation.latitude},${destinationLocation.longitude}`;
    
    Alert.alert(
      'فتح الخريطة',
      'هل تريد فتح تطبيق الخرائط للتوجيه؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'فتح',
          onPress: () => {
            Linking.openURL(url).catch(err => {
              console.error('Error opening maps:', err);
              Alert.alert('خطأ', 'لا يمكن فتح تطبيق الخرائط');
            });
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <Header title="الخريطة" showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل الخريطة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userLocation) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <Header title="الخريطة" showBack />
        <View style={styles.centerContainer}>
          <Ionicons name="location-off-outline" size={64} color={colors.textDisabled} />
          <Text style={styles.errorText}>لا يمكن الحصول على موقعك</Text>
          <Button
            title="إعادة المحاولة"
            onPress={loadLocations}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <Header title="الخريطة" showBack />
      
      <View style={styles.container}>
        <SimpleMap
          userLocation={userLocation}
          destinationLocation={destinationLocation || storeLocation}
          showRoute={true}
          height={400}
        />
        
        {/* معلومات إضافية */}
        {(destinationLocation || storeLocation) && (
          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color={colors.primary} />
              <Text style={styles.infoTitle}>معلومات التوصيل</Text>
            </View>
            
            {destinationLocation && (
              <View style={styles.infoRow}>
                <Ionicons name="location" size={18} color={colors.textSecondary} />
                <Text style={styles.infoText}>وجهة: {destinationLocation.address || 'موقع العميل'}</Text>
              </View>
            )}
            
            {storeLocation && showStore && (
              <View style={styles.infoRow}>
                <Ionicons name="storefront" size={18} color={colors.textSecondary} />
                <Text style={styles.infoText}>المتجر: {storeLocation.address || 'موقع المتجر'}</Text>
              </View>
            )}
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>إظهار موقع المتجر</Text>
              <TouchableOpacity onPress={() => setShowStore(!showStore)}>
                <Ionicons
                  name={showStore ? 'toggle' : 'toggle-outline'}
                  size={28}
                  color={showStore ? colors.primary : colors.textDisabled}
                />
              </TouchableOpacity>
            </View>
            
            <Button
              title="بدء التوجيه"
              onPress={startNavigation}
              fullWidth
              icon={<Ionicons name="navigate" size={20} color={colors.surface} />}
              style={styles.navButton}
            />
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: typography.body1,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
  },
  infoCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoTitle: {
    fontSize: typography.body1,
    fontWeight: typography.bold,
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  switchLabel: {
    fontSize: typography.body2,
    color: colors.text,
  },
  navButton: {
    marginTop: 8,
  },
});