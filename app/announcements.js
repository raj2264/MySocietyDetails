import { Stack } from 'expo-router';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';

export default function Announcements() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <AnnouncementsScreen />
    </>
  );
} 