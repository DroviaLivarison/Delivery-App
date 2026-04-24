import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import useAuthStore from '../../store/authStore';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const { login, isLoading } = useAuthStore();

  const validate = () => {
    const newErrors = {};

    if (!phone.trim()) {
      newErrors.phone = 'رقم الهاتف مطلوب';
    } else if (phone.length < 10) {
      newErrors.phone = 'رقم الهاتف غير صحيح';
    }

    if (!password.trim()) {
      newErrors.password = 'كلمة المرور مطلوبة';
    } else if (password.length < 6) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    const success = await login(phone, password);
    if (!success) {
      Alert.alert('خطأ', 'فشل تسجيل الدخول. تحقق من رقم الهاتف وكلمة المرور');
    }

    const profile = await DriverService.getProfile();
    if (profile && !profile.isAvailable) {
      await DriverService.toggleAvailability(true);
    }
  };

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <LoadingOverlay visible={isLoading} message="جاري تسجيل الدخول..." />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={globalStyles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>🚚</Text>
            </View>
            <Text style={styles.appName}>تطبيق المندوب</Text>
            <Text style={styles.subtitle}>تسجيل الدخول إلى حسابك</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="رقم الهاتف"
              value={phone}
              onChangeText={setPhone}
              placeholder="05XXXXXXXX"
              keyboardType="phone-pad"
              error={errors.phone}
              icon={<Text style={styles.inputIcon}>📱</Text>}
            />

            <Input
              label="كلمة المرور"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              error={errors.password}
              icon={<Text style={styles.inputIcon}>🔒</Text>}
            />

            <Button
              title="تسجيل الدخول"
              onPress={handleLogin}
              fullWidth
              size="large"
              loading={isLoading}
              style={styles.loginButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 48,
  },
  appName: {
    fontSize: typography.h3,
    fontWeight: typography.bold,
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.body2,
    color: colors.textSecondary,
  },
  form: {
    width: '100%',
  },
  inputIcon: {
    fontSize: 18,
  },
  loginButton: {
    marginTop: 24,
  },
});