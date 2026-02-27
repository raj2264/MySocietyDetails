import { createContext, useState, useEffect, useContext } from 'react';
import { 
  signIn, 
  signOut, 
  resetPassword, 
  getUser, 
  getSession,
  getResidentDetails
} from '../lib/auth';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// Key for storing resident data in AsyncStorage
const RESIDENT_STORAGE_KEY = 'resident_data';
const SESSION_STORAGE_KEY = 'supabase_session';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [residentData, setResidentData] = useState(null);
  const [appState, setAppState] = useState(AppState.currentState);

  // Store session in AsyncStorage
  const storeSession = async (session) => {
    try {
      if (session) {
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error storing session:', error);
    }
  };

  // Get session from AsyncStorage
  const getStoredSession = async () => {
    try {
      const data = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting stored session:', error);
      return null;
    }
  };

  // Store resident data in AsyncStorage
  const storeResidentData = async (data) => {
    try {
      if (data) {
        await AsyncStorage.setItem(RESIDENT_STORAGE_KEY, JSON.stringify(data));
      } else {
        await AsyncStorage.removeItem(RESIDENT_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error storing resident data:', error);
    }
  };

  // Get resident data from AsyncStorage
  const getStoredResidentData = async () => {
    try {
      const data = await AsyncStorage.getItem(RESIDENT_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting resident data:', error);
      return null;
    }
  };

  // Enhanced session restoration function
  const restoreSession = async () => {
    try {
      console.log('AuthContext: Attempting to restore session...');
      
      // First try to get the stored session
      const storedSession = await getStoredSession();
      if (storedSession?.access_token) {
        console.log('AuthContext: Found stored session, attempting to refresh');
        
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token
          });

        if (!refreshError && refreshedSession) {
          console.log('AuthContext: Session refreshed successfully');
          setSession(refreshedSession);
          setUser(refreshedSession.user);
          await storeSession(refreshedSession);
          
          if (refreshedSession.user) {
            await refreshResidentData(refreshedSession.user.id);
          }
          return true;
        }
      }

      // If refresh failed or no stored session, try to get current session
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (!error && currentSession) {
        console.log('AuthContext: Found current session');
        setSession(currentSession);
        setUser(currentSession.user);
        await storeSession(currentSession);
        
        if (currentSession.user) {
          await refreshResidentData(currentSession.user.id);
        }
        return true;
      }

      console.log('AuthContext: No valid session found');
      return false;
    } catch (error) {
      console.error('AuthContext: Error restoring session:', error);
      return false;
    }
  };

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('AuthContext: App has come to the foreground');
        await restoreSession();
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState]);

  // Load user and session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        await restoreSession();
      } catch (error) {
        console.error('AuthContext: Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Set up auth state change listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('AuthContext: Auth state changed:', event);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('AuthContext: User signed in or token refreshed');
        setSession(currentSession);
        setUser(currentSession?.user || null);
        await storeSession(currentSession);
        
        if (currentSession?.user) {
          // Check if user is a guard before refreshing resident data
          const { data: guardData } = await supabase
            .from('guards')
            .select('id')
            .eq('user_id', currentSession.user.id)
            .maybeSingle();
            
          if (!guardData) {
            // Only refresh resident data if user is not a guard
            await refreshResidentData(currentSession.user.id);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('AuthContext: User signed out');
        setSession(null);
        setUser(null);
        setResidentData(null);
        await storeSession(null);
        await storeResidentData(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSignIn = async (email, password) => {
    console.log('AuthContext: Signing in user:', email);
    setLoading(true);
    
    try {
      // Use Supabase auth directly for better control
      console.log('AuthContext: Attempting direct Supabase sign in');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (error) {
        console.error('AuthContext: Sign in error:', error.message);
        setLoading(false);
        return { success: false, error: error.message };
      }
      
      console.log('AuthContext: Sign in successful for user:', data.user.id);
      
      // Verify this user is a resident, not a guard
      const { data: guardData } = await supabase
        .from('guards')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();
        
      if (guardData) {
        // This is a guard, not a resident. Sign them out and return error
        console.log('AuthContext: Attempted login with guard credentials to resident app');
        await supabase.auth.signOut();
        setLoading(false);
        return { 
          success: false, 
          error: 'These credentials belong to a guard account. Please use the guard login instead.' 
        };
      }
      
      // Fetch resident data for this user
      const { data: residentData, error: residentError } = await supabase
        .from('residents')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle();
      
      if (residentError) {
        console.error('AuthContext: Error fetching resident data after login:', residentError.message);
      } else if (!residentData) {
        // No resident record found
        console.log('AuthContext: No resident record found for user after login');
        await supabase.auth.signOut();
        setLoading(false);
        return { 
          success: false, 
          error: 'Your account is not associated with any resident. Please contact your society admin.' 
        };
      } else {
        // Valid resident found
        console.log('AuthContext: Resident data fetched after login:', JSON.stringify(residentData));
        setSession(data.session);
        setUser(data.user);
        setResidentData(residentData);
        storeResidentData(residentData);
      }
      
      setLoading(false);
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Sign in exception:', error);
      setLoading(false);
      return { success: false, error: error.message || 'Login failed. Please try again.' };
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setResidentData(null);
      await storeSession(null);
      await storeResidentData(null);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (email) => {
    console.log('AuthContext: Requesting password reset for:', email);
    return await resetPassword(email);
  };

  // Update user profile and resident data
  const updateUserProfile = async (profileData) => {
    try {
      console.log('AuthContext: Updating user profile:', profileData);
      
      if (!user?.id) {
        throw new Error('No authenticated user found');
      }

      // Update resident data in the residents table
      if (residentData?.id) {
        const { error: residentError } = await supabase
          .from('residents')
          .update({
            name: profileData.full_name,
            phone: profileData.phone,
            unit_number: profileData.apartment_no,
          })
          .eq('id', residentData.id);

        if (residentError) {
          console.error('Error updating resident data:', residentError);
          throw residentError;
        }
      }

      // Update user metadata
      const { error: userError } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name,
          phone: profileData.phone,
          apartment_no: profileData.apartment_no,
          emergency_contact: profileData.emergency_contact,
          avatar_url: profileData.avatar_url,
        }
      });

      if (userError) {
        console.error('Error updating user metadata:', userError);
        throw userError;
      }

      // Refresh resident data to get the latest changes
      await refreshResidentData();
      
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  };

  // Function to refresh the resident data
  const refreshResidentData = async (userId) => {
    try {
      // Check if user is authenticated
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        console.log('Cannot refresh resident data: User not authenticated');
        return false;
      }
      
      const currentUserId = userId || userData.user.id;
      console.log('Checking user type for:', currentUserId);
      
      // First check if the user is a guard
      const { data: guardData, error: guardError } = await supabase
        .from('guards')
        .select('id')
        .eq('user_id', currentUserId)
        .maybeSingle();
      
      if (guardError) {
        console.error('Error checking guard status:', guardError);
        return false;
      }
      
      // If user is a guard, don't try to fetch resident data
      if (guardData) {
        console.log('User is a guard, skipping resident data fetch');
        return false;
      }
      
      console.log('User is not a guard, fetching resident data');
      
      // Get the resident data for this user
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('user_id', currentUserId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching resident data:', error.message);
        return false;
      }
      
      if (data) {
        console.log('Refreshed resident data:', data);
        setResidentData(data);
        storeResidentData(data);
        return true;
      } else {
        console.log('No resident data found for user');
        setResidentData(null);
        storeResidentData(null);
        return false;
      }
    } catch (error) {
      console.error('Exception while refreshing resident data:', error.message);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        residentData,
        loading,
        signIn: handleSignIn,
        signOut: handleSignOut,
        resetPassword: handleResetPassword,
        updateUserProfile,
        refreshResidentData,
        restoreSession, // Make the restore function available to components
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 