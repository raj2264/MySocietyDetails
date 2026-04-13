import React, { useState, useEffect, useRef, memo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, Animated, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const TAB_WIDTH = width / 5;
const TAB_BAR_CONTENT_HEIGHT = 60;

/**
 * Ultra-smooth Bottom Tab Bar for navigation with optimized animations
 */
export default memo(function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, isDarkMode } = useTheme();
  const { residentData } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const previousPathRef = useRef(pathname);
  
  // Initialize animation values properly
  const indicatorX = useRef(new Animated.Value(0)).current;
  const tabAnimations = useRef(
    Array(5).fill(0).map(() => new Animated.Value(0))
  ).current;
  
  const routes = [
    {
      name: "home",
      label: "Home",
      icon: "home-outline",
      activeIcon: "home",
    },
    {
      name: "announcements",
      label: "Notices",
      icon: "megaphone-outline",
      activeIcon: "megaphone",
    },
    {
      name: "bills",
      label: "Bills",
      icon: "document-text-outline",
      activeIcon: "document-text",
    },
    {
      name: "complaints",
      label: "Complaints",
      icon: "alert-circle-outline",
      activeIcon: "alert-circle",
    },
    {
      name: "visitors",
      label: "Visitors",
      icon: "people-outline",
      activeIcon: "people",
    }
  ];
  
  // Find current tab index
  const currentTabIndex = routes.findIndex(route => route.name === pathname.split('/')[1]);
  
  // Pre-initialize animation values (optimize initial render)
  useEffect(() => {
    if (currentTabIndex >= 0) {
      indicatorX.setValue(currentTabIndex * TAB_WIDTH);
      routes.forEach((_, index) => {
        tabAnimations[index].setValue(index === currentTabIndex ? 1 : 0);
      });
    }
  }, []);
  
  // Animate tab indicator when current path changes
  useEffect(() => {
    // Skip animation on first render
    if (previousPathRef.current === pathname) {
      previousPathRef.current = pathname;
      return;
    }
    
    if (currentTabIndex >= 0) {
      // Animate the indicator - using native driver with better spring config
      Animated.spring(indicatorX, {
        toValue: currentTabIndex * TAB_WIDTH,
        friction: 9, // Increased friction for smoother motion
        tension: 65, // Increased tension for faster initial movement
        useNativeDriver: true
      }).start();
      
      // Animate active tab with spring for better feel
      if (currentTabIndex >= 0) {
        Animated.spring(tabAnimations[currentTabIndex], {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true
        }).start();
      }
      
      // Animate inactive tabs
      routes.forEach((_, index) => {
        if (index !== currentTabIndex) {
          Animated.timing(tabAnimations[index], {
            toValue: 0,
            duration: 150, // Faster fade out
            useNativeDriver: true
          }).start();
        }
      });
    }
    
    previousPathRef.current = pathname;
  }, [pathname, currentTabIndex]);
  
  const handleNavigation = (route) => {
    // Don't navigate if already on this route
    if (`/${route}` === pathname) return;
    
    // Platform-specific optimization
    if (Platform.OS === 'android') {
      // On Android, replace instead of push to avoid stack buildup
      router.replace(`/${route}`);
      return;
    }
    
    // For iOS, animate only when current route maps to a tab index.
    if (currentTabIndex >= 0 && tabAnimations[currentTabIndex]) {
      Animated.timing(tabAnimations[currentTabIndex], {
        toValue: 0.9, // Less extreme for smoother feel
        duration: 40, // Ultra fast
        useNativeDriver: true
      }).start();
    }
    
    // Navigate with replace to avoid stacking screens
    router.replace(`/${route}`);
  };
  
  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
        }
      ]}
    >
      {/* Animated indicator */}
      <Animated.View 
        style={[
          styles.indicator, 
          {
            backgroundColor: theme.primary + '20',
            transform: [{ translateX: indicatorX }]
          }
        ]}
      />
      
      {/* Tab buttons */}
      {routes.map((route, index) => {
        const isActive = pathname === `/${route.name}`;
        
        // Animations for the tab - using interpolation with native values
        const scale = tabAnimations[index].interpolate({
          inputRange: [0, 0.85, 1],
          outputRange: [0.95, 0.9, 1.05] // Enhance scale animation
        });
        
        const iconOpacity = tabAnimations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1]
        });
        
        const textOpacity = tabAnimations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1]
        });
        
        // Add vertical shift for active tab
        const translateY = tabAnimations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -3] // Slight upward movement for active tab
        });
        
        return (
          <TouchableOpacity
            key={route.name}
            style={styles.tab}
            onPress={() => handleNavigation(route.name)}
            activeOpacity={0.7}
          >
            <Animated.View style={{
              alignItems: 'center',
              transform: [
                { scale },
                { translateY }
              ]
            }}>
              <Animated.View style={{ opacity: iconOpacity }}>
                <Ionicons
                  name={isActive ? route.activeIcon : route.icon}
                  size={24}
                  color={isActive ? theme.primary : theme.text + '80'}
                />
              </Animated.View>
              
              <Animated.Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? theme.primary : theme.text + '80',
                    fontWeight: isActive ? '600' : '400',
                    opacity: textOpacity
                  }
                ]}
              >
                {route.label}
              </Animated.Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10, // Ensure tab bar is above content during transitions
  },
  indicator: {
    width: TAB_WIDTH,
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 16,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
}); 