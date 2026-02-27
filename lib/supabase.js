// Import necessary polyfills are already loaded in polyfills.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Alert } from 'react-native';

// Note: No direct import of @supabase/realtime-js - it will be mocked by babel and metro

// Supabase credentials
const supabaseUrl = 'https://jjgsggmufkpadchkodab.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ3NnZ211ZmtwYWRjaGtvZGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0Njg3MTAsImV4cCI6MjA2MDA0NDcxMH0.V6VxViTuJJdivrKKp51VcLyezeUmFNjLFb4wkVacQOk';

// Constants for storage keys
const AUTH_STORAGE_KEY = 'supabase_auth_token';
const SESSION_REFRESH_THRESHOLD = 60 * 60 * 1000; // 1 hour in milliseconds

// Simplified storage implementation
const customStorage = {
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get item: ${key}`, error);
      return null;
    }
  },
  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to set item: ${key}`, error);
    }
  },
  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item: ${key}`, error);
    }
  }
};

// Simple mock for realtime
const createEmptyRealtime = () => ({
  setAuth: () => null,
  connect: () => null,
  disconnect: () => null,
  on: () => {},
  subscribe: () => ({ on: () => {}, unsubscribe: () => {} }),
  removeSubscription: () => {},
  removeAllSubscriptions: () => {},
  send: () => {}
});

// Simple client options - more conservative and reliable
const supabaseOptions = {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: AUTH_STORAGE_KEY,
  },
  realtime: {
    params: { eventsPerSecond: 0 }
  },
  db: {
    schema: 'public'
  }
};

// Create supabase client with simpler options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

// Patch the realtime module if needed
try {
  if (supabase?.realtime && typeof supabase.realtime.setAuth !== 'function') {
    const mock = createEmptyRealtime();
    supabase.realtime.setAuth = mock.setAuth;
  }
} catch (e) {
  console.error('Error patching realtime:', e);
}

// Simple channel method
supabase.channel = (name) => ({
  on: () => ({ on: () => ({}), subscribe: () => ({}), unsubscribe: () => ({}) }),
  subscribe: () => ({ unsubscribe: () => {} }),
  unsubscribe: () => {},
  send: () => {},
  push: () => {}
});

// Wrapper for database functions with error handling
export const safeQuery = async (queryFn) => {
  try {
    return await queryFn();
  } catch (error) {
    console.error('Database query error:', error);
    
    // Only show alert for certain types of errors
    if (error.message?.includes('timeout') || error.message?.includes('network')) {
      Alert.alert(
        'Connection Issue',
        'There seems to be a problem with your internet connection. Please try again later.',
        [{ text: 'OK' }]
      );
    }
    
    return { data: null, error };
  }
};

// Helper to fetch data safely
export const fetchTable = async (table, options = {}) => {
  return safeQuery(async () => {
    let query = supabase.from(table).select(options.select || '*');
    
    if (options.filters) {
      options.filters.forEach(filter => {
        if (filter.eq) {
          query = query.eq(filter.eq.column, filter.eq.value);
        } else if (filter.order) {
          query = query.order(filter.order.column, { ascending: filter.order.ascending });
        } else if (filter.limit) {
          query = query.limit(filter.limit);
        }
      });
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return { data, error: null };
  });
};

// Helper to get current user info
export const getCurrentUserInfo = async () => {
  return safeQuery(async () => {
    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      throw sessionError;
    }
    
    if (!sessionData?.session) {
      return {
        success: false,
        error: 'No active session',
        message: 'User is not logged in'
      };
    }
    
    // Get user details
    const user = sessionData.session.user;
    
    // Get resident info if available
    let resident = null;
    const { data: residentData, error: residentError } = await supabase
      .from('residents')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!residentError && residentData) {
      resident = residentData;
    }
    
    // Check token expiration
    const expiresAt = sessionData.session.expires_at * 1000;
    const now = Date.now();
    const timeRemaining = expiresAt - now;
    const expiresIn = Math.floor(timeRemaining / 1000);
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        lastSignIn: user.last_sign_in_at,
      },
      token: {
        expiresAt: new Date(expiresAt).toISOString(),
        expiresIn: expiresIn,
        isExpired: expiresIn <= 0
      },
      resident: resident,
      message: 'User info retrieved successfully'
    };
  });
};

// Helper to verify and refresh the token if needed
export const ensureValidSession = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase.auth.getSession();
    
    if (error || !data?.session) {
      return false;
    }
    
    // Check if token is close to expiry
    const expiresAt = data.session.expires_at * 1000;
    const now = Date.now();
    const timeRemaining = expiresAt - now;
    
    // If token expires in less than the threshold, try to refresh it
    if (timeRemaining < SESSION_REFRESH_THRESHOLD) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing token:', refreshError.message);
        return false;
      }
    }
    
    return true;
  });
};

// Manually create a custom implementation for updates instead of using Supabase realtime
export const fetchUpdates = async (table, options = {}) => {
  try {
    await ensureValidSession();
    
    const { data, error } = await supabase
      .from(table)
      .select(options.select || '*')
      .order(options.orderBy || 'created_at', { ascending: options.ascending ?? false })
      .limit(options.limit || 20);
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error fetching ${table}:`, error.message);
    return [];
  }
};

// Additional initialization function to ensure session is loaded
export const initSupabase = async () => {
  try {
    // Try to get the session from storage first
    const storedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    console.log('Initializing Supabase, session in storage:', !!storedSession);
    
    // Check if we have a session and if it's still valid
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session during initialization:', error.message);
      return false;
    }
    
    if (!data?.session) {
      console.log('No active session found during initialization');
      return false;
    }
    
    console.log('Active session found during initialization for user:', data.session.user.id);
    
    // Check if token is close to expiry and refresh if needed
    const expiresAt = data.session.expires_at * 1000; // convert to ms
    const now = Date.now();
    const timeRemaining = expiresAt - now;
    
    if (timeRemaining < SESSION_REFRESH_THRESHOLD) {
      console.log('Token close to expiry, refreshing...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError.message);
      } else if (refreshData?.session) {
        console.log('Session refreshed successfully');
      }
    }
    
    return true;
  } catch (e) {
    console.error('Exception during Supabase initialization:', e);
    return false;
  }
};

// Initialize immediately
initSupabase().then(success => {
  console.log('Supabase initialization:', success ? 'successful' : 'failed');
}); 