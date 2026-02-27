import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create context
const SessionContext = createContext(null);

// Create provider
export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Function to check the current session
    const checkSession = async () => {
      try {
        // Get the session from Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error checking session:', error.message);
          return;
        }
        
        setSession(data.session);
      } catch (error) {
        console.error('Error in session check:', error);
      } finally {
        setLoading(false);
      }
    };

    // Call the function
    checkSession();

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        
        // Handle events if needed
        switch (event) {
          case 'SIGNED_IN':
            console.log('User signed in');
            break;
          case 'SIGNED_OUT':
            console.log('User signed out');
            // Clear any stored data on sign out
            await AsyncStorage.removeItem('guard_data');
            break;
          case 'TOKEN_REFRESHED':
            console.log('Token refreshed');
            break;
          case 'USER_UPDATED':
            console.log('User updated');
            break;
          default:
            break;
        }
      }
    );

    // Clean up subscription
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Value to be provided by the context
  const value = {
    session,
    isLoading: loading,
    refreshSession: async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        setSession(data.session);
        return data.session;
      } catch (error) {
        console.error('Error refreshing session:', error);
        return null;
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// Custom hook to use the session context
export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
} 