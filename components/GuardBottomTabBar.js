import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, Animated, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const TAB_WIDTH = width / 3; // 3 tabs
const GUARD_TAB_BAR_CONTENT_HEIGHT = 55;

/**
 * Bottom Tab Bar for the Guard App with optimized animations
 */
export default function GuardBottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const { theme } = useTheme();
  const previousPathRef = useRef(pathname);
  
  // Animation values - all using native driver
  const indicatorX = useRef(new Animated.Value(0)).current;
  const tabAnimations = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  
  const routes = [
    {
      name: "guard-dashboard",
      label: "Dashboard",
      icon: "grid-outline",
      activeIcon: "grid",
    },
    {
      name: "guard-visitors",
      label: "Visitors",
      icon: "people-outline",
      activeIcon: "people",
    },
    {
      name: "guard-profile",
      label: "Profile",
      icon: "person-outline",
      activeIcon: "person",
    },
  ];
  
  // Find current tab index
  const currentTabIndex = routes.findIndex(route => route.name === pathname.split('/')[1]);
  
  // Pre-initialize animation values
  useEffect(() => {
    if (currentTabIndex >= 0) {
      indicatorX.setValue(currentTabIndex * TAB_WIDTH);
      routes.forEach((_, index) => {
        tabAnimations[index].setValue(index === currentTabIndex ? 1 : 0);
      });
    }
  }, []);
  
  // Update animations when path changes
  useEffect(() => {
    if (currentTabIndex >= 0 && previousPathRef.current !== pathname) {
      // Animate indicator
      Animated.spring(indicatorX, {
        toValue: currentTabIndex * TAB_WIDTH,
        useNativeDriver: true,
        tension: 50,
        friction: 7
      }).start();
      
      // Animate tabs
      routes.forEach((_, index) => {
        Animated.spring(tabAnimations[index], {
          toValue: index === currentTabIndex ? 1 : 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7
        }).start();
      });
      
      previousPathRef.current = pathname;
    }
  }, [pathname, currentTabIndex]);
  
  const handleNavigation = (route) => {
    // Don't navigate if already on this route
    if (route === pathname) return;
    
    // Platform-specific optimization
    if (Platform.OS === 'android') {
      // On Android, direct navigation works best to avoid flicker
      router.push(`/${route}`);
      return;
    }
    
    // For iOS, use minimal animation
    Animated.timing(tabAnimations[currentTabIndex], {
      toValue: 0.9, // Less extreme for smoother feel
      duration: 40, // Ultra fast
      useNativeDriver: true
    }).start();
    
    // Navigate immediately - no delay helps reduce flickering
    router.push(`/${route}`);
  };
  
  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: GUARD_TAB_BAR_CONTENT_HEIGHT + bottomInset,
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
        
        // Animations for the tab
        const scale = tabAnimations[index].interpolate({
          inputRange: [0, 0.85, 1],
          outputRange: [0.95, 0.9, 1.05]
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
          outputRange: [0, -3]
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
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 9999,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TAB_WIDTH,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
}); 