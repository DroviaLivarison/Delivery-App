import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import polyline from '@mapbox/polyline';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL } from '../../utils/constants';

const { width, height } = Dimensions.get('window');

// تعيين رمز الوصول
MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

export default function DeliveryMap({
  userLocation,
  destinationLocation,
  storeLocation,
  onRouteReady,
  onDistanceTimeReady,
  showStore = true,
}) {
  const cameraRef = useRef(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState('streets');

  // أنماط الخريطة المتاحة
  const mapStyles = {
    streets: 'mapbox://styles/mapbox/streets-v12',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    navigation: 'mapbox://styles/mapbox/navigation-day-v1',
  };

  useEffect(() => {
    if (userLocation && destinationLocation) {
      calculateRoute();
      fitToAllMarkers();
    }
  }, [userLocation, destinationLocation, storeLocation]);

  // حساب المسار باستخدام MapBox Directions API
  const calculateRoute = async () => {
    setLoading(true);
    
    try {
      let coordinates = `${userLocation.longitude},${userLocation.latitude};`;
      
      if (storeLocation && showStore) {
        coordinates += `${storeLocation.longitude},${storeLocation.latitude};`;
      }
      
      coordinates += `${destinationLocation.longitude},${destinationLocation.latitude}`;
      
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=polyline&access_token=${MAPBOX_ACCESS_TOKEN}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const decodedGeometry = polyline.decode(route.geometry);
        const coordinatesArray = decodedGeometry.map(point => ({
          longitude: point[1],
          latitude: point[0],
        }));
        
        setRouteCoordinates(coordinatesArray);
        setDistance(route.distance / 1000); // تحويل إلى كيلومترات
        setDuration(route.duration / 60); // تحويل إلى دقائق
        
        if (onRouteReady) onRouteReady(route);
        if (onDistanceTimeReady) {
          onDistanceTimeReady({
            distance: route.distance / 1000,
            duration: route.duration / 60,
          });
        }
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
    
    setLoading(false);
  };

  const fitToAllMarkers = () => {
    if (!cameraRef.current) return;
    
    const coordinates = [
      [userLocation.longitude, userLocation.latitude],
    ];
    
    if (destinationLocation) {
      coordinates.push([destinationLocation.longitude, destinationLocation.latitude]);
    }
    
    if (storeLocation && showStore) {
      coordinates.push([storeLocation.longitude, storeLocation.latitude]);
    }
    
    if (coordinates.length > 1) {
      const lons = coordinates.map(c => c[0]);
      const lats = coordinates.map(c => c[1]);
      
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      
      cameraRef.current.fitBounds(
        [minLon, minLat],
        [maxLon, maxLat],
        { padding: 80, animated: true }
      );
    }
  };

  const centerOnUser = () => {
    if (cameraRef.current && userLocation) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 15,
        animationDuration: 1000,
      });
    }
  };

  const formatDistance = (dist) => {
    if (!dist) return '--';
    if (dist < 1) return `${Math.round(dist * 1000)} م`;
    return `${dist.toFixed(1)} كم`;
  };

  const formatDuration = (dur) => {
    if (!dur) return '--';
    if (dur < 60) return `${Math.round(dur)} دقيقة`;
    const hours = Math.floor(dur / 60);
    const minutes = Math.round(dur % 60);
    return `${hours} ساعة ${minutes} دقيقة`;
  };

  const toggleMapStyle = () => {
    const styles = ['streets', 'outdoors', 'satellite'];
    const currentIndex = styles.indexOf(mapStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    setMapStyle(styles[nextIndex]);
  };

  if (!userLocation) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل الخريطة...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={mapStyles[mapStyle]}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={[userLocation.longitude, userLocation.latitude]}
          zoomLevel={12}
          animationDuration={0}
        />

        {/* موقع المندوب */}
        <MapboxGL.PointAnnotation
          id="driverLocation"
          coordinate={[userLocation.longitude, userLocation.latitude]}
          title="موقعي الحالي"
        >
          <View style={styles.driverMarker}>
            <View style={styles.driverMarkerInner}>
              <Ionicons name="bicycle" size={16} color={colors.surface} />
            </View>
          </View>
        </MapboxGL.PointAnnotation>

        {/* موقع المتجر */}
        {showStore && storeLocation && (
          <MapboxGL.PointAnnotation
            id="storeLocation"
            coordinate={[storeLocation.longitude, storeLocation.latitude]}
            title="موقع المتجر"
          >
            <View style={styles.storeMarker}>
              <Ionicons name="storefront" size={20} color={colors.warning} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* موقع العميل */}
        {destinationLocation && (
          <MapboxGL.PointAnnotation
            id="customerLocation"
            coordinate={[destinationLocation.longitude, destinationLocation.latitude]}
            title="موقع العميل"
          >
            <View style={styles.customerMarker}>
              <Ionicons name="home" size={20} color={colors.info} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* المسار المرسوم */}
        {routeCoordinates.length > 0 && (
          <MapboxGL.ShapeSource
            id="routeSource"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates.map(coord => [coord.longitude, coord.latitude]),
              },
            }}
          >
            <MapboxGL.LineLayer
              id="routeLayer"
              style={{
                lineColor: colors.primary,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* أزرار التحكم */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={centerOnUser}>
          <Ionicons name="locate" size={24} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={toggleMapStyle}>
          <Ionicons name="map" size={24} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={fitToAllMarkers}>
          <Ionicons name="resize" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* معلومات المسافة والوقت */}
      {(distance || duration) && (
        <View style={styles.infoPanel}>
          <View style={styles.infoItem}>
            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
            <Text style={styles.infoLabel}>المسافة:</Text>
            <Text style={styles.infoValue}>{formatDistance(distance)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.infoLabel}>الوقت المتوقع:</Text>
            <Text style={styles.infoValue}>{formatDuration(duration)}</Text>
          </View>
        </View>
      )}

      {/* مؤشر التحميل */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingOverlayText}>جاري حساب المسار...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  loadingText: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    marginTop: 12,
  },
  controls: {
    position: 'absolute',
    bottom: 20,
    right: 12,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  infoPanel: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.body2,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.divider,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlayText: {
    fontSize: typography.body2,
    color: colors.surface,
    marginTop: 12,
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverMarkerInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.warning,
  },
  customerMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.info,
  },
});