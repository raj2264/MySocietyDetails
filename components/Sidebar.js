import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  PanResponder
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DirectThemeToggle from './DirectThemeToggle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
export const SIDEBAR_WIDTH = width * 0.78;
const SWIPE_CLOSE_THRESHOLD = SIDEBAR_WIDTH * 0.3;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

// Consistent spring configs
const OPEN_SPRING = { tension: 65, friction: 11, useNativeDriver: true };
const CLOSE_SPRING = { tension: 75, friction: 12, useNativeDriver: true };

export default function Sidebar({ isOpen, onClose, translateX }) {
  const { theme, isDarkMode } = useTheme();
  const { user, signOut, residentData } = useAuth();
  const router = useRouter();
  const currentPath = usePathname();
  const insets = useSafeAreaInsets();
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  
  // Staggered menu item animations
  const menuItemAnims = useRef(
    Array.from({ length: 22 }, () => new Animated.Value(0))
  ).current;
  
  // ALL visual properties derived from the single shared translateX
  const overlayOpacity = translateX.interpolate({
    inputRange: [-SIDEBAR_WIDTH, 0],
    outputRange: [0, 0.55],
    extrapolate: 'clamp',
  });
  
  const sidebarScale = translateX.interpolate({
    inputRange: [-SIDEBAR_WIDTH, -SIDEBAR_WIDTH * 0.3, 0],
    outputRange: [0.95, 0.98, 1],
    extrapolate: 'clamp',
  });
  
  const sidebarOpacity = translateX.interpolate({
    inputRange: [-SIDEBAR_WIDTH, -SIDEBAR_WIDTH * 0.5, 0],
    outputRange: [0, 0.85, 1],
    extrapolate: 'clamp',
  });
  
  // Close gesture on overlay — finger-following
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return gs.dx < -10 && Math.abs(gs.dy) < Math.abs(gs.dx) * 1.5;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.min(0, gs.dx));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_CLOSE_THRESHOLD || gs.vx < -SWIPE_VELOCITY_THRESHOLD) {
          Animated.spring(translateX, { toValue: -SIDEBAR_WIDTH, ...CLOSE_SPRING }).start();
          onClose();
        } else {
          Animated.spring(translateX, { toValue: 0, ...OPEN_SPRING }).start();
        }
      },
    })
  ).current;
  
  // Animate on isOpen state changes (button tap or programmatic)
  useEffect(() => {
    if (isOpen) {
      menuItemAnims.forEach(a => a.setValue(0));
      
      Animated.spring(translateX, { toValue: 0, ...OPEN_SPRING }).start();
      
      // Stagger menu items
      const staggerAnims = menuItemAnims.map((anim, i) =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 180,
          friction: 14,
          delay: i * 8,
          useNativeDriver: true,
        })
      );
      Animated.stagger(8, staggerAnims).start();
    } else {
      Animated.spring(translateX, { toValue: -SIDEBAR_WIDTH, ...CLOSE_SPRING }).start();
      menuItemAnims.forEach(a => a.setValue(0));
    }
  }, [isOpen]);
  
  const menuItems = [
    { icon: 'home-outline', label: 'Home', route: '/home' },
    { icon: 'person-outline', label: 'Profile', route: '/profile' },
    { icon: 'people-outline', label: 'Visitors', route: '/visitors' },
    { icon: 'car-outline', label: 'My Vehicles', route: '/vehicles' },
    { icon: 'flash-outline', label: 'EV Charging', route: '/ev-charging' },
    { icon: 'chatbox-ellipses-outline', label: 'Complaints', route: '/complaints' },
    { icon: 'document-text-outline', label: 'Bills & Payments', route: '/bills' },
    { icon: 'business-outline', label: 'Apartment Listings', route: '/apartment-listings' },
    { icon: 'cash-outline', label: 'Payments', route: '/payments' },
    { icon: 'calendar-outline', label: 'Meetings', route: '/meetings' },
    { icon: 'construct-outline', label: 'Services', route: '/services', color: '#4361EE' },
    { icon: 'calendar-number-outline', label: 'Bookings', route: '/bookings' },
    { icon: 'notifications-outline', label: 'Notifications', route: '/notifications' },
    { icon: 'megaphone-outline', label: 'Announcements', route: '/announcements' },
    { icon: 'bar-chart-outline', label: 'Polls', route: '/polls' },
    { icon: 'shield-checkmark-outline', label: 'Emergency Contacts', route: '/security-contacts' },
    { icon: 'information-circle-outline', label: 'About Us', route: '/about' },
    { icon: 'document-text-outline', label: 'Essential Documents', route: '/documents' }
  ];
  
  const requestItems = [
    { icon: 'document-text-outline', label: 'LIC Request', route: '/lic-request' },
    { icon: 'briefcase-outline', label: 'CA Request', route: '/ca-request', color: '#4361EE' }
  ];
  
  const handleNavigation = useCallback((route) => {
    onClose();
    // Skip if already on this route
    if (currentPath === route) return;
    // For home, replace to avoid stacking multiple home entries
    if (route === '/home') {
      router.replace(route);
    } else {
      // Push so back gesture works
      router.push(route);
    }
  }, [onClose, router, currentPath]);
  
  const handleSignOut = useCallback(async () => {
    onClose();
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [onClose, signOut, router]);
  
  const toggleRequests = useCallback(() => {
    setIsRequestsOpen(prev => !prev);
  }, []);

  const isRequestActive = (route) => {
    return currentPath === route;
  };

  const isAnyRequestActive = () => {
    return requestItems.some(item => isRequestActive(item.route));
  };
  
  // Helper to get staggered animation style for a menu item
  const getItemStyle = (index) => ({
    opacity: menuItemAnims[index] || 1,
    transform: [{
      translateX: (menuItemAnims[index] || new Animated.Value(1)).interpolate({
        inputRange: [0, 1],
        outputRange: [-30, 0],
        extrapolate: 'clamp',
      })
    }],
  });
  
  return (
    <>
      {/* Overlay — opacity derived from sidebar position, with swipe-to-close */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.overlay,
          { 
            opacity: overlayOpacity,
            pointerEvents: isOpen ? 'auto' : 'none'
          }
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>
      
      {/* Sidebar panel — all visuals derived from translateX */}
      <Animated.View
        style={[
          styles.container,
          { 
            backgroundColor: theme.background,
            transform: [
              { translateX: translateX },
              { scale: sidebarScale }
            ],
            opacity: sidebarOpacity,
            borderRightColor: theme.border,
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom,
          }
        ]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoBackground, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="home" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.logoText, { color: theme.text }]}>MySociety</Text>
          </View>
          <View style={styles.userInfoContainer}>
            <Image 
              source={{ 
                uri: user?.user_metadata?.avatar_url || 'https://xsgames.co/randomusers/avatar.php?g=pixel' 
              }}
              style={styles.avatar}
            />
            <View style={styles.userTextContainer}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {residentData?.name || user?.user_metadata?.full_name || 'User'}
              </Text>
              <Text style={[styles.userUnitNumber, { color: isDarkMode ? '#bbb' : '#666', marginBottom: 4 }]}>
                {residentData?.unit_number ? `Unit ${residentData.unit_number}` : ''}
              </Text>
              <Text style={[styles.userEmail, { color: isDarkMode ? '#aaa' : '#666' }]}>
                {user?.email}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={[styles.themeToggleContainer, { borderBottomColor: theme.border }]}>
          <DirectThemeToggle style={styles.themeToggle} showLabel={true} />
        </View>
        
        <ScrollView 
          style={styles.menuContainer}
          showsVerticalScrollIndicator={false}
        >
          {menuItems.slice(0, 7).map((item, index) => (
            <Animated.View key={index} style={getItemStyle(index)}>
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  currentPath === item.route && { backgroundColor: `${theme.primary}20` }
                ]}
                onPress={() => handleNavigation(item.route)}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIconContainer, currentPath === item.route && { backgroundColor: theme.primary + '30' }]}>
                  <Ionicons 
                    name={item.icon} 
                    size={22} 
                    color={currentPath === item.route ? theme.primary : theme.text + '99'} 
                  />
                </View>
                <Text 
                  style={[
                    styles.menuItemText, 
                    { 
                      color: currentPath === item.route ? theme.primary : theme.text 
                    }
                  ]}
                >
                  {item.label}
                </Text>
                {currentPath === item.route && (
                  <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}

          {/* Requests Section */}
          <Animated.View style={getItemStyle(7)}>
            <TouchableOpacity
              style={[
                styles.menuItem,
                (isRequestsOpen || isAnyRequestActive()) && { backgroundColor: `${theme.primary}20` }
              ]}
              onPress={toggleRequests}
              activeOpacity={0.6}
            >
              <View style={[
                styles.menuIconContainer, 
                (isRequestsOpen || isAnyRequestActive()) && { backgroundColor: theme.primary + '30' }
              ]}>
                <Ionicons 
                  name="document-text-outline" 
                  size={22} 
                  color={(isRequestsOpen || isAnyRequestActive()) ? theme.primary : theme.text + '99'} 
                />
              </View>
              <Text 
                style={[
                  styles.menuItemText, 
                  { 
                    color: (isRequestsOpen || isAnyRequestActive()) ? theme.primary : theme.text 
                  }
                ]}
              >
                Requests
              </Text>
              <Ionicons 
                name={isRequestsOpen ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={theme.text + '99'} 
                style={styles.chevronIcon}
              />
              {(isRequestsOpen || isAnyRequestActive()) && (
                <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Request Submenu */}
          {isRequestsOpen && (
            <View style={styles.submenuContainer}>
              {requestItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.submenuItem,
                    isRequestActive(item.route) && { backgroundColor: `${theme.primary}15` }
                  ]}
                  onPress={() => handleNavigation(item.route)}
                >
                  <View style={[
                    styles.submenuIconContainer,
                    isRequestActive(item.route) && { backgroundColor: theme.primary + '20' }
                  ]}>
                    <Ionicons 
                      name={item.icon} 
                      size={20} 
                      color={isRequestActive(item.route) ? theme.primary : theme.text + '99'} 
                    />
                  </View>
                  <Text 
                    style={[
                      styles.submenuItemText, 
                      { 
                        color: isRequestActive(item.route) ? theme.primary : theme.text 
                      }
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isRequestActive(item.route) && (
                    <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {menuItems.slice(7).map((item, index) => (
            <Animated.View key={index} style={getItemStyle(index + 8 + requestItems.length)}>
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  currentPath === item.route && { backgroundColor: `${theme.primary}20` }
                ]}
                onPress={() => handleNavigation(item.route)}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIconContainer, currentPath === item.route && { backgroundColor: theme.primary + '30' }]}>
                  <Ionicons 
                    name={item.icon} 
                    size={22} 
                    color={currentPath === item.route ? theme.primary : theme.text + '99'} 
                  />
                </View>
                <Text 
                  style={[
                    styles.menuItemText, 
                    { 
                      color: currentPath === item.route ? theme.primary : theme.text 
                    }
                  ]}
                >
                  {item.label}
                </Text>
                {currentPath === item.route && (
                  <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
        
        <TouchableOpacity
          style={[styles.signOutButton, { borderTopColor: theme.border }]}
          onPress={handleSignOut}
        >
          <View style={[styles.menuIconContainer, { backgroundColor: (theme.error || "#F72585") + '20' }]}>
            <Ionicons name="log-out-outline" size={22} color={theme.error || "#F72585"} />
          </View>
          <Text style={[styles.signOutText, { color: theme.error || "#F72585" }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 999,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    borderRightWidth: 1,
    zIndex: 1000,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    paddingTop: 10,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBackground: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userUnitNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  userEmail: {
    fontSize: 14,
  },
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  themeToggle: {
    // Add any necessary styles for the DirectThemeToggle component
  },
  menuContainer: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    position: 'relative',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
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
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
  },
  submenuContainer: {
    marginLeft: 16,
    marginBottom: 8,
  },
  submenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 16,
    position: 'relative',
    borderRadius: 8,
    marginBottom: 4,
  },
  submenuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  submenuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  chevronIcon: {
    marginLeft: 'auto',
    marginRight: 8,
  },
}); 