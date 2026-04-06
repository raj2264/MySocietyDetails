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
    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error) {
          setSession(data?.session ?? null);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeSession();

    // Subscribe to auth state changes (AuthContext drives the actual auth flow)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        
        if (event === 'SIGNED_OUT') {
          await AsyncStorage.removeItem('guard_data');
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