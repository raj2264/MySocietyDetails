import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  ImageBackground,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  testStorage, 
  clearAllStorage, 
  listAllStorageKeys,
  resetThemeSettings,
  forceSetTheme
} from '../lib/storage';
import DirectThemeToggle from '../components/DirectThemeToggle';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useNoStuckLoading from '../hooks/useNoStuckLoading';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;
const contentMaxWidth = isTablet ? 700 : undefined;

export default function HomeScreen() {
  // Fallback: If user is null, redirect to login (extra safety)
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  const { user, signOut } = useAuth();
  const { theme, isDarkMode, animatedColors } = useTheme();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  useNoStuckLoading(isLoading, setIsLoading);
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const entranceAnim = useRef(new Animated.Value(0.95)).current;
  const cardAnimValues = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.95))).current;

  // ENFORCE T&C AND PASSWORD CHANGE FOR FIRST LOGIN USERS
  useEffect(() => {
    // Only run if user is logged in
    if (!user) return;
    let isMounted = true;
    const checkFirstTimeEnforcement = async () => {
      try {
        // 1. Check T&C acceptance
        const { data: termsData, error: termsError } = await require('../lib/supabase').supabase
          .from('terms_acceptance')
          .select('*')
          .eq('user_id', user.id)
          .eq('user_type', 'resident')
          .order('accepted_at', { ascending: false })
          .limit(1)
          .single();

        if (termsError || !termsData) {
          if (isMounted) router.replace('/login'); // force re-login to trigger T&C modal
          return;
        }

        // 2. Check password changed flag
        if (!user.user_metadata?.password_changed) {
          if (isMounted) router.replace('/change-password?first_login=true');
          return;
        }
        // If both are satisfied, do nothing (allow dashboard)
      } catch (err) {
        // fallback: do nothing, allow dashboard
        console.error('First login enforcement error:', err);
      }
    };
    checkFirstTimeEnforcement();
    return () => { isMounted = false; };
  }, [user, router]);

  // Run entrance animation once when component mounts
  useEffect(() => {
    if (!hasAnimated) {
      setHasAnimated(true);
      Animated.timing(entranceAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      Animated.stagger(100, 
        cardAnimValues.map(anim => 
          Animated.spring(anim, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true,
          })
        )
      ).start();
    }
  }, [hasAnimated, entranceAnim, cardAnimValues]);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      const result = await signOut();
      if (result?.error) {
        Alert.alert('Error', result.error);
      }
      // Navigate to login screen regardless — state is already cleared
      router.replace('/login');
    } catch (err) {
      // State is already cleared in AuthContext, just navigate
      router.replace('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestStorage = async () => {
    const result = await testStorage();
    if (result.success) {
      Alert.alert('Storage Test', 'AsyncStorage is working correctly!');
    } else {
      Alert.alert('Storage Test Failed', result.error || 'Unknown error');
    }
  };

  const handleClearStorage = async () => {
    Alert.alert(
      'Clear Storage',
      'This will clear all app data including login info. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const result = await clearAllStorage();
            if (result.success) {
              Alert.alert('Storage Cleared', 'All app data has been cleared. The app will now sign out.');
              handleSignOut();
            } else {
              Alert.alert('Error', result.error || 'Failed to clear storage');
            }
          }
        }
      ]
    );
  };

  const handleListStorageKeys = async () => {
    const result = await listAllStorageKeys();
    if (result.success) {
      Alert.alert('Storage Keys', `Found ${result.keys.length} keys:\n${result.keys.join('\n')}`);
    } else {
      Alert.alert('Error', result.error || 'Failed to list storage keys');
    }
  };

  const handleResetThemeSettings = async () => {
    Alert.alert(
      'Reset Theme Settings',
      'This will reset theme settings to device defaults. App may need to be restarted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          onPress: async () => {
            const result = await resetThemeSettings();
            if (result.success) {
              Alert.alert('Success', result.message);
            } else {
              Alert.alert('Error', result.error || 'Failed to reset theme settings');
            }
          }
        }
      ]
    );
  };

  const handleForceTheme = (mode) => {
    Alert.alert(
      `Force ${mode === 'dark' ? 'Dark' : 'Light'} Mode`,
      `This will force the app into ${mode} mode. App may need to be restarted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Apply', 
          onPress: async () => {
            const result = await forceSetTheme(mode);
            if (result.success) {
              Alert.alert('Success', result.message);
            } else {
              Alert.alert('Error', result.error || `Failed to set ${mode} mode`);
            }
          }
        }
      ]
    );
  };

  const handleForceThemeToggle = async () => {
    try {
      // Get current theme from storage
      const savedTheme = await AsyncStorage.getItem('mysociety.theme.mode');
      
      // Toggle it directly
      const newTheme = savedTheme === 'dark' ? 'light' : 'dark';
      
      // Save to storage
      await AsyncStorage.setItem('mysociety.theme.mode', newTheme);
      
      // Tell user theme has changed
      Alert.alert(
        'Theme Changed',
        `Theme has been manually set to ${newTheme} mode.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error forcing theme change:', error);
      Alert.alert('Error', 'Could not change theme. Please try again.');
    }
  };

  const featureOptions = [
    {
      id: 'announcements',
      icon: 'megaphone',
      title: 'Announcements',
      description: 'Stay updated with society announcements',
      onPress: () => router.push('/announcements'),
      color: theme.primary,
      bgImage: 'https://img.freepik.com/free-vector/abstract-blue-geometric-shapes-background_1035-17545.jpg'
    },
    {
      id: 'visitors',
      icon: 'people',
      title: 'Visitors',
      description: 'Manage visitor access and approvals',
      onPress: () => router.push('/visitors'),
      color: '#8E44AD', // Purple color
      bgImage: 'https://img.freepik.com/free-vector/gradient-geometric-shapes-dark-background_52683-42584.jpg'
    },
    {
      id: 'polls',
      icon: 'stats-chart',
      title: 'Polls & Voting',
      description: 'Participate in society decisions and polls',
      onPress: () => router.push('/polls'),
      color: theme.info,
      bgImage: 'https://img.freepik.com/free-vector/gradient-network-connection-background_23-2148865392.jpg'
    },
    {
      id: 'notifications',
      icon: 'notifications',
      title: 'Notifications',
      description: 'View your activity and updates',
      onPress: () => router.push('/notifications'),
      color: theme.warning,
      bgImage: 'https://img.freepik.com/free-vector/abstract-orange-background_1095-58.jpg'
    },
    {
      id: 'profile',
      icon: 'person',
      title: 'My Profile',
      description: 'Manage your profile information',
      onPress: () => router.push('/profile'),
      color: theme.success,
      bgImage: 'https://img.freepik.com/free-vector/abstract-green-background-vector-modern-design_53876-128207.jpg'
    },
    {
      id: 'vehicles',
      icon: 'car',
      title: 'My Vehicles',
      description: 'Add and manage your vehicle details',
      onPress: () => router.push('/vehicles'),
      color: theme.secondary,
      bgImage: 'https://img.freepik.com/free-vector/purple-fluid-background-abstract-style_23-2148442963.jpg'
    }
  ];

  // User quick actions
  const quickActions = [
    { icon: 'document-text', label: 'Documents', onPress: () => router.push('/documents'), color: '#FF5722' },
    { icon: 'cash', label: 'Payments', onPress: () => router.push('/payments'), color: '#4CAF50' },
    { icon: 'calendar', label: 'Events', onPress: () => router.push('/events'), color: '#2196F3' },
    { icon: 'shield-checkmark', label: 'Security', onPress: () => router.push('/security'), color: '#9C27B0' }
  ];

  // Render quick actions
  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      {quickActions.map((action, index) => (
        <TouchableOpacity 
          key={action.label}
          style={styles.quickActionButton}
          onPress={action.onPress}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
            <Ionicons name={action.icon} size={22} color={action.color} />
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.text }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render recent activity section
  const renderRecentActivity = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Updates</Text>
        <TouchableOpacity>
          <Text style={[styles.viewAllText, { color: theme.primary }]}>View All</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.activityContainer}>
        <ActivityItem 
          icon="megaphone" 
          title="New community announcement" 
          time="Today, 9:30 AM" 
          color={theme.primary}
          animatedStyle={{ opacity: cardAnimValues[0], transform: [{ translateY: cardAnimValues[0].interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0]
          })}]}}
        />
        
        <ActivityItem 
          icon="car-sport" 
          title="Guest vehicle registered" 
          time="Yesterday, 5:15 PM" 
          color={theme.secondary}
          animatedStyle={{ opacity: cardAnimValues[1], transform: [{ translateY: cardAnimValues[1].interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0]
          })}]}}
        />
        
        <ActivityItem 
          icon="calendar" 
          title="Society meeting scheduled" 
          time="2 days ago" 
          color={theme.info}
          animatedStyle={{ opacity: cardAnimValues[2], transform: [{ translateY: cardAnimValues[2].interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0]
          })}]}}
        />
      </View>
    </View>
  );

  // Activity item component
  const ActivityItem = ({ icon, title, time, color, animatedStyle }) => (
    <Animated.View style={[styles.activityItem, { backgroundColor: theme.card }, animatedStyle]}>
      <View style={[styles.activityIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.activityTime, { color: theme.text + '99' }]}>{time}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.text + '40'} />
    </Animated.View>
  );

  // Render feature cards
  const renderFeatureCards = () => (
    <ScrollView 
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.featuredCardsContainer}
    >
      {featureOptions.map((feature, index) => (
        <Animated.View 
          key={feature.id}
          style={[
            { opacity: cardAnimValues[index % cardAnimValues.length], transform: [{ scale: cardAnimValues[index % cardAnimValues.length] }] }
          ]}
        >
          <TouchableOpacity
            style={styles.featureCard}
            onPress={feature.onPress}
          >
            <ImageBackground
              source={{ uri: feature.bgImage }}
              style={styles.featureCardBg}
              imageStyle={styles.featureCardImage}
            >
              <View style={styles.featureCardOverlay}>
                <View style={[styles.featureCardIcon, { backgroundColor: feature.color + '30' }]}>
                  <Ionicons name={feature.icon} size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.featureCardTitle}>{feature.title}</Text>
                <Text style={styles.featureCardDesc}>{feature.description}</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: 'red' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      
      {/* TEST CHANGE - THIS SHOULD BE VERY VISIBLE */}
      <View style={{padding: 50, backgroundColor: 'yellow', alignItems: 'center'}}>
        <Text style={{fontSize: 24, color: 'black', fontWeight: 'bold'}}>
          TEST CHANGE - VISIBLE?
        </Text>
      </View>
      
      {/* Updated Header with Gradient */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onLongPress={() => setShowDevMenu(!showDevMenu)}>
            <Text style={[styles.logoText, { color: theme.text }]}>
              MySociety
            </Text>
          </TouchableOpacity>
          
          <View style={styles.headerRightContainer}>
            <DirectThemeToggle showLabel={false} />
            
            <TouchableOpacity 
              style={styles.profileButton} 
              onPress={() => router.push('/profile')}
            >
              <Image 
                source={{ uri: 'https://xsgames.co/randomusers/avatar.php?g=pixel' }} 
                style={styles.profileImage}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Dev Menu (hidden by default) */}
      {showDevMenu && (
        <View style={[styles.devMenu, { backgroundColor: isDarkMode ? '#0c0c0c' : '#f0f0f0' }]}>
          <Text style={[styles.devMenuTitle, { color: theme.text }]}>Developer Options</Text>
          
          <Text style={[styles.devMenuSubtitle, { color: theme.text }]}>Storage Tools</Text>
          <View style={styles.devMenuButtons}>
            <TouchableOpacity 
              style={[styles.devButton, { backgroundColor: theme.card }]} 
              onPress={handleTestStorage}
            >
              <Text style={[styles.devButtonText, { color: theme.text }]}>Test Storage</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.devButton, { backgroundColor: theme.card }]} 
              onPress={handleListStorageKeys}
            >
              <Text style={[styles.devButtonText, { color: theme.text }]}>List Storage Keys</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.devButton, { backgroundColor: '#d9534f' }]} 
              onPress={handleClearStorage}
            >
              <Text style={styles.devButtonText}>Clear Storage</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.devMenuSubtitle, { color: theme.text }]}>Theme Tools</Text>
          <View style={styles.devMenuButtons}>
            <TouchableOpacity 
              style={[styles.devButton, { backgroundColor: '#5cb85c' }]} 
              onPress={() => handleForceTheme('light')}
            >
              <Text style={styles.devButtonText}>Force Light Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.devButton, { backgroundColor: '#343a40' }]} 
              onPress={() => handleForceTheme('dark')}
            >
              <Text style={styles.devButtonText}>Force Dark Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.devButton, { backgroundColor: '#f0ad4e' }]} 
              onPress={handleResetThemeSettings}
            >
              <Text style={styles.devButtonText}>Reset Theme</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Animated.View style={{ opacity: entranceAnim }}>
            <Text style={[styles.welcomeHeading, { color: theme.text }]}>
              Welcome back,
            </Text>
            <Text style={[styles.userName, { color: theme.text }]}>
              {user?.user_metadata?.full_name || 'User'}!
            </Text>
          </Animated.View>
          
          {/* Quick action buttons */}
          {renderQuickActions()}
        </View>
        
        {/* Featured Cards Carousel */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Features</Text>
          {renderFeatureCards()}
        </View>
        
        {/* Recent Activity */}
        {renderRecentActivity()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 30, // Accounts for status bar
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    marginLeft: 15,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeHeading: {
    fontSize: 18,
    marginBottom: 5,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  quickActionButton: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  featuredCardsContainer: {
    paddingBottom: 10,
    paddingRight: 20,
  },
  featureCard: {
    width: Math.min(260, width * 0.65),
    height: Math.min(160, width * 0.38),
    marginRight: 15,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  featureCardBg: {
    flex: 1,
  },
  featureCardImage: {
    borderRadius: 16,
  },
  featureCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 16,
    justifyContent: 'space-between',
  },
  featureCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  featureCardDesc: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.9,
  },
  activityContainer: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
  },
  devMenu: {
    padding: 12,
    margin: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  devMenuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  devMenuButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  devButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  devButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  devMenuSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
}); 