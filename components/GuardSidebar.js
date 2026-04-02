import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  StatusBar,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import DirectThemeToggle from './DirectThemeToggle';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { EventRegister } from 'react-native-event-listeners';
import { SIDEBAR_STATE_CHANGED } from '../app/(guard)/_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

// Define menuItems outside the component
const menuItems = [
  {
    icon: 'grid-outline',
    label: 'Dashboard',
    route: '/guard-dashboard',
  },
  {
    icon: 'people-outline',
    label: 'Visitors',
    route: '/guard-visitors',
  },
  {
    icon: 'person-outline',
    label: 'Profile',
    route: '/guard-profile',
  },
  {
    icon: 'information-circle-outline',
    label: 'About Us',
    route: '/guard-about',
  },
];

export default function GuardSidebar({ visible, onClose, guardData }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Animation values with improved spring config
  const translateXAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const menuItemAnimations = useRef(menuItems.map(() => new Animated.Value(0))).current;
  
  useEffect(() => {
    // Emit sidebar state change
    EventRegister.emit(SIDEBAR_STATE_CHANGED, { isOpen: visible });

    if (visible) {
      // Reset values
      translateXAnim.setValue(-SIDEBAR_WIDTH);
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.95);
      menuItemAnimations.forEach(anim => anim.setValue(0));
      
      // Run entrance animations with faster timing
      Animated.sequence([
        // First animate the sidebar container with faster spring
        Animated.parallel([
          Animated.spring(translateXAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 75,
            friction: 9,
            velocity: 5,
            restDisplacementThreshold: 0.01,
            restSpeedThreshold: 0.01,
          }),
          Animated.spring(opacityAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 75,
            friction: 9,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 75,
            friction: 9,
          }),
        ]),
        // Then animate menu items with faster stagger
        Animated.stagger(
          30,
          menuItemAnimations.map(anim =>
            Animated.spring(anim, {
              toValue: 1,
              useNativeDriver: true,
              tension: 75,
              friction: 9,
            })
          )
        ),
      ]).start();
    } else {
      // Run exit animations with faster timing
      Animated.parallel([
        Animated.spring(translateXAnim, {
          toValue: -SIDEBAR_WIDTH,
          useNativeDriver: true,
          tension: 75,
          friction: 9,
          velocity: 5,
        }),
        Animated.spring(opacityAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 75,
          friction: 9,
        }),
        Animated.spring(scaleAnim, {
          toValue: 0.95,
          useNativeDriver: true,
          tension: 75,
          friction: 9,
        }),
        ...menuItemAnimations.map(anim =>
          Animated.spring(anim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 75,
            friction: 9,
          })
        ),
      ]).start();
    }
  }, [visible]);

  const handleNavigation = (route) => {
    onClose();
    setTimeout(() => {
      router.push(route);
    }, 300);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('guard_data');
      router.replace('/guard-login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      {/* Overlay with its own opacity animation */}
      <Animated.View
        style={[
          styles.overlay,
          { 
            opacity: opacityAnim,
            pointerEvents: visible ? 'auto' : 'none'
          }
        ]}
      >
        <TouchableOpacity
          style={{ width: '100%', height: '100%' }}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>
      
      {/* Sidebar with translateX animation */}
      <Animated.View
        style={[
          styles.container,
          { 
            backgroundColor: theme.background,
            transform: [
              { translateX: translateXAnim },
              { scale: scaleAnim }
            ],
            borderRightColor: theme.border,
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom,
          }
        ]}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoBackground, { backgroundColor: theme.primary + '15' }]}>
              <Image source={require('../assets/images/msd-logo.jpeg')} style={styles.logoImage} />
            </View>
            <Text style={[styles.logoText, { color: theme.text }]}>Guard Portal</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.userInfoContainer}
            onPress={() => {
              router.push('/guard-profile');
              onClose();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.avatarContainer, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="person" size={28} color={theme.primary} />
            </View>
            <View style={styles.userTextContainer}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {guardData?.name || 'Security Guard'}
              </Text>
              <Text style={[styles.userRole, { color: theme.text + 'CC' }]}>
                Security Guard
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={[styles.themeToggleContainer, { borderBottomColor: theme.border }]}>
          <DirectThemeToggle style={styles.themeToggle} showLabel={true} />
        </View>
        
        <ScrollView 
          style={styles.menuContainer}
          showsVerticalScrollIndicator={false}
        >
          {menuItems.map((item, index) => {
            const menuItemAnimation = menuItemAnimations[index];
            const translateY = menuItemAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            });
            const opacity = menuItemAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            });
            
            return (
              <Animated.View
                key={index}
                style={[
                  styles.menuItemContainer,
                  {
                    transform: [{ translateY }],
                    opacity,
                  }
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    pathname === item.route && { backgroundColor: `${theme.primary}15` }
                  ]}
                  onPress={() => handleNavigation(item.route)}
                >
                  <View style={[
                    styles.menuIconContainer, 
                    pathname === item.route && { backgroundColor: theme.primary + '20' }
                  ]}>
                    <Ionicons 
                      name={item.icon} 
                      size={24} 
                      color={pathname === item.route ? theme.primary : theme.text + 'CC'} 
                    />
                  </View>
                  <Text 
                    style={[
                      styles.menuItemText, 
                      { 
                        color: pathname === item.route ? theme.primary : theme.text + 'CC'
                      }
                    ]}
                  >
                    {item.label}
                  </Text>
                  {pathname === item.route && (
                    <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
        
        <Animated.View
          style={[
            styles.signOutContainer,
            {
              transform: [{ translateY: menuItemAnimations[menuItems.length - 1] }],
              opacity: menuItemAnimations[menuItems.length - 1],
            }
          ]}
        >
          <TouchableOpacity
            style={[styles.signOutButton, { borderTopColor: theme.border }]}
            onPress={handleSignOut}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: (theme.error || "#F72585") + '15' }]}>
              <Ionicons name="log-out-outline" size={24} color={theme.error || "#F72585"} />
            </View>
            <Text style={[styles.signOutText, { color: theme.error || "#F72585" }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    borderRightWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingTop: 10,
    zIndex: 1000,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    paddingBottom: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBackground: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 15,
  },
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuContainer: {
    flex: 1,
    paddingTop: 12,
  },
  menuItemContainer: {
    marginBottom: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    position: 'relative',
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '500',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  signOutContainer: {
    marginTop: 'auto',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '500',
  },
}); 