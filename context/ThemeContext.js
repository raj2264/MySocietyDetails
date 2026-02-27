import React, { createContext, useState, useContext, useEffect, useCallback, useRef, useMemo } from 'react';
import { useColorScheme, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'mysociety.theme.mode';

// Light theme colors
export const lightTheme = {
  background: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
  card: '#F8F9FA',
  cardElevated: '#FFFFFF',
  border: '#E0E0E0',
  inputBg: '#F5F5F5',
  placeholderText: '#9E9E9E',
  primary: '#4361EE',
  secondary: '#7209B7',
  success: '#4CC9F0',
  error: '#FF6B6B',
  warning: '#FB8500',
  info: '#3A86FF',
};

// Dark theme colors
export const darkTheme = {
  background: '#121212',
  text: '#F8F9FA',
  textSecondary: '#A0A0A0',
  card: '#1E1E1E',
  cardElevated: '#2C2C2C',
  border: '#3A3A3A',
  inputBg: '#2A2A2A',
  placeholderText: '#808080',
  primary: '#5D7BFF',
  secondary: '#9D4EDD',
  success: '#64DFFF',
  error: '#FF8A8A',
  warning: '#FFA94D',
  info: '#70A9FF',
};

// Create animated colors for beautiful transitions
// Important: These are JS-only animations (useNativeDriver: false)
const createAnimatedColors = () => {
  // Create animated values for each color
  const animValues = {
    background: new Animated.Value(0),
    text: new Animated.Value(0),
    textSecondary: new Animated.Value(0),
    card: new Animated.Value(0),
    cardElevated: new Animated.Value(0),
    border: new Animated.Value(0),
    inputBg: new Animated.Value(0),
    placeholderText: new Animated.Value(0),
    primary: new Animated.Value(0),
    secondary: new Animated.Value(0),
    success: new Animated.Value(0),
    error: new Animated.Value(0),
    warning: new Animated.Value(0),
    info: new Animated.Value(0),
  };
  
  // Convert hex to rgb for proper color interpolation
  const hexToRgb = (hex) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };
  
  // Create animated colors
  const animColors = {};
  for (const key in lightTheme) {
    const lightRGB = hexToRgb(lightTheme[key]);
    const darkRGB = hexToRgb(darkTheme[key]);
    
    animColors[key] = animValues[key].interpolate({
      inputRange: [0, 1],
      outputRange: [
        `rgb(${lightRGB.r}, ${lightRGB.g}, ${lightRGB.b})`,
        `rgb(${darkRGB.r}, ${darkRGB.g}, ${darkRGB.b})`
      ]
    });
  }
  
  return { animValues, animColors };
};

// Create the theme context with default values
const ThemeContext = createContext({
  isDarkMode: false,
  toggleTheme: () => {},
  theme: lightTheme,
});

// Theme provider component with optimized state management
export const ThemeProvider = ({ children }) => {
  const deviceColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const isInitialized = useRef(false);
  const pendingUpdate = useRef(false);

  // Memoize the current theme to prevent unnecessary recalculations
  const theme = useMemo(() => 
    isDarkMode ? darkTheme : lightTheme,
    [isDarkMode]
  );

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      if (isInitialized.current) return;
      
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const initialValue = savedTheme === 'dark' || (savedTheme === null && deviceColorScheme === 'dark');
        setIsDarkMode(initialValue);
        isInitialized.current = true;
      } catch (error) {
        console.error('ThemeContext: Error loading theme preference:', error);
        setIsDarkMode(deviceColorScheme === 'dark');
        isInitialized.current = true;
      }
    };
    
    loadThemePreference();
  }, [deviceColorScheme]);

  // Save theme preference with debouncing
  useEffect(() => {
    if (!isInitialized.current) return;

    const saveThemePreference = async () => {
      if (pendingUpdate.current) return;
      pendingUpdate.current = true;

      try {
        const themeValue = isDarkMode ? 'dark' : 'light';
        await AsyncStorage.setItem(THEME_STORAGE_KEY, themeValue);
      } catch (error) {
        console.error('ThemeContext: Error saving theme preference:', error);
      } finally {
        pendingUpdate.current = false;
      }
    };

    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(saveThemePreference);
  }, [isDarkMode]);

  // Optimized toggle theme function
  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isDarkMode,
    toggleTheme,
    theme,
  }), [isDarkMode, toggleTheme, theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 