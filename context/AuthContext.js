import { createContext, useState, useEffect, useContext, useRef } from 'react';
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
import * as SplashScreen from 'expo-splash-screen';

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
  const splashHidden = useRef(false);

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

  // Background session refresh — runs AFTER the UI is already visible with cached data.
  // Silently validates/refreshes the token and updates resident data from the server.
  const refreshSessionInBackground = async (cachedSession) => {
    try {
      console.log('AuthContext: Background refresh starting...');
      
      // Try to refresh/validate the session with the server
      const { data: { session: refreshedSession }, error: refreshError } = 
        await supabase.auth.setSession({
          access_token: cachedSession.access_token,
          refresh_token: cachedSession.refresh_token
        });

      if (refreshError || !refreshedSession) {
        // Token is invalid/expired — try getSession as fallback
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (!error && currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          await storeSession(currentSession);
          // Refresh resident data in parallel with guard check
          if (currentSession.user) {
            refreshResidentData(currentSession.user.id);
          }
        } else {
          // Session truly expired — clear state, user will be redirected to login
          console.log('AuthContext: Session expired, clearing state');
          setSession(null);
          setUser(null);
          setResidentData(null);
          await storeSession(null);
          await storeResidentData(null);
        }
        return;
      }

      // Session refreshed successfully — update state silently
      setSession(refreshedSession);
      setUser(refreshedSession.user);
      await storeSession(refreshedSession);
      
      if (refreshedSession.user) {
        // Fire-and-forget resident data refresh
        refreshResidentData(refreshedSession.user.id);
      }
      
      console.log('AuthContext: Background refresh complete');
    } catch (error) {
      console.error('AuthContext: Background refresh error:', error);
      // Don't clear state on background error — keep using cached data
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

  // Hide splash screen once loading is done
  useEffect(() => {
    if (!loading && !splashHidden.current) {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  // Load user and session on mount — CACHE-FIRST strategy
  // 1. Instantly load cached session + resident data from AsyncStorage (no network)
  // 2. Set loading=false so the UI renders immediately
  // 3. Then refresh from network in the background
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);

        // PHASE 1: Instant load from cache (no network)
        const [storedSession, storedResident] = await Promise.all([
          getStoredSession(),
          getStoredResidentData(),
        ]);

        if (storedSession?.access_token && storedSession?.user) {
          // We have cached data — use it immediately
          setSession(storedSession);
          setUser(storedSession.user);
          if (storedResident) {
            setResidentData(storedResident);
          }
          // Loading is done — user sees the app instantly
          setLoading(false);

          // PHASE 2: Background refresh (non-blocking)
          refreshSessionInBackground(storedSession);
        } else {
          // No cached session — must do network restore
          await restoreSession();
          setLoading(false);
        }
      } catch (error) {
        console.error('AuthContext: Error initializing auth:', error);
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

  // Function to refresh the resident data — optimized with parallel queries
  const refreshResidentData = async (userId) => {
    try {
      let currentUserId = userId;
      
      // Only call getUser() if we don't already have a userId
      if (!currentUserId) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.log('Cannot refresh resident data: User not authenticated');
          return false;
        }
        currentUserId = userData.user.id;
      }
      
      // Run guard check and resident fetch in PARALLEL instead of sequentially
      const [guardResult, residentResult] = await Promise.all([
        supabase.from('guards').select('id').eq('user_id', currentUserId).maybeSingle(),
        supabase.from('residents').select('*').eq('user_id', currentUserId).maybeSingle(),
      ]);
      
      if (guardResult.error) {
        console.error('Error checking guard status:', guardResult.error);
        return false;
      }
      
      // If user is a guard, don't use resident data
      if (guardResult.data) {
        console.log('User is a guard, skipping resident data');
        return false;
      }
      
      if (residentResult.error) {
        console.error('Error fetching resident data:', residentResult.error.message);
        return false;
      }
      
      if (residentResult.data) {
        setResidentData(residentResult.data);
        storeResidentData(residentResult.data);
        return true;
      } else {
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