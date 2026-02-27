import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function AuthNavigator() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4361ee" />
      </View>
    );
  }

  // If user is logged in, redirect to home screen
  if (user) {
    return <Redirect href="/home" />;
  }

  // Otherwise, show login screen
  return <Redirect href="/login" />;
} 