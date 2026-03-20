import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  Platform,
  Dimensions,
  Animated,
  PanResponder,
  BackHandler
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Sidebar from './Sidebar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomTabBar from './BottomTabBar';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { EventRegister } from 'react-native-event-listeners';

const { width, height } = Dimensions.get('window');
const EDGE_SWIPE_WIDTH = 50; // px from left edge to trigger swipe
const SWIPE_OPEN_THRESHOLD = 40; // px of rightward drag needed to open

// Must match Sidebar.js
const SIDEBAR_WIDTH = width * 0.78;

// Add event name constant
export const NOTIFICATION_COUNT_CHANGED = 'NOTIFICATION_COUNT_CHANGED';

// Main tab routes — these show the hamburger menu, NOT a back button
const MAIN_TAB_ROUTES = ['/home', '/announcements', '/bills', '/complaints', '/visitors'];

/**
 * AppLayout component to wrap all app screens with consistent UI elements
 * Enhanced with flicker-free transitions
 */

// Add NotificationsButton component - memoized to prevent unnecessary re-renders
const NotificationsButton = memo(({ theme }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const subscriptionRef = useRef(null);
  const channelRef = useRef(null);
  const lastCheckTimeRef = useRef(Date.now());
  const pollingIntervalRef = useRef(null);

  const fetchNotificationCount = async (forceUpdate = false) => {
    if (!user?.id) {
      setNotificationCount(0);
      setIsLoading(false);
      return;
    }

    try {
      // Get total unread count with a more efficient query
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (countError) {
        // Fallback to fetching all notifications
        const { data, error } = await supabase
          .from('notifications')
          .select('id') // Only select ID for faster query
          .eq('user_id', user.id)
          .eq('read', false);

        if (error) {
          setNotificationCount(0);
        } else {
          const unreadCount = data?.length || 0;
          if (forceUpdate || unreadCount !== notificationCount) {
            setNotificationCount(unreadCount);
            // Trigger animation for new notifications
            if (unreadCount > notificationCount) {
              Animated.sequence([
                Animated.timing(scaleAnim, {
                  toValue: 1.3,
                  duration: 150,
                  useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                  toValue: 1,
                  duration: 150,
                  useNativeDriver: true,
                }),
              ]).start();
            }
          }
        }
      } else {
        const newCount = count || 0;
        if (forceUpdate || newCount !== notificationCount) {
          setNotificationCount(newCount);
          // Trigger animation for new notifications
          if (newCount > notificationCount) {
            Animated.sequence([
              Animated.timing(scaleAnim, {
                toValue: 1.3,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }
      }
    } catch (error) {
      setNotificationCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup real-time subscription
  const setupSubscription = useCallback(() => {
    if (!user?.id) return;

    // Cleanup existing subscription if any
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }
    
    // Create a new channel with a more specific name
    const channel = supabase.channel(`notifications-${user.id}-${Date.now()}`);
    channelRef.current = channel;

    // Subscribe to all notification changes
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Immediately fetch the updated count
        fetchNotificationCount(true);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchNotificationCount(true);
        } else {
          // Retry subscription after a short delay
          setTimeout(setupSubscription, 5000);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  // Setup polling interval
  const setupPolling = useCallback(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll every 30 seconds for new notifications (real-time handles instant updates)
    pollingIntervalRef.current = setInterval(() => {
      fetchNotificationCount(false);
    }, 30000); // Check every 30s as a fallback

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [user?.id]);

  // Setup event listener for manual updates
  const setupEventListener = useCallback(() => {
    if (subscriptionRef.current) {
      EventRegister.removeEventListener(subscriptionRef.current);
    }

    subscriptionRef.current = EventRegister.addEventListener(
      NOTIFICATION_COUNT_CHANGED,
      () => {
        fetchNotificationCount(true);
      }
    );

    return () => {
      if (subscriptionRef.current) {
        EventRegister.removeEventListener(subscriptionRef.current);
      }
    };
  }, []);

  // Initial setup and cleanup
  useEffect(() => {
    // Initial fetch
    fetchNotificationCount(true);
    
    // Setup real-time subscription
    const cleanupSubscription = setupSubscription();
    
    // Setup polling
    const cleanupPolling = setupPolling();
    
    // Setup event listener
    const cleanupEventListener = setupEventListener();

    return () => {
      cleanupSubscription?.();
      cleanupPolling?.();
      cleanupEventListener?.();
    };
  }, [user?.id, setupSubscription, setupPolling, setupEventListener]);

  return (
    <TouchableOpacity 
      style={[styles.notificationButton, { backgroundColor: theme.primary + '20' }]}
      onPress={() => router.push('/notifications')}
      activeOpacity={0.7}
    >
      <View style={{ position: 'relative' }}>
        <Ionicons name="notifications-outline" size={24} color={theme.primary} />
        {!isLoading && notificationCount > 0 && (
          <Animated.View 
            style={[
              styles.notificationBadge, 
              { 
                backgroundColor: '#FF3B30',
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <Text style={styles.notificationText}>
              {notificationCount > 99 ? '99+' : notificationCount}
            </Text>
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function AppLayout({ children, title, showBackButton, showBack, onBackPress, rightComponent }) {
  const { theme, isDarkMode } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const prevPathRef = useRef(pathname);
  const isSidebarOpenRef = useRef(false);

  // Auto-detect whether to show back button:
  // - If explicitly set via showBackButton or showBack prop, use that
  // - Otherwise, show back button on non-main-tab routes
  const isMainTab = MAIN_TAB_ROUTES.includes(pathname);
  const shouldShowBack = showBackButton !== undefined 
    ? showBackButton 
    : (showBack !== undefined ? showBack : !isMainTab);

  // Default onBackPress to router.back() if not provided
  const handleBackPress = onBackPress || (() => router.back());

  // Android hardware back button handling
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If sidebar is open, close it
      if (isSidebarOpenRef.current) {
        setIsSidebarOpen(false);
        return true;
      }
      // On sub-screens, go back
      if (!isMainTab) {
        router.back();
        return true;
      }
      // On main tabs (not home), go to home
      if (pathname !== '/home') {
        router.replace('/home');
        return true;
      }
      // On home screen, let the system handle it (exit app)
      return false;
    });

    return () => backHandler.remove();
  }, [pathname, isMainTab]);
  
  // Keep ref in sync for PanResponder (closures capture stale state)
  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);
  
  // Menu button animation - native driver only
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  
  // Page transition animations - native driver only
  const pageEnterAnim = useRef(new Animated.Value(0)).current;
  const pageOpacityAnim = useRef(new Animated.Value(1)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;

  // Shared animated value for sidebar position — drives ALL sidebar visuals
  const sidebarTranslateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  // Edge swipe to open sidebar — finger-following for premium feel
  const edgeSwipePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return !isSidebarOpenRef.current && gs.x0 < EDGE_SWIPE_WIDTH && gs.dx > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      },
      onPanResponderMove: (_, gs) => {
        // Sidebar follows the finger in real-time
        const x = Math.min(0, Math.max(-SIDEBAR_WIDTH, -SIDEBAR_WIDTH + gs.dx));
        sidebarTranslateX.setValue(x);
      },
      onPanResponderRelease: (_, gs) => {
        const position = Math.min(0, -SIDEBAR_WIDTH + gs.dx);
        if (position > -SIDEBAR_WIDTH * 0.45 || gs.vx > 0.5) {
          // Snap open
          Animated.spring(sidebarTranslateX, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }).start();
          setIsSidebarOpen(true);
        } else {
          // Snap back closed
          Animated.spring(sidebarTranslateX, {
            toValue: -SIDEBAR_WIDTH,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;
  
  // Run page transition animation when path changes
  useEffect(() => {
    // Skip initial animation (prevents flickering on first render)
    if (prevPathRef.current === pathname) {
      prevPathRef.current = pathname;
      return;
    }
    
    // Prepare for animation (preserve previous values)
    pageEnterAnim.setValue(3); // Minimal movement for snappy feel
    pageOpacityAnim.setValue(0.9); // High starting opacity to reduce flash
    headerTranslateY.setValue(-2); // Minimal movement
    headerOpacity.setValue(0.95); // Nearly full opacity
    
    // Run entrance animation - all using native driver with fast timing
    Animated.parallel([
      Animated.timing(pageEnterAnim, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true
      }),
      Animated.timing(pageOpacityAnim, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true
      }),
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true
      })
    ]).start();
    
    prevPathRef.current = pathname;
  }, [pathname]);
  
  const toggleSidebar = () => {
    // Animate the menu button - native driver only
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
    
    // Spin animation - native driver only
    Animated.timing(spinAnim, {
      toValue: spinAnim._value === 0 ? 1 : 0,
      duration: 150,
      useNativeDriver: true
    }).start();
    
    // Toggle sidebar
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  // Calculate padding for different platforms
  const topPadding = Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0;
  
  // Interpolate the rotation for the menu button
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });
  
  return (
    <View 
      style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : theme.background }]}
      {...edgeSwipePan.panHandlers}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      
      {/* Persistent background - helps prevent white flash */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDarkMode ? '#121212' : theme.background }]} />
      
      {/* App Header */}
      <Animated.View
        style={[
          styles.header,
          {
            backgroundColor: theme.card,
            paddingTop: topPadding,
            borderBottomColor: theme.border,
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {shouldShowBack ? (
              <TouchableOpacity 
                onPress={handleBackPress} 
                style={[styles.iconButton, { backgroundColor: theme.border + '80' }]}
              >
                <Ionicons name="arrow-back-outline" size={28} color={theme.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={toggleSidebar} 
                style={[
                  styles.iconButton, 
                  { 
                    backgroundColor: theme.primary + '30',
                  }
                ]}
                activeOpacity={0.7}
              >
                <Animated.View style={{
                  transform: [
                    { scale: scaleAnim },
                    { rotate: spin }
                  ]
                }}>
                  <Ionicons 
                    name={isSidebarOpen ? "close" : "menu"} 
                    size={28} 
                    color={theme.primary} 
                  />
                </Animated.View>
              </TouchableOpacity>
            )}
            <Text 
              style={[styles.headerTitle, { color: theme.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >{title}</Text>
          </View>
          
          <View style={styles.headerRight}>
            {rightComponent || <NotificationsButton theme={theme} />}
          </View>
        </View>
      </Animated.View>
      
      {/* Main Content with padding for bottom tab bar */}
      <Animated.View style={[
        styles.contentContainer,
        {
          opacity: pageOpacityAnim,
          transform: [{ translateY: pageEnterAnim }]
        }
      ]}>
        <View style={[styles.content, { paddingBottom: 60 + Math.max(insets.bottom, 0) }]}>
          {children}
        </View>
      </Animated.View>
      
      {/* Bottom Tab Bar */}
      <BottomTabBar />
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        translateX={sidebarTranslateX}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    // Adding reduced animation delay and hardware acceleration
    backfaceVisibility: 'hidden',
    // Prevent flicker during transitions
    ...(Platform.OS === 'ios' ? { 
      shadowOpacity: 0,
      shadowRadius: 0,
    } : {
      // Enable hardware acceleration on Android
      renderToHardwareTextureAndroid: true,
      elevation: 0,
    }),
  },
  header: {
    height: Platform.OS === 'ios' ? 130 : 110,
    borderBottomWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    justifyContent: 'flex-end',
    zIndex: 10, // Ensure header is above content during transitions
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    height: 70,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -4, // Move right component more towards the edge
  },
  iconButton: {
    padding: 12,
    borderRadius: 14,
    marginRight: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  notificationButton: {
    padding: 10,
    borderRadius: 14,
    marginRight: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30', // iOS-style red
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    // Remove border and shadow for cleaner look
    borderWidth: 0,
    // Add a subtle inner shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 3,
    // Ensure the badge is always on top
    zIndex: 1000,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    // Remove text shadow for cleaner look
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    // Ensure text is crisp
    includeFontPadding: false,
    textAlignVertical: 'center',
    // Add letter spacing for better readability
    letterSpacing: 0.2,
  },
}); 