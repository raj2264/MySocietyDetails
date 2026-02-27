import { Stack } from 'expo-router';
import BillsScreen from '../screens/BillsScreen';

export default function BillsRoute() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <BillsScreen />
    </>
  );
} 