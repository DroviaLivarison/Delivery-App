// src/screens/main/ProfileScreen.js - الإصدار المصحح
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import useAuthStore from '../../store/authStore';
import { changePassword, updateDriverProfile } from '../../api/auth';
import DriverService from '../../api/driverService';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';

export default function ProfileScreen() {
  const { user, logout, updateProfile, stats, setStats } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const loadStats = async () => {
    try {
      const history = await DriverService.getOrderHistory(1, 100);
      const completedOrders = history.orders?.filter(o => o.status === 'delivered') || [];
      const earnings = completedOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = history.orders?.filter(o => {
        const orderDate = new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return o.status === 'delivered' && orderDate.getTime() === today.getTime();
      }).length || 0;
      
      setStats({
        todayOrders: todayOrders,
        totalOrders: completedOrders.length,
        rating: user?.rating || 5,
        earnings: earnings,
      });
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleUpdateProfile = async () => {
    setLoading(true);
    const success = await updateProfile(formData);
    setLoading(false);
    
    if (success) {
      Alert.alert('نجاح', 'تم تحديث الملف الشخصي');
      setEditModalVisible(false);
    } else {
      Alert.alert('خطأ', 'فشل تحديث الملف');
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('خطأ', 'كلمة المرور الجديدة غير متطابقة');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    
    setLoading(true);
    const result = await changePassword(
      passwordData.currentPassword,
      passwordData.newPassword,
      passwordData.confirmPassword
    );
    setLoading(false);
    
    if (result.success) {
      Alert.alert('نجاح', 'تم تغيير كلمة المرور');
      setPasswordModalVisible(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      Alert.alert('خطأ', result.message);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل خروج', onPress: () => logout(), style: 'destructive' },
      ]
    );
  };

  const StatCard = ({ icon, value, label }) => (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <LoadingOverlay visible={loading} />
      <Header title="الملف الشخصي" showNotification />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'م'}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'مندوب'}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <Text style={styles.email}>{user?.email || 'البريد الإلكتروني غير مضاف'}</Text>
          
          <View style={styles.editButtons}>
            <Button
              title="تعديل الملف"
              onPress={() => setEditModalVisible(true)}
              size="small"
              style={styles.editButton}
            />
            <Button
              title="تغيير كلمة المرور"
              onPress={() => setPasswordModalVisible(true)}
              variant="outline"
              size="small"
              style={styles.editButton}
            />
          </View>
        </View>
        
        <View style={styles.statsContainer}>
          <StatCard icon="today-outline" value={stats.todayOrders} label="طلبات اليوم" />
          <StatCard icon="time-outline" value={stats.totalOrders} label="إجمالي الطلبات" />
          <StatCard icon="star-outline" value={`${stats.rating}★`} label="التقييم" />
          <StatCard icon="cash-outline" value={`${stats.earnings}`} label="الأرباح" />
        </View>
        
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>معلومات الحساب</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>نوع الحساب:</Text>
            <Text style={styles.infoValue}>مندوب توصيل</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>حالة الحساب:</Text>
            <Text style={[styles.infoValue, user?.isVerified ? styles.verified : styles.unverified]}>
              {user?.isVerified ? 'موثق ✓' : 'غير موثق'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>تاريخ الانضمام:</Text>
            <Text style={styles.infoValue}>
              {new Date(user?.createdAt).toLocaleDateString('ar')}
            </Text>
          </View>
        </Card>
        
        <Button
          title="تسجيل الخروج"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
        />
      </ScrollView>
      
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تعديل الملف الشخصي</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="الاسم"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="رقم الهاتف"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="البريد الإلكتروني"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="إلغاء"
                onPress={() => setEditModalVisible(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="حفظ"
                onPress={handleUpdateProfile}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
      
      <Modal visible={passwordModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تغيير كلمة المرور</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="كلمة المرور الحالية"
              secureTextEntry
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="كلمة المرور الجديدة"
              secureTextEntry
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="تأكيد كلمة المرور الجديدة"
              secureTextEntry
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="إلغاء"
                onPress={() => setPasswordModalVisible(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="تغيير"
                onPress={handleChangePassword}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: typography.bold,
    color: colors.surface,
  },
  name: {
    fontSize: typography.h4,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 4,
  },
  phone: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  email: {
    fontSize: typography.caption,
    color: colors.textDisabled,
    marginBottom: 12,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  statCard: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.h4,
    fontWeight: typography.bold,
    color: colors.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: typography.body1,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: typography.body2,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.body2,
    color: colors.text,
    fontWeight: typography.medium,
  },
  verified: {
    color: colors.success,
  },
  unverified: {
    color: colors.danger,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginBottom: 32,
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
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: typography.h5,
    fontWeight: typography.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: typography.body2,
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
});