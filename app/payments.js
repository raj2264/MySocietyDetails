import { Stack } from 'expo-router';
import PaymentsScreen from '../screens/PaymentsScreen';

export default function Payments() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <PaymentsScreen />
    </>
  );
} 