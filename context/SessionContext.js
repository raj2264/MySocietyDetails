import React, { createContext, useContext, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Create context
const SessionContext = createContext(null);

// Create provider
export function SessionProvider({ children }) {
  const { session, loading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Value to be provided by the context
  const value = useMemo(() => ({
    session,
    isLoading: loading || refreshing,
    refreshSession: async () => {
      setRefreshing(true);
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return data?.session ?? null;
      } catch (error) {
        console.error('Error refreshing session:', error);
        return null;
      } finally {
        setRefreshing(false);
      }
    }
  }), [loading, refreshing, session]);

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