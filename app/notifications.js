import { Stack } from 'expo-router';
import NotificationsScreen from '../screens/NotificationsScreen';

export default function NotificationsRoute() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <NotificationsScreen />
    </>
  );
} 