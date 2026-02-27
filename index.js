// Load all polyfills first, before anything else
import './polyfills';

// Import Expo Router entry
import 'expo-router/entry';

import { Appearance, Platform, UIManager } from 'react-native';

// Enable layout animations on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Set the background color immediately based on system theme
// This prevents white flash in dark mode by setting it at the native level
const colorScheme = Appearance.getColorScheme();
if (colorScheme === 'dark') {
  // Set dark background at native level
  if (Platform.OS === 'android') {
    try {
      const ScriptManager = require('react-native').NativeModules.ScriptManager;
      if (ScriptManager && ScriptManager.setBackgroundColor) {
        ScriptManager.setBackgroundColor('#121212');
      }
    } catch (e) {
      console.warn('Failed to set native background color', e);
    }
  }
}
