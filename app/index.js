import { Redirect } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'react-native';
import { useAuth } from '../context/AuthContext';

// This is the entry point file that loads when the app starts
export default function Index() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <View style={[
        StyleSheet.absoluteFill, 
        { 
          backgroundColor: isDarkMode ? '#121212' : '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center'
        }
      ]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#fff' : '#000'} />
      </View>
    );
  }

  // If user is logged in, redirect to home
  if (user) {
    return <Redirect href="/home" />;
  }

  // Otherwise, redirect to welcome carousel
  return <Redirect href="/welcome" />;
} 