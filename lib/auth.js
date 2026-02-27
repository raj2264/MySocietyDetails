// Custom auth functions using direct REST API calls
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase credentials
const SUPABASE_URL = 'https://jjgsggmufkpadchkodab.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ3NnZ211ZmtwYWRjaGtvZGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0Njg3MTAsImV4cCI6MjA2MDA0NDcxMH0.V6VxViTuJJdivrKKp51VcLyezeUmFNjLFb4wkVacQOk';

// Storage constants
const AUTH_STORAGE_KEY = 'supabase.auth.token';

// Constants for OTP
const OTP_STORAGE_KEY = 'supabase.auth.otp';
const OTP_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

// Development mode flag - set to true to bypass Supabase and use local storage only
// This is useful during development or when Supabase is not properly configured
const FORCE_DEV_MODE = false; // Change to true for development-only mode

// Test Supabase connectivity
export const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', SUPABASE_URL);
    
    // Test basic connection
    const response = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_KEY}`);
    const connectionStatus = {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
    };
    
    console.log('Connection test results:', connectionStatus);
    
    // Test auth endpoints
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    const authStatus = {
      status: authResponse.status,
      ok: authResponse.ok,
      statusText: authResponse.statusText,
    };
    
    console.log('Auth endpoint test results:', authStatus);
    
    if (response.ok && authResponse.ok) {
      console.log('Supabase connection successful!');
      return { success: true, connection: connectionStatus, auth: authStatus };
    } else {
      console.error('Supabase connection failed!');
      return { 
        success: false, 
        connection: connectionStatus, 
        auth: authStatus,
        error: 'Failed to connect to Supabase' 
      };
    }
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    return { success: false, error: error.message };
  }
};

// Get session from AsyncStorage
export const getSession = async () => {
  try {
    const data = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

// Store session in AsyncStorage
const storeSession = async (session) => {
  try {
    if (session) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error storing session:', error);
  }
};

// Basic fetch with auth headers
const fetchWithAuth = async (endpoint, options = {}) => {
  const session = await getSession();
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    ...options.headers,
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return fetch(`${SUPABASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
};

// Sign in
export const signIn = async (email, password) => {
  try {
    console.log('Auth.js: Starting signin for:', email);
    
    // Make sure email is trimmed and lowercased for comparison
    const normalizedEmail = email.trim().toLowerCase();
    console.log('Auth.js: Normalized email:', normalizedEmail);
    
    // First, check if this user exists in the residents table - using ILIKE for case-insensitive matching
    const checkResidentResponse = await fetch(`${SUPABASE_URL}/rest/v1/residents?email=ilike.${encodeURIComponent(normalizedEmail)}&select=email,user_id`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
    });
    
    // Log response status to help with debugging
    console.log('Auth.js: Residents check status:', checkResidentResponse.status, checkResidentResponse.statusText);
    
    if (!checkResidentResponse.ok) {
      console.error('Auth.js: Error checking resident email:', checkResidentResponse.status, checkResidentResponse.statusText);
      return { success: false, error: 'Error verifying user account. Please try again.' };
    }
    
    const residentsData = await checkResidentResponse.json();
    console.log('Auth.js: Residents check response:', JSON.stringify(residentsData, null, 2));
    
    // If user is not in residents table, return error
    if (!residentsData || residentsData.length === 0) {
      console.error('Auth.js: Email not found in residents table');
      return { success: false, error: 'Invalid email or password' };
    }
    
    // Proceed with standard Supabase auth login
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    console.log('Auth.js: Signin response status:', response.status);
    
    const data = await response.json();
    console.log('Auth.js: Signin response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('Auth.js: Signin error:', data);
      throw new Error(data.error_description || data.msg || 'Error signing in');
    }

    console.log('Auth.js: Signin successful, storing session');
    await storeSession(data);
    return { success: true, data };
  } catch (error) {
    console.error('Auth.js: Signin exception:', error);
    return { success: false, error: error.message };
  }
};

// Sign out
export const signOut = async () => {
  try {
    const session = await getSession();
    
    // Always clear the local session first
    await storeSession(null);
    
    // Then try to perform remote logout
    if (session?.access_token) {
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        // Just log the error but don't throw since we already cleared locally
        if (!response.ok) {
          console.error('Remote logout failed but local session cleared');
        }
      } catch (remoteError) {
        console.error('Remote logout error:', remoteError);
        // Don't throw since we already cleared locally
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error during sign out:', error);
    return { error: error.message };
  }
};

// Reset password
export const resetPassword = async (email) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error_description || data.msg || 'Error resetting password');
    }

    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
};

// Get current user
export const getUser = async () => {
  try {
    const session = await getSession();
    if (!session?.access_token || !session?.user) {
      return null;
    }
    return session.user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// Check Supabase email settings
export const checkSupabaseEmailSettings = async () => {
  try {
    console.log('Checking Supabase email settings...');
    
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch Supabase settings:', response.status, response.statusText);
      return { success: false, error: 'Failed to fetch Supabase settings' };
    }
    
    const settings = await response.json();
    console.log('Supabase auth settings:', JSON.stringify(settings, null, 2));
    
    // Check if email confirmation is enabled
    const emailConfirmationEnabled = settings?.external?.email?.email_confirm_enabled;
    
    return { 
      success: true, 
      settings,
      emailConfirmationEnabled,
      emailEnabled: settings?.external?.email?.enabled,
    };
  } catch (error) {
    console.error('Error checking Supabase email settings:', error);
    return { success: false, error: error.message };
  }
};

// Send a test email using Supabase
export const sendTestEmail = async (email) => {
  try {
    console.log('Attempting to send test email to:', email);
    
    // Use Supabase's password reset as a way to test email delivery
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ email }),
    });
    
    console.log('Test email response status:', response.status);
    
    const data = await response.json();
    console.log('Test email response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Test email error:', data);
      return { 
        success: false, 
        status: response.status,
        error: data.error_description || data.msg || 'Error sending test email' 
      };
    }
    
    return { 
      success: true, 
      message: 'Test email sent (password reset). Check your email inbox and spam folder.' 
    };
  } catch (error) {
    console.error('Error sending test email:', error);
    return { success: false, error: error.message };
  }
};

// Get resident details by email
export const getResidentDetails = async (email) => {
  try {
    console.log('Auth.js: Fetching resident details for:', email);
    
    const normalizedEmail = email.trim().toLowerCase();
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/residents?email=ilike.${encodeURIComponent(normalizedEmail)}&select=*`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
    });
    
    console.log('Auth.js: Resident details status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('Auth.js: Error fetching resident details:', response.status, response.statusText);
      return { success: false, error: 'Failed to fetch resident details' };
    }
    
    const residentsData = await response.json();
    console.log('Auth.js: Resident details response:', JSON.stringify(residentsData, null, 2));
    
    if (!residentsData || residentsData.length === 0) {
      console.error('Auth.js: No resident details found');
      return { success: false, error: 'Resident not found' };
    }
    
    return { success: true, data: residentsData[0] };
  } catch (error) {
    console.error('Auth.js: Error fetching resident details:', error);
    return { success: false, error: error.message };
  }
}; 