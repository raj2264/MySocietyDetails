import { Stack } from 'expo-router';
import ServicesScreen from '../screens/ServicesScreen';

export default function ServicesRoute() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <ServicesScreen />
    </>
  );
} 