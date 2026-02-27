import { Stack } from 'expo-router';
import ApartmentListingsScreen from '../screens/ApartmentListingsScreen';

export default function ApartmentListings() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <ApartmentListingsScreen />
    </>
  );
} 