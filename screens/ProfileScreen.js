import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import TermsAcceptanceHistory from '../components/TermsAcceptanceHistory';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
const RESIDENT_STORAGE_KEY = 'resident_data';

export default function ProfileScreen() {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const router = useRouter();
  const { signOut, residentData: authResidentData } = useAuth();

  // Initialize with cached data from AuthContext to avoid spinner
  const [residentData, setResidentData] = useState(authResidentData || null);
  const [loading, setLoading] = useState(!authResidentData);
  useNoStuckLoading(loading, setLoading);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    console.log('ProfileScreen mounted');
    loadResidentData();
  }, []);

  const loadResidentData = async () => {
    try {
      console.log('Loading resident data...');
      const storedData = await AsyncStorage.getItem(RESIDENT_STORAGE_KEY);
      if (storedData) {
        console.log('Found stored resident data');
        setResidentData(JSON.parse(storedData));
      } else {
        console.log('No stored resident data found');
      }
    } catch (error) {
      console.error('Error loading resident data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      await AsyncStorage.removeItem(RESIDENT_STORAGE_KEY);
      router.replace('/welcome');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
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
    >
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.profileImageContainer}>
          <Image
            source={require('../assets/default-avatar.png')}
            style={styles.profileImage}
          />
        </View>
        <Text style={styles.name}>{residentData?.name || 'Resident'}</Text>
        <Text style={styles.flatNumber}>Flat {residentData?.flat_number || 'N/A'}</Text>
      </View>

      {/* Settings Section */}
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.settingText, { color: theme.text }]}>Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={notificationsEnabled ? '#fff' : theme.textSecondary}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons 
              name={isDarkMode ? "moon" : "sunny-outline"} 
              size={20} 
              color={theme.textSecondary} 
            />
            <Text style={[styles.settingText, { color: theme.text }]}>Dark Mode</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={isDarkMode ? '#fff' : theme.textSecondary}
          />
        </View>
      </View>

      {/* Terms & Conditions Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Terms & Conditions
        </Text>
        <View style={styles.termsContainer}>
          <TermsAcceptanceHistory userType="resident" />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    padding: 3,
    marginBottom: 10,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  flatNumber: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
  },
  termsContainer: {
    marginTop: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 