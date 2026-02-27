import { Stack } from 'expo-router';
import PollsScreen from '../screens/PollsScreen';

export default function Polls() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <PollsScreen />
    </>
  );
} 