import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function ChangePasswordScreen() {
  const { theme, isDarkMode } = useTheme();
  const { user, residentData, refreshResidentData } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const isFirstLogin = params.first_login === 'true';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async () => {
    setError('');

    if (!currentPassword) {
      setError('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: currentPassword,
      });

      if (signInError) {
        setError('Current password is incorrect');
        setLoading(false);
        return;
      }

      // Update password and mark as changed in user_metadata
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { password_changed: true },
      });

      if (updateError) {
        throw updateError;
      }

      // Also try updating residents table (best effort)
      const userId = user?.id;
      if (userId) {
        await supabase
          .from('residents')
          .update({ password_changed: true })
          .eq('user_id', userId)
          .then(() => {})
          .catch(() => {});
        
        await refreshResidentData(userId);
      }

      Alert.alert(
        'Success',
        'Your password has been updated successfully!',
        [{
          text: 'OK',
          onPress: () => {
            if (isFirstLogin) {
              router.replace('/home');
            } else {
              router.back();
            }
          },
        }]
      );
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {!isFirstLogin && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: theme.card }]}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextContainer}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="lock-closed" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {isFirstLogin ? 'Set New Password' : 'Change Password'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.text + '99' }]}>
              {isFirstLogin
                ? 'For security, please change your password before continuing. Your current password was set by your society admin.'
                : 'Update your login password'}
            </Text>
          </View>
        </View>

        {/* First login banner */}
        {isFirstLogin && (
          <View style={[styles.banner, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
            <Ionicons name="information-circle" size={20} color={theme.primary} />
            <Text style={[styles.bannerText, { color: theme.primary }]}>
              This is required on your first login. Your current password is the one shared by your society admin (usually your phone number).
            </Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Current Password</Text>
            <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={theme.text + '55'}
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeButton}>
                <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color={theme.text + '77'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>New Password</Text>
            <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min 6 characters"
                placeholderTextColor={theme.text + '55'}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeButton}>
                <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color={theme.text + '77'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Confirm New Password</Text>
            <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={theme.text + '55'}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeButton}>
                <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={theme.text + '77'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.submitText}>{loading ? 'Updating...' : 'Change Password'}</Text>
        </TouchableOpacity>

        {!isFirstLogin && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={[styles.cancelText, { color: theme.text + '88' }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  banner: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 4,
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
  },
});
