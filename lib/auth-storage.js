import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEYS = [
  'supabase.auth.token',
  'supabase_auth_token',
  'supabase_session',
  'resident_data',
];

export async function clearAuthStorage() {
  try {
    await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);
  } catch (error) {
    console.error('Error clearing auth storage:', error);
  }
}
