import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, useColorScheme, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme, darkTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { SessionProvider } from '../context/SessionContext';
import * as SplashScreen from 'expo-splash-screen';
import useNotifications from '../hooks/useNotifications';

// Prevent the native splash screen from auto-hiding.
// We'll hide it once the app is ready (auth loaded).
SplashScreen.preventAutoHideAsync().catch(() => {});

// Simple error display component
function ErrorDisplay({ onRetry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
        An error occurred loading the app
      </Text>
      <Text style={{ textAlign: 'center', marginBottom: 20 }}>
        Please try again. If this continues, restart the app.
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#2563EB', borderRadius: 8 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Try Again</Text>
      </TouchableOpacity>
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

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorDisplay onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

// Inner component that lives inside ThemeProvider — can use useTheme()
function NavigationStack() {
  const { theme, isDarkMode } = useTheme();
  const backgroundColor = isDarkMode ? '#121212' : theme.background;
  const startupSafeAnimation = Platform.OS === 'ios' ? 'default' : 'fade';

  // Register push notifications & set up listeners
  useNotifications();

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
          animation: startupSafeAnimation,
          animationDuration: 180,
          contentStyle: { backgroundColor },
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animationTypeForReplace: 'pop',
          freezeOnBlur: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="welcome" options={{ ...screenBackground, gestureEnabled: false }} />
        <Stack.Screen name="index" options={{ ...screenBackground, gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ ...screenBackground, gestureEnabled: false }} />
        <Stack.Screen name="guard-login" options={{ ...screenBackground, gestureEnabled: false }} />
        <Stack.Screen name="reset-password" options={screenBackground} />
        <Stack.Screen name="home" options={{ ...screenBackground, gestureEnabled: false }} />
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
  const [appResetKey, setAppResetKey] = useState(0);

  const handleBoundaryRetry = useCallback(() => {
    setAppResetKey(prev => prev + 1);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: initialBg }}>
      <ErrorBoundary onRetry={handleBoundaryRetry}>
        <View style={{ flex: 1 }} key={appResetKey}>
          <SafeAreaProvider>
            <ThemeProvider>
              <AuthProvider>
                <SessionProvider>
                  <NavigationStack />
                </SessionProvider>
              </AuthProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </View>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

// Update the unstable_settings
export const unstable_settings = {
  initialRouteName: 'index',
  initialRoutes: [
    'index',
    'welcome',
    'login',
    'guard-login',
    'home',
    '(guard)'
  ]
};