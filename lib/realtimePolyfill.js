// realtimePolyfill.js - A simple polling-based alternative to Supabase realtime
import { supabase } from './supabase';

// Map to store subscription callbacks
const subscriptions = new Map();
// Default polling interval in ms
const DEFAULT_INTERVAL = 10000;
// Keep track of polling timers
const pollingTimers = new Map();

/**
 * Creates a polling-based subscription to a table
 * @param {string} tableName - The Supabase table to subscribe to
 * @param {string} event - Event type ('INSERT', 'UPDATE', 'DELETE', '*')
 * @param {Function} callback - Function to call with new data
 * @param {Object} options - Options like filter and interval
 * @returns {Object} Subscription object with unsubscribe method
 */
export const createSubscription = (tableName, event, callback, options = {}) => {
  // Create unique subscription ID
  const subscriptionId = `${tableName}:${event}:${Date.now()}`;
  
  // Store subscription details
  subscriptions.set(subscriptionId, {
    tableName,
    event,
    callback,
    options,
    lastFetchTime: new Date(),
  });
  
  // Start polling for this subscription
  startPolling(subscriptionId, options.interval || DEFAULT_INTERVAL);
  
  // Return subscription object with unsubscribe method
  return {
    unsubscribe: () => {
      // Clear polling timer
      const timer = pollingTimers.get(subscriptionId);
      if (timer) clearInterval(timer);
      pollingTimers.delete(subscriptionId);
      
      // Remove subscription
      subscriptions.delete(subscriptionId);
    }
  };
};

/**
 * Start polling for a specific subscription
 */
const startPolling = (subscriptionId, interval) => {
  // Set up polling interval
  const timer = setInterval(async () => {
    const subscription = subscriptions.get(subscriptionId);
    if (!subscription) return;
    
    const { tableName, event, callback, lastFetchTime, options } = subscription;
    
    try {
      // Query for new or updated records since last fetch
      let query = supabase
        .from(tableName)
        .select(options.select || '*');
      
      // Handle different event types
      if (event === 'INSERT' || event === '*') {
        query = query.gt('created_at', lastFetchTime.toISOString());
      } else if (event === 'UPDATE' || event === '*') {
        query = query.gt('updated_at', lastFetchTime.toISOString());
      }
      
      // Apply any custom filters from options
      if (options.filter) {
        Object.entries(options.filter).forEach(([column, value]) => {
          query = query.eq(column, value);
        });
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Subscription polling error:', error);
        return;
      }
      
      // Update last fetch time
      subscription.lastFetchTime = new Date();
      subscriptions.set(subscriptionId, subscription);
      
      // Call callback with new data if any
      if (data && data.length > 0) {
        data.forEach(record => {
          callback({
            new: record,
            eventType: event === '*' ? 'INSERT' : event,
            table: tableName
          });
        });
      }
    } catch (err) {
      console.error('Error in subscription polling:', err);
    }
  }, interval);
  
  // Store the timer
  pollingTimers.set(subscriptionId, timer);
};

/**
 * Add a mock of Supabase's on() method to tables
 */
export const addTableSubscription = (table) => {
  return {
    ...table,
    on: (event, callback) => {
      return createSubscription(table.name, event, callback);
    }
  };
};

// Helper to simulate Supabase's subscription API
export const subscribe = (tableName) => {
  return {
    on: (event, callback) => {
      return createSubscription(tableName, event, callback);
    }
  };
}; 