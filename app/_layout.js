import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme, darkTheme } from '../context/ThemeContext';
import '../polyfills'; // Import polyfills before any network operations
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { SessionProvider } from '../context/SessionContext';

// Simple error display component
function ErrorDisplay() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
        An error occurred loading the app
      </Text>
      <Text style={{ textAlign: 'center', marginBottom: 20 }}>
        Please check your internet connection and try again.
      </Text>
    </View>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorDisplay />;
    }
    return this.props.children;
  }
}

// Inner component that lives inside ThemeProvider — can use useTheme()
function NavigationStack() {
  const { theme, isDarkMode } = useTheme();
  const backgroundColor = isDarkMode ? '#121212' : theme.background;

  const screenBackground = {
    contentStyle: { backgroundColor },
  };

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* System-wide background to prevent white flash */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
      <Stack 
        screenOptions={{ 
          headerShown: false,
          animation: 'fade',
          animationDuration: 80,
          contentStyle: { backgroundColor },
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animationTypeForReplace: 'pop',
          freezeOnBlur: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="welcome" options={screenBackground} />
        <Stack.Screen name="index" options={screenBackground} />
        <Stack.Screen name="login" options={screenBackground} />
        <Stack.Screen name="guard-login" options={screenBackground} />
        <Stack.Screen name="reset-password" options={screenBackground} />
        <Stack.Screen name="home" options={screenBackground} />
        <Stack.Screen name="announcements" options={screenBackground} />
        <Stack.Screen name="bills" options={screenBackground} />
        <Stack.Screen name="complaints" options={screenBackground} />
        <Stack.Screen name="visitors" options={screenBackground} />
        <Stack.Screen name="services" options={screenBackground} />
        <Stack.Screen name="(guard)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Use system color scheme only as the initial background before ThemeProvider loads
  const colorScheme = useColorScheme();
  const initialBg = colorScheme === 'dark' ? '#121212' : '#FFFFFF';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: initialBg }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <SessionProvider>
                <NavigationStack />
              </SessionProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

// Update the unstable_settings
export const unstable_settings = {
  initialRouteName: 'welcome',
  initialRoutes: [
    'welcome',
    'index',
    'login',
    'guard-login',
    'home',
    '(guard)'
  ]
};