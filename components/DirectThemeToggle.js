import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

/**
 * High-performance animated theme toggle.
 * Uses TWO separate Animated.Values:
 *   - nativeAnim: drives transforms (translateX, scale, rotate) via native driver
 *   - colorAnim:  drives track background color via JS driver
 * This avoids the native/JS driver conflict that caused lagginess.
 */
export default function DirectThemeToggle({ style, showLabel = false }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  
  // Separate values for native-driver transforms and JS-driver colors
  const nativeAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;
  const colorAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;
  
  // Pre-compute all interpolations (memoised, stable references)
  const animations = useMemo(() => ({
    thumbTranslateX: nativeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [2, 26],
      extrapolate: 'clamp',
    }),
    thumbScale: nativeAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.2, 1],
      extrapolate: 'clamp',
    }),
    sunOpacity: nativeAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0.4, 0],
      extrapolate: 'clamp',
    }),
    moonOpacity: nativeAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.4, 1],
      extrapolate: 'clamp',
    }),
    sunRotation: nativeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    }),
    moonRotation: nativeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['-45deg', '0deg'],
    }),
    // Color interpolation on its OWN value — driven by JS-driver timing
    trackBg: colorAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['#e0e7ff', '#312e81'],
      extrapolate: 'clamp',
    }),
  }), [nativeAnim, colorAnim]);
  
  // Run both animations in parallel when theme changes
  useEffect(() => {
    const target = isDarkMode ? 1 : 0;

    // Native-driver spring for transforms (fast, 60 fps)
    Animated.spring(nativeAnim, {
      toValue: target,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    }).start();

    // JS-driver timing for color (short, avoids long interpolation)
    Animated.timing(colorAnim, {
      toValue: target,
      duration: 200,
      useNativeDriver: false, // colors require JS driver
    }).start();
  }, [isDarkMode, nativeAnim, colorAnim]);
  
  const handleToggle = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);
  
  return (
    <View style={[styles.container, style]}>
      {showLabel && (
        <Text style={[styles.label, { color: theme.text }]}>
          {isDarkMode ? 'Dark Mode' : 'Light Mode'}
        </Text>
      )}
      
      <Pressable 
        onPress={handleToggle}
        style={({ pressed }) => [
          styles.toggleContainer,
          pressed && styles.pressed
        ]}
        android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: true }}
      >
        {/* Track — JS-driven color */}
        <Animated.View style={[
          styles.toggleTrack,
          { backgroundColor: animations.trackBg }
        ]}>
          {/* Thumb — native-driven transforms */}
          <Animated.View style={[
            styles.toggleThumb,
            { 
              transform: [
                { translateX: animations.thumbTranslateX },
                { scale: animations.thumbScale }
              ],
              backgroundColor: isDarkMode ? '#a5b4fc' : '#ffffff'
            }
          ]}>
            <Animated.View style={[
              styles.iconContainer,
              { 
                opacity: animations.sunOpacity,
                transform: [{ rotate: animations.sunRotation }] 
              }
            ]}>
              <Ionicons name="sunny" size={14} color="#f59e0b" />
            </Animated.View>
            
            <Animated.View style={[
              styles.iconContainer,
              styles.moonIcon,
              { 
                opacity: animations.moonOpacity,
                transform: [{ rotate: animations.moonRotation }] 
              }
            ]}>
              <Ionicons name="moon" size={14} color="#f1f5f9" />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 10,
  },
  toggleContainer: {
    position: 'relative',
    padding: 4,
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.85,
  },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 20,
    justifyContent: 'center',
  },
  toggleThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moonIcon: {
    transform: [{ rotate: '-45deg' }]
  }
}); 