import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// In-memory log storage
let inMemoryLogs = [];
const MAX_LOG_SIZE = 500; // Maximum number of log entries to keep

// Initialize logging system
export const initDiagnostics = async () => {
  // Clear old logs on startup
  try {
    await AsyncStorage.setItem('app_logs', JSON.stringify([]));
    inMemoryLogs = [];
    
    // Log system info
    log('INFO', 'Diagnostics initialized');
    log('INFO', `Platform: ${Platform.OS} ${Platform.Version}`);
    log('INFO', `App startup time: ${new Date().toISOString()}`);
    
    return true;
  } catch (error) {
    console.error('Failed to initialize diagnostics:', error);
    return false;
  }
};

// Log a message with the given level
export const log = (level, message, data = null) => {
  const logLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  const timestamp = new Date().toISOString();
  
  // Create log entry
  const logEntry = {
    timestamp,
    level,
    message,
    data: data ? JSON.stringify(data) : null,
  };
  
  // Add to in-memory logs
  inMemoryLogs.unshift(logEntry);
  
  // Trim log if too large
  if (inMemoryLogs.length > MAX_LOG_SIZE) {
    inMemoryLogs = inMemoryLogs.slice(0, MAX_LOG_SIZE);
  }
  
  // Log to console as well
  const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  console[consoleMethod](`[${timestamp}] [${level}] ${message}`, data || '');
  
  // Periodically save logs to AsyncStorage
  saveLogsToStorage();
  
  return logEntry;
};

// Helper functions for specific log levels
export const logDebug = (message, data = null) => log('DEBUG', message, data);
export const logInfo = (message, data = null) => log('INFO', message, data);
export const logWarn = (message, data = null) => log('WARN', message, data);
export const logError = (message, data = null) => log('ERROR', message, data);

// Save logs to AsyncStorage
const saveLogsToStorage = async () => {
  try {
    await AsyncStorage.setItem('app_logs', JSON.stringify(inMemoryLogs));
  } catch (error) {
    console.error('Failed to save logs to storage:', error);
  }
};

// Get all logs
export const getLogs = async () => {
  try {
    const storedLogs = await AsyncStorage.getItem('app_logs');
    return storedLogs ? JSON.parse(storedLogs) : [];
  } catch (error) {
    console.error('Failed to get logs from storage:', error);
    return inMemoryLogs;
  }
};

// Clear all logs
export const clearLogs = async () => {
  try {
    await AsyncStorage.setItem('app_logs', JSON.stringify([]));
    inMemoryLogs = [];
    return true;
  } catch (error) {
    console.error('Failed to clear logs:', error);
    return false;
  }
};

// Test Supabase connection and log result
export const testSupabaseConnection = async () => {
  try {
    logInfo('Testing Supabase connection...');
    
    // Check basic connection
    const start = Date.now();
    const { data, error } = await supabase.from('societies').select('count').limit(1).single();
    const elapsed = Date.now() - start;
    
    if (error) {
      logError('Supabase connection test failed', { error: error.message, code: error.code });
      return { success: false, error: error.message, elapsed };
    }
    
    logInfo('Supabase connection test succeeded', { count: data?.count, elapsed });
    return { success: true, data, elapsed };
  } catch (e) {
    logError('Supabase connection test exception', { error: e.message });
    return { success: false, error: e.message };
  }
};

// Check user authentication and log result
export const testUserAuth = async () => {
  try {
    logInfo('Testing user authentication...');
    
    const { data, error } = await supabase.auth.getSession();
    
    if (error || !data.session) {
      logError('User auth test failed', { error: error?.message });
      return { success: false, error: error?.message || 'No session found' };
    }
    
    logInfo('User auth test succeeded', { 
      user: data.session.user.id,
      email: data.session.user.email,
      expires: new Date(data.session.expires_at * 1000).toISOString() 
    });
    
    return { success: true, session: data.session };
  } catch (e) {
    logError('User auth test exception', { error: e.message });
    return { success: false, error: e.message };
  }
}; 