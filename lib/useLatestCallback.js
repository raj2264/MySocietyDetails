import { useRef, useCallback } from 'react';

/**
 * A hook that returns a callback that always has access to the latest value
 * of any dependencies, even if the callback is defined in an earlier render.
 * 
 * @param {Function} callback The callback to memoize
 * @returns {Function} A memoized callback that will always have access to the latest props
 */
const useLatestCallback = (callback) => {
  // Keep track of the latest callback
  const callbackRef = useRef(callback);
  
  // Update the ref whenever the callback changes
  callbackRef.current = callback;
  
  // Return a memoized function that calls the latest callback
  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, []);
};

// This is what gets imported when someone does: import useLatestCallback from 'use-latest-callback'
// The default export is the function itself
export default useLatestCallback;

// Also export individually for compatibility with different import styles
export { useLatestCallback }; 