import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import TermsAcceptanceHistory from '../components/TermsAcceptanceHistory';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
const GUARD_STORAGE_KEY = 'guard_data';

export default function GuardProfileScreen() {
  const [guardData, setGuardData] = useState(null);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadGuardData();
  }, []);

  const loadGuardData = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      
      // Load guard data from AsyncStorage
      const guardDataString = await AsyncStorage.getItem(GUARD_STORAGE_KEY);
      let guard = guardDataString ? JSON.parse(guardDataString) : null;
      
      if (!guard) {
        // Check current session
        const { data: session } = await supabase.auth.getSession();
        
        if (!session?.session) {
          Alert.alert('Error', 'Session expired. Please login again.');
          router.replace('/guard-login');
          return;
        }
        
        // If not in AsyncStorage, try to fetch from Supabase
        if (session.session?.user) {
          const { data, error } = await supabase
            .from('guards')
            .select('*, societies(name)')
            .eq('user_id', session.session.user.id)
            .single();
            
          if (error || !data) {
            console.error('Error loading guard data:', error);
            Alert.alert('Error', 'Failed to load guard data');
            router.replace('/guard-login');
            return;
          }
          
          guard = data;
          await AsyncStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify(guard));
        }
      }
      
      setGuardData(guard);
    } catch (error) {
      console.error('Error loading guard data:', error);
      Alert.alert('Error', 'Failed to load guard data');
      router.replace('/guard-login');
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGuardData(true);
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              await AsyncStorage.removeItem(GUARD_STORAGE_KEY);
              router.replace('/guard-login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + 16 }]}>
        <View style={styles.profileImageContainer}>
          <View style={[styles.profileImage, { backgroundColor: theme.primaryLight }]}>
            <Text style={styles.profileInitial}>
              {guardData?.name ? guardData.name.charAt(0).toUpperCase() : 'G'}
            </Text>
          </View>
        </View>
        <Text style={styles.profileName}>{guardData?.name || 'Security Guard'}</Text>
        <Text style={styles.profileRole}>Security Staff</Text>
        {guardData?.societies?.name && (
          <View style={styles.societyBadge}>
            <Ionicons name="business-outline" size={14} color="white" />
            <Text style={styles.societyName}>{guardData.societies.name}</Text>
          </View>
        )}
      </View>

      {/* Profile Content */}
      <View style={styles.content}>
        {/* Contact Information */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Information</Text>
          
          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              {guardData?.email || 'No email available'}
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              {guardData?.phone || 'No phone number available'}
            </Text>
          </View>
          
          {guardData?.address && (
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.infoText, { color: theme.text }]}>
                {guardData.address}
              </Text>
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: theme.primaryLight }}
              thumbColor={isDarkMode ? theme.primary : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#767577', true: theme.primaryLight }}
              thumbColor={notificationsEnabled ? theme.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Terms & Conditions */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Terms & Conditions
          </Text>
          <View style={styles.termsContainer}>
            <TermsAcceptanceHistory userType="guard" />
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          style={[styles.signOutButton, { backgroundColor: theme.errorLight }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.error} />
          <Text style={[styles.signOutText, { color: theme.error }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  profileInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  societyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  societyName: {
    fontSize: 14,
    color: 'white',
    marginLeft: 6,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 15,
    flex: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    marginLeft: 12,
    fontSize: 15,
  },
  termsContainer: {
    marginTop: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 