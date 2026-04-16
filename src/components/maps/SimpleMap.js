import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';

const { width, height } = Dimensions.get('window');

export default function SimpleMap({ 
  userLocation, 
  destinationLocation, 
  showRoute = false,
  onMapReady,
  height = 300,
}) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (userLocation && destinationLocation && showRoute) {
      fitToCoordinates();
    }
  }, [userLocation, destinationLocation]);

  const fitToCoordinates = () => {
    if (mapRef.current && userLocation && destinationLocation) {
      const coordinates = [userLocation, destinationLocation];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  const centerOnUser = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  if (!userLocation) {
    return (
      <View style={[styles.centerContainer, { height }]}>
        <Text style={styles.loadingText}>جاري تحميل الخريطة...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onMapReady={onMapReady}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
      >
        {/* موقع المندوب الحالي */}
        <Marker
          coordinate={userLocation}
          title="موقعي الحالي"
          description="أنت هنا"
        >
          <View style={styles.userMarker}>
            <View style={styles.userMarkerInner} />
          </View>
        </Marker>

        {/* موقع الوجهة */}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title="موقع الطلب"
            description="وجهة التوصيل"
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="location" size={20} color={colors.danger} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* زر تمركز الخريطة */}
      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
  },
  loadingText: {
    fontSize: typography.body2,
    color: colors.textSecondary,
  },
  centerButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.danger,
  },
});