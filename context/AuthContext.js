import { createContext, useState, useEffect, useContext, useRef } from 'react';
import { 
  resetPassword
} from '../lib/auth';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import * as SplashScreen from 'expo-splash-screen';

const AuthContext = createContext({});

// Key for storing resident data in AsyncStorage
const RESIDENT_STORAGE_KEY = 'resident_data';
const LEGACY_SESSION_STORAGE_KEY = 'supabase_session';
const AUTH_LOADING_MAX_MS = 8000;
const SESSION_HYDRATE_TIMEOUT_MS = 2500;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [residentData, setResidentData] = useState(null);
  const appStateRef = useRef(AppState.currentState);
  const splashHidden = useRef(false);
  // Track whether the user explicitly signed out (vs Supabase internal token events)
  const userInitiatedSignOut = useRef(false);

  const withTimeout = (promise, timeoutMs, timeoutLabel) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(timeoutLabel || 'operation_timeout')), timeoutMs)
      ),
    ]);

  // Store session in AsyncStorage
  const storeSession = async (session) => {
    try {
      // Retained for compatibility. Do not persist custom session copies.
      if (!session) {
        await AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error storing session:', error);
    }
  };

  // Get session from AsyncStorage
  const getStoredSession = async () => {
    try {
      // Custom session cache is deprecated; Supabase storage is the source of truth.
      await AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
      return null;
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

  // Restore auth state from Supabase persisted session only.
  const restoreSession = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('AuthContext: Error restoring session:', error);
        return false;
      }

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        await AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);

        const cachedResident = await getStoredResidentData();
        if (cachedResident) {
          setResidentData(cachedResident);
        }

        if (currentSession.user) {
          refreshResidentData(currentSession.user.id);
        }
        return true;
      }

      await AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
      setSession(null);
      setUser(null);
      setResidentData(null);
      await storeResidentData(null);
      return false;
    } catch (error) {
      console.error('AuthContext: Error restoring session:', error);
      return false;
    }
  };

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const wasInBackground = appStateRef.current.match(/inactive|background/);
      if (wasInBackground && nextAppState === 'active') {
        await restoreSession();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Hide splash screen once loading is done
  useEffect(() => {
    if (!loading && !splashHidden.current) {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  // Safety net: never allow global auth loading to spin forever.
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setLoading(false);
    }, AUTH_LOADING_MAX_MS);

    return () => clearTimeout(timer);
  }, [loading]);

  // If a valid auth user exists but resident data is missing (common after app relaunch
  // or when auth events race with route transitions), recover resident data in background.
  useEffect(() => {
    if (!user?.id || residentData?.id) return;

    let cancelled = false;

    const recoverResidentData = async () => {
      try {
        const refreshed = await refreshResidentData(user.id);
        if (!refreshed && !cancelled) {
          console.warn('AuthContext: Resident data not found during background recovery');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('AuthContext: Failed to recover resident data:', error);
        }
      }
    };

    recoverResidentData();

    return () => {
      cancelled = true;
    };
  }, [user?.id, residentData?.id]);

  // Load user and session on mount — CACHE-FIRST strategy
  // 1. Instantly load cached session + resident data from AsyncStorage (no network)
  // 2. Set loading=false so the UI renders immediately
  // 3. Then refresh from network in the background
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedResident = await getStoredResidentData();
        if (storedResident) {
          setResidentData(storedResident);
        }

        await getStoredSession();
        await restoreSession();
      } catch (error) {
        console.error('AuthContext: Error initializing auth:', error);
        setSession(null);
        setUser(null);
        setResidentData(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Set up auth state change listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // console.log('AuthContext: Auth state changed:', event);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // console.log('AuthContext: User signed in or token refreshed');
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        if (currentSession?.user) {
          // Skip resident data refresh if we already have it for this user.
          // TOKEN_REFRESHED fires frequently (on every background return via setSession)
          // and re-fetching resident data creates new objects that cascade re-renders.
          if (residentData?.id && residentData?.user_id === currentSession.user.id) {
            // Already have valid resident data for this user — skip
          } else {
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
        }
      } else if (event === 'SIGNED_OUT') {
        // Only clear state if the user explicitly signed out.
        // Supabase fires SIGNED_OUT internally when token refresh fails
        // (e.g., brief network glitch, server hiccup). Honoring that
        // causes random logouts even though cached credentials are still valid.
        if (userInitiatedSignOut.current) {
          userInitiatedSignOut.current = false;
          setSession(null);
          setUser(null);
          setResidentData(null);
          await AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
          await storeResidentData(null);
        } else {
          // Recover once from storage. If recovery fails, clear stale auth state.
          const restored = await restoreSession();
          if (!restored) {
            setSession(null);
            setUser(null);
            setResidentData(null);
            await AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
            await storeResidentData(null);
            await AsyncStorage.removeItem('supabase_auth_token').catch(() => {});
          }
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSignIn = async (email, password) => {
    // console.log('AuthContext: Signing in user:', email);
    setLoading(true);
    
    try {
      // Use Supabase auth directly for better control
      // console.log('AuthContext: Attempting direct Supabase sign in');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });
      
      if (error) {
        console.error('AuthContext: Sign in error:', error.message);
        setLoading(false);
        return { success: false, error: error.message };
      }
      
      // console.log('AuthContext: Sign in successful for user:', data.user.id);
      
      // Verify this user is a resident, not a guard
      const { data: guardData } = await supabase
        .from('guards')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();
        
      if (guardData) {
        // This is a guard, not a resident. Sign them out and return error
        // console.log('AuthContext: Attempted login with guard credentials to resident app');
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
        // console.log('AuthContext: No resident record found for user after login');
        await supabase.auth.signOut();
        setLoading(false);
        return { 
          success: false, 
          error: 'Your account is not associated with any resident. Please contact your society admin.' 
        };
      } else {
        // Valid resident found
        // console.log('AuthContext: Resident data fetched after login:', JSON.stringify(residentData));
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
      // Mark as user-initiated so onAuthStateChange honors the SIGNED_OUT event
      userInitiatedSignOut.current = true;
      // Clear state immediately — no global loading flag needed.
      // Setting user to null triggers navigation to the login/welcome screen.
      setSession(null);
      setUser(null);
      setResidentData(null);

      // Clear all auth storage first (ensures clean state even if SDK signOut misbehaves)
      await Promise.all([
        storeSession(null),
        storeResidentData(null),
        AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY).catch(() => {}),
        AsyncStorage.removeItem('supabase_auth_token').catch(() => {}),
      ]);

      // Use local scope to avoid hanging on network request during sign out.
      // Wrap with a timeout in case the SDK hangs (e.g. un-hydrated session).
      try {
        await Promise.race([
          supabase.auth.signOut({ scope: 'local' }),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch (sdkErr) {
        // SDK signOut failed — storage is already cleared, state is already null
        console.warn('AuthContext: SDK signOut failed, continuing:', sdkErr);
      }

      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      userInitiatedSignOut.current = false;
      // Still clear state and storage even if signOut API call failed
      setSession(null);
      setUser(null);
      setResidentData(null);
      await storeSession(null).catch(() => {});
      await storeResidentData(null).catch(() => {});
      await AsyncStorage.removeItem('supabase_auth_token').catch(() => {});
      return { success: false, error: 'Failed to sign out' };
    }
  };

  const handleResetPassword = async (email) => {
    // console.log('AuthContext: Requesting password reset for:', email);
    return await resetPassword(email);
  };

  // Update user profile and resident data
  const updateUserProfile = async (profileData) => {
    try {
      // console.log('AuthContext: Updating user profile:', profileData);
      
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
          // console.log('Cannot refresh resident data: User not authenticated');
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
        // console.log('User is a guard, skipping resident data');
        return false;
      }
      
      if (residentResult.error) {
        console.error('Error fetching resident data:', residentResult.error.message);
        return false;
      }
      
      if (residentResult.data) {
        // Only update state if the data actually changed (compare by id + updated_at)
        // This prevents cascading re-renders across all screens when the data is identical
        setResidentData(prev => {
          if (prev?.id === residentResult.data.id && prev?.updated_at === residentResult.data.updated_at) {
            return prev; // Same reference — no re-render
          }
          return residentResult.data;
        });
        storeResidentData(residentResult.data);
        return true;
      } else {
        setResidentData(prev => {
          if (prev === null) return prev;
          return null;
        });
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