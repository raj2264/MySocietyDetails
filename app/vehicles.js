import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import VehiclesScreen from '../screens/VehiclesScreen';

export default function VehiclesScreenWrapper() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <VehiclesScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 