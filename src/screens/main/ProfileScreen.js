// src/screens/main/ProfileScreen.js - النسخة المعدلة بالكامل

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
  const [accountStatus, setAccountStatus] = useState({ isActive: true, isVerified: false });

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const loadAccountStatus = async () => {
    const status = await DriverService.checkAccountStatus();
    setAccountStatus(status);
  };

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
    loadAccountStatus();
  }, []);

  const handleUpdateProfile = async () => {
    setLoading(true);
    
    // تحديث الملف الشخصي أولاً
    const profileSuccess = await updateProfile({
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
    });
    
    // إذا كان هناك طلب تغيير كلمة المرور
    let passwordSuccess = true;
    if (formData.newPassword && formData.newPassword.trim()) {
      if (formData.newPassword !== formData.confirmPassword) {
        Alert.alert('خطأ', 'كلمة المرور الجديدة غير متطابقة');
        setLoading(false);
        return;
      }
      
      if (formData.newPassword.length < 6) {
        Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        setLoading(false);
        return;
      }
      
      const result = await changePassword(
        formData.currentPassword,
        formData.newPassword,
        formData.confirmPassword
      );
      passwordSuccess = result.success;
      if (!passwordSuccess) {
        Alert.alert('خطأ', result.message);
      }
    }
    
    setLoading(false);

    if (profileSuccess && passwordSuccess) {
      Alert.alert('نجاح', 'تم تحديث الملف الشخصي' + (formData.newPassword ? ' وتغيير كلمة المرور' : ''));
      setEditModalVisible(false);
      // إعادة تعيين حقول كلمة المرور
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } else if (!profileSuccess) {
      Alert.alert('خطأ', 'فشل تحديث الملف الشخصي');
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
          <TouchableOpacity style={styles.avatar} onPress={() => setEditModalVisible(true)}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'م'}</Text>
            <View style={styles.editAvatarBadge}>
              <Ionicons name="camera" size={14} color={colors.surface} />
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{user?.name || 'مندوب'}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <Text style={styles.email}>{user?.email || 'البريد الإلكتروني غير مضاف'}</Text>

          <TouchableOpacity style={styles.editProfileButton} onPress={() => setEditModalVisible(true)}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={styles.editProfileText}>تعديل الملف الشخصي</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ بطاقة الإحصائيات */}
        <View style={styles.statsContainer}>
          <StatCard icon="today-outline" value={stats.todayOrders} label="طلبات اليوم" />
          <StatCard icon="time-outline" value={stats.totalOrders} label="إجمالي الطلبات" />
          <StatCard icon="star-outline" value={`${stats.rating}★`} label="التقييم" />
          <StatCard icon="cash-outline" value={`${stats.earnings}`} label="الأرباح" />
        </View>

        {/* ✅ بطاقة معلومات الحساب */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 معلومات الحساب</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.infoLabel}>نوع الحساب:</Text>
            <Text style={styles.infoValue}>مندوب توصيل</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="checkmark-done-circle-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.infoLabel}>التوثيق:</Text>
            <Text style={[styles.infoValue, accountStatus.isVerified ? styles.verified : styles.unverified]}>
              {accountStatus.isVerified ? 'موثق ✓' : 'غير موثق'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.infoLabel}>حالة الحساب:</Text>
            <Text style={[styles.infoValue, accountStatus.isActive ? styles.activeStatus : styles.inactiveStatus]}>
              {accountStatus.isActive ? 'نشط ✓' : 'غير نشط ✗'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="wifi-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.infoLabel}>حالة الاتصال:</Text>
            <Text style={[styles.infoValue, user?.isOnline ? styles.onlineStatus : styles.offlineStatus]}>
              {user?.isOnline ? 'متصل 🟢' : 'غير متصل ⚫'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="checkbox-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.infoLabel}>حالة التوفر:</Text>
            <Text style={[styles.infoValue, user?.isAvailable ? styles.availableStatus : styles.unavailableStatus]}>
              {user?.isAvailable ? 'متاح ✅' : 'غير متاح ⛔'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.infoLabel}>تاريخ الانضمام:</Text>
            <Text style={styles.infoValue}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ar') : 'غير محدد'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="stats-chart-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.infoLabel}>إجمالي الأرباح:</Text>
            <Text style={[styles.infoValue, styles.totalEarnings]}>{stats.earnings} د.ع</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="star-half-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.infoLabel}>متوسط التقييم:</Text>
            <Text style={styles.infoValue}>{stats.rating} / 5</Text>
          </View>
        </Card>

        <Button
          title="تسجيل الخروج"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
          icon={<Ionicons name="log-out-outline" size={20} color={colors.surface} />}
        />
      </ScrollView>

      {/* ✅ مودال تعديل الملف الشخصي (مع إمكانية تغيير كلمة المرور داخله) */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تعديل الملف الشخصي</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>المعلومات الأساسية</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="الاسم"
                  placeholderTextColor={colors.textHint}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="رقم الهاتف"
                  placeholderTextColor={colors.textHint}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="البريد الإلكتروني"
                  placeholderTextColor={colors.textHint}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>🔐 تغيير كلمة المرور (اختياري)</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="كلمة المرور الحالية"
                  placeholderTextColor={colors.textHint}
                  secureTextEntry
                  value={formData.currentPassword}
                  onChangeText={(text) => setFormData({ ...formData, currentPassword: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="كلمة المرور الجديدة"
                  placeholderTextColor={colors.textHint}
                  secureTextEntry
                  value={formData.newPassword}
                  onChangeText={(text) => setFormData({ ...formData, newPassword: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="تأكيد كلمة المرور الجديدة"
                  placeholderTextColor={colors.textHint}
                  secureTextEntry
                  value={formData.confirmPassword}
                  onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                />
              </View>

              <View style={styles.modalButtons}>
                <Button
                  title="إلغاء"
                  onPress={() => {
                    setEditModalVisible(false);
                    setFormData({
                      name: user?.name || '',
                      phone: user?.phone || '',
                      email: user?.email || '',
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: '',
                    });
                  }}
                  variant="outline"
                  style={styles.modalButton}
                />
                <Button
                  title="حفظ التغييرات"
                  onPress={handleUpdateProfile}
                  style={styles.modalButton}
                  icon={<Ionicons name="save-outline" size={18} color={colors.surface} />}
                />
              </View>
            </ScrollView>
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
    position: 'relative',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: typography.bold,
    color: colors.surface,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primaryDark,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
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
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryLight + '15',
    marginTop: 8,
  },
  editProfileText: {
    fontSize: typography.body2,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    width: 28,
    marginRight: 8,
  },
  infoLabel: {
    fontSize: typography.body2,
    color: colors.textSecondary,
    width: 100,
  },
  infoValue: {
    fontSize: typography.body2,
    color: colors.text,
    fontWeight: typography.medium,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 12,
  },
  totalEarnings: {
    color: colors.success,
    fontWeight: typography.bold,
  },
  verified: { color: colors.success },
  unverified: { color: colors.danger },
  activeStatus: { color: colors.success },
  inactiveStatus: { color: colors.danger },
  onlineStatus: { color: colors.success },
  offlineStatus: { color: colors.textDisabled },
  availableStatus: { color: colors.success },
  unavailableStatus: { color: colors.danger },
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
    borderRadius: 24,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
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
  sectionLabel: {
    fontSize: typography.body2,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: colors.surfaceVariant,
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: typography.body2,
    color: colors.text,
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  modalButton: {
    flex: 1,
  },
});