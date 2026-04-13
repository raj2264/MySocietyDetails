import { createContext, useState, useEffect, useContext, useRef } from 'react';
import { 
  resetPassword
} from '../lib/auth';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import * as SplashScreen from 'expo-splash-screen';
import { clearAuthStorage } from '../lib/auth-storage';
import { subscribeForcedLogout } from '../lib/auth-events';
import useNoStuckLoading from '../hooks/useNoStuckLoading';

const AuthContext = createContext({});

// Key for storing resident data in AsyncStorage
const RESIDENT_STORAGE_KEY = 'resident_data';
const LEGACY_SESSION_STORAGE_KEY = 'supabase_session';
const AUTH_LOADING_MAX_MS = 1500;
const SESSION_REFRESH_BUFFER_SECONDS = 300;
const LOCAL_SIGN_OUT_TIMEOUT_MS = 1500;
const SESSION_REFRESH_TIMEOUT_MS = 1200;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [residentData, setResidentData] = useState(null);
  const [avatarRefreshToken, setAvatarRefreshToken] = useState(Date.now());
  const appStateRef = useRef(AppState.currentState);
  const splashHidden = useRef(false);
  const mountedRef = useRef(true);
  const restoreInFlightRef = useRef(null);
  const forceLogoutInFlightRef = useRef(null);
  const residentDataRef = useRef(null);
  const signedOutRecoveryAttemptedRef = useRef(false);
  // Track whether the user explicitly signed out (vs Supabase internal token events)
  const userInitiatedSignOut = useRef(false);

  useEffect(() => {
    residentDataRef.current = residentData;
  }, [residentData]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearAuthState = async () => {
    if (mountedRef.current) {
      setSession(null);
      setUser(null);
      setResidentData(null);
    }
    await AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    await storeResidentData(null);
  };

  const forceLogout = async () => {
    if (forceLogoutInFlightRef.current) {
      return forceLogoutInFlightRef.current;
    }

    forceLogoutInFlightRef.current = (async () => {
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, LOCAL_SIGN_OUT_TIMEOUT_MS)),
      ]);
    } catch (error) {
      console.error('AuthContext: forceLogout signOut failed:', error);
    }

    await clearAuthStorage();
    await clearAuthState();
    })();

    try {
      return await forceLogoutInFlightRef.current;
    } finally {
      forceLogoutInFlightRef.current = null;
    }
  };

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
  const getStoredResidentData = async (expectedUserId) => {
    try {
      const data = await AsyncStorage.getItem(RESIDENT_STORAGE_KEY);
      const parsed = data ? JSON.parse(data) : null;

      if (!parsed) {
        return null;
      }

      if (expectedUserId && parsed.user_id && parsed.user_id !== expectedUserId) {
        await AsyncStorage.removeItem(RESIDENT_STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Error getting resident data:', error);
      return null;
    }
  };

  // Restore auth state from Supabase persisted session only.
  const restoreSession = async ({ forceRefresh = false } = {}) => {
    if (restoreInFlightRef.current) {
      return restoreInFlightRef.current;
    }

    restoreInFlightRef.current = (async () => {
      try {
      const { data: { session: existingSession }, error } = await supabase.auth.getSession();

      let currentSession = existingSession;

      if (error) {
        console.error('AuthContext: Error restoring session:', error);
        return false;
      }

      const shouldRefresh = Boolean(
        currentSession && (
          forceRefresh ||
          ((currentSession.expires_at ?? 0) - Math.floor(Date.now() / 1000)) <= SESSION_REFRESH_BUFFER_SECONDS
        )
      );

      if (shouldRefresh) {
        const refreshResult = await Promise.race([
          supabase.auth.refreshSession(),
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: null, error: { message: 'refresh_timeout' } }), SESSION_REFRESH_TIMEOUT_MS)
          ),
        ]);

        const { data: refreshData, error: refreshError } = refreshResult || {};
        if (!refreshError && refreshData?.session) {
          currentSession = refreshData.session;
        } else if (refreshError && refreshError.message !== 'refresh_timeout') {
          console.warn('AuthContext: Session refresh failed during restore:', refreshError.message);
        }
      }

      if (currentSession) {
        signedOutRecoveryAttemptedRef.current = false;
        setSession(currentSession);
        setUser(currentSession.user);
        await AsyncStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);

        const cachedResident = await getStoredResidentData(currentSession.user?.id);
        if (cachedResident) {
          setResidentData(cachedResident);
        }

        if (currentSession.user) {
          await refreshResidentData(currentSession.user.id);
        }
        return true;
      }

      await clearAuthState();
      return false;
      } catch (error) {
        console.error('AuthContext: Error restoring session:', error);
        return false;
      }
    })();

    try {
      return await restoreInFlightRef.current;
    } finally {
      restoreInFlightRef.current = null;
    }
  };

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const wasInBackground = appStateRef.current.match(/inactive|background/);
      if (nextAppState === 'active') {
        supabase.auth.startAutoRefresh?.();
      } else {
        supabase.auth.stopAutoRefresh?.();
      }

      if (wasInBackground && nextAppState === 'active') {
        const restored = await restoreSession({ forceRefresh: true });
        if (!restored && mountedRef.current) {
          setLoading(false);
        }
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

  // Failsafe: never allow loading to stay true forever.
  useNoStuckLoading(loading, setLoading, AUTH_LOADING_MAX_MS + 1500);

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
  // 1. Restore session quickly (without blocking UI forever)
  // 2. Hydrate resident cache only after session user is known
  // 3. Refresh resident data in the background
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        supabase.auth.startAutoRefresh?.();

        await getStoredSession();
        const restorePromise = restoreSession({ forceRefresh: false });
        await Promise.race([
          restorePromise,
          new Promise((resolve) => setTimeout(resolve, AUTH_LOADING_MAX_MS)),
        ]);
      } catch (error) {
        console.error('AuthContext: Error initializing auth:', error);
        await clearAuthState();
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    initializeAuth();
  }, []);

  // Set up auth state change listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // console.log('AuthContext: Auth state changed:', event);
      
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        signedOutRecoveryAttemptedRef.current = false;
        // console.log('AuthContext: User signed in or token refreshed');
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        if (currentSession?.user) {
          // Skip resident data refresh if we already have it for this user.
          // TOKEN_REFRESHED fires frequently (on every background return via setSession)
          // and re-fetching resident data creates new objects that cascade re-renders.
          if (residentDataRef.current?.id && residentDataRef.current?.user_id === currentSession.user.id) {
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
        if (userInitiatedSignOut.current) {
          userInitiatedSignOut.current = false;
          await clearAuthState();
        } else {
          if (!signedOutRecoveryAttemptedRef.current) {
            signedOutRecoveryAttemptedRef.current = true;
            const restored = await restoreSession({ forceRefresh: false });
            if (!restored) {
              await clearAuthState();
            }
          } else {
            await clearAuthState();
          }
        }
      }
    });

    const unsubscribeForcedLogout = subscribeForcedLogout(async () => {
      await forceLogout();
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
      unsubscribeForcedLogout();
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

      // Immediately reflect profile changes in in-memory state so all screens update now.
      const hasAvatarUpdate = Object.prototype.hasOwnProperty.call(profileData, 'avatar_url');
      const nextAvatar = hasAvatarUpdate ? profileData.avatar_url : residentDataRef.current?.avatar_url;

      setUser(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          user_metadata: {
            ...(prev.user_metadata || {}),
            full_name: profileData.full_name,
            phone: profileData.phone,
            apartment_no: profileData.apartment_no,
            emergency_contact: profileData.emergency_contact,
            ...(hasAvatarUpdate ? { avatar_url: profileData.avatar_url } : {}),
          },
        };
      });

      setResidentData(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          name: profileData.full_name,
          phone: profileData.phone,
          unit_number: profileData.apartment_no,
          ...(hasAvatarUpdate ? { avatar_url: nextAvatar } : {}),
        };

        storeResidentData(updated);
        return updated;
      });

      if (hasAvatarUpdate) {
        setAvatarRefreshToken(Date.now());
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
        const mergedResidentData = {
          ...residentResult.data,
          avatar_url: residentResult.data.avatar_url ?? residentDataRef.current?.avatar_url ?? null,
        };

        setResidentData(prev => {
          if (prev?.id === mergedResidentData.id && prev?.updated_at === mergedResidentData.updated_at && prev?.avatar_url === mergedResidentData.avatar_url) {
            return prev; // Same reference — no re-render
          }
          return mergedResidentData;
        });
        storeResidentData(mergedResidentData);
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
        avatarRefreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 