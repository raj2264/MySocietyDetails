import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for storage test
const STORAGE_TEST_KEY = 'storage_test_key';
// Key for theme storage
const THEME_STORAGE_KEY = 'mysociety.theme.mode';

// Test AsyncStorage functionality
export const testStorage = async () => {
  try {
    console.log('Testing AsyncStorage...');
    
    // Test setting a value
    const testValue = `test_${Date.now()}`;
    console.log('Setting test value:', testValue);
    await AsyncStorage.setItem(STORAGE_TEST_KEY, testValue);
    
    // Test getting the value back
    const retrievedValue = await AsyncStorage.getItem(STORAGE_TEST_KEY);
    console.log('Retrieved test value:', retrievedValue);
    
    // Verify it matches
    const isSuccessful = testValue === retrievedValue;
    console.log('Storage test successful:', isSuccessful);
    
    return {
      success: isSuccessful,
      testValue,
      retrievedValue
    };
  } catch (error) {
    console.error('Storage test error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Clear all app data from AsyncStorage
export const clearAllStorage = async () => {
  try {
    console.log('Clearing all AsyncStorage data...');
    await AsyncStorage.clear();
    console.log('AsyncStorage cleared successfully');
    return { success: true };
  } catch (error) {
    console.error('Error clearing AsyncStorage:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// List all keys in AsyncStorage
export const listAllStorageKeys = async () => {
  try {
    console.log('Listing all AsyncStorage keys...');
    const keys = await AsyncStorage.getAllKeys();
    console.log('AsyncStorage keys:', keys);
    return { 
      success: true,
      keys
    };
  } catch (error) {
    console.error('Error listing AsyncStorage keys:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Reset theme settings
export const resetThemeSettings = async () => {
  try {
    console.log('Resetting theme settings...');
    await AsyncStorage.removeItem(THEME_STORAGE_KEY);
    console.log('Theme settings reset successfully');
    return { 
      success: true,
      message: 'Theme settings have been reset to default.'
    };
  } catch (error) {
    console.error('Error resetting theme settings:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Force set theme mode
export const forceSetTheme = async (mode) => {
  try {
    if (mode !== 'light' && mode !== 'dark') {
      throw new Error('Invalid theme mode. Must be "light" or "dark"');
    }
    
    console.log(`Forcing theme mode to: ${mode}`);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    console.log('Theme mode set successfully');
    
    return { 
      success: true,
      message: `Theme has been set to ${mode} mode.`
    };
  } catch (error) {
    console.error('Error setting theme mode:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  testStorage,
  clearAllStorage,
  listAllStorageKeys,
  resetThemeSettings,
  forceSetTheme
}; 