import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, AppState } from 'react-native';

const THEME_STORAGE_KEY = 'mysociety.theme.mode';

// Light theme colors for direct use
export const lightTheme = {
  background: '#FFFFFF',
  text: '#333333',
  card: '#F8F9FA',
  border: '#DDDDDD',
  input: '#F5F5F5',
  primary: '#4361EE',
};

// Dark theme colors for direct use
export const darkTheme = {
  background: '#121212',
  text: '#F8F9FA',
  card: '#1E1E1E',
  border: '#333333',
  input: '#2A2A2A',
  primary: '#4361EE',
};

/**
 * Custom hook for managing theme state with AsyncStorage
 * Provides isDarkMode state and toggle function - optimized for performance
 */
export default function useThemeToggle() {
  const deviceTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const hasLoaded = useRef(false);
  const isInitialLoad = useRef(true);
  const pendingWrite = useRef(false);
  
  // Force update function without re-rendering issues
  const forceUpdate = useCallback(() => {
    setUpdateTrigger(prev => prev + 1);
  }, []);
  
  // Initial load of theme from storage - only run once
  useEffect(() => {
    if (isInitialLoad.current) {
      const loadInitialTheme = async () => {
        try {
          const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
          if (savedTheme !== null) {
            setIsDarkMode(savedTheme === 'dark');
          } else {
            setIsDarkMode(deviceTheme === 'dark');
          }
          hasLoaded.current = true;
          isInitialLoad.current = false;
        } catch (error) {
          console.error('Error loading initial theme:', error);
          setIsDarkMode(deviceTheme === 'dark');
          hasLoaded.current = true;
          isInitialLoad.current = false;
        }
      };
      
      loadInitialTheme();
    }
  }, [deviceTheme]);
  
  // Save theme to storage when it changes (but only after initial load)
  // Use a debounced save to avoid multiple rapid writes
  useEffect(() => {
    if (!hasLoaded.current || isInitialLoad.current) return;
    
    // Set pending write flag
    pendingWrite.current = true;
    
    // Use a more efficient approach to save settings
    const saveTheme = async () => {
      if (pendingWrite.current) {
        pendingWrite.current = false;
        
        try {
          const themeValue = isDarkMode ? 'dark' : 'light';
          await AsyncStorage.setItem(THEME_STORAGE_KEY, themeValue);
        } catch (error) {
          console.error('Error saving theme:', error);
        }
      }
    };
    
    saveTheme();
  }, [isDarkMode]);
  
  // Listen for app state changes to reload theme when coming back to the app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && hasLoaded.current) {
        forceUpdate();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [forceUpdate]);
  
  // Optimized toggle function - removes delay for better responsiveness
  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => !prev);
    forceUpdate(); // Immediate update without delay
  }, [forceUpdate]);
  
  // Force set to a specific theme - optimized
  const setTheme = useCallback((dark) => {
    setIsDarkMode(dark);
    forceUpdate(); // Immediate update without delay
  }, [forceUpdate]);
  
  // Get current theme colors
  const theme = isDarkMode ? darkTheme : lightTheme;
  
  return {
    isDarkMode,
    toggleTheme,
    setTheme,
    isLoaded: hasLoaded.current,
    theme,
    updateTrigger,
    forceUpdate
  };
} 