import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import GuardBottomTabBar from '../../components/GuardBottomTabBar';
import { useTheme } from '../../context/ThemeContext';
import { EventRegister } from 'react-native-event-listeners';

// Add event name constant for sidebar state
export const SIDEBAR_STATE_CHANGED = 'SIDEBAR_STATE_CHANGED';

export default function GuardLayout() {
  const { theme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Listen for sidebar state changes
  React.useEffect(() => {
    const listener = EventRegister.addEventListener(SIDEBAR_STATE_CHANGED, (data) => {
      setIsSidebarOpen(data.isOpen);
    });

    return () => {
      EventRegister.removeEventListener(listener);
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 120,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="guard-dashboard" />
        <Stack.Screen name="guard-visitors" />
        <Stack.Screen name="guard-profile" />
        <Stack.Screen name="guard-about" />
      </Stack>
      {!isSidebarOpen && <GuardBottomTabBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 