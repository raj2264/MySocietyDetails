import React from 'react';
import { View, Switch, StyleSheet, Text, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * A simple theme toggle component that works with ThemeContext
 * Optimized for better performance and responsiveness
 */
export default function ThemeToggle({ style, showLabel = false }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  
  // Handle toggle with immediate response
  const handleToggle = () => {
    toggleTheme();
  };
  
  return (
    <View style={[styles.container, style]}>
      {showLabel && (
        <Text style={{ color: theme.text, marginRight: 10 }}>
          {isDarkMode ? 'Dark Mode' : 'Light Mode'}
        </Text>
      )}
      <Pressable 
        onPress={handleToggle} 
        style={({ pressed }) => [
          styles.iconContainer,
          pressed && styles.pressed
        ]}
      >
        <Ionicons name="sunny" size={24} color={isDarkMode ? '#f59e0b80' : '#f59e0b'} />
      </Pressable>
      
      <Switch
        value={isDarkMode}
        onValueChange={toggleTheme}
        trackColor={{ false: '#e0e7ff', true: '#4f46e5' }}
        thumbColor={isDarkMode ? '#a5b4fc' : '#ffffff'}
        style={styles.toggle}
        ios_backgroundColor="#c7d2fe"
      />
      
      <Pressable 
        onPress={handleToggle}
        style={({ pressed }) => [
          styles.iconContainer,
          pressed && styles.pressed
        ]}
      >
        <Ionicons name="moon" size={24} color={isDarkMode ? '#f1f5f9' : '#6366f180'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }]
  },
  toggle: {
    marginHorizontal: 12,
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }]
  },
}); 