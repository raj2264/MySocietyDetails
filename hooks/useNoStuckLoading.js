import { useEffect } from 'react';

const DEFAULT_LOADING_TIMEOUT_MS = 5000;

export default function useNoStuckLoading(loading, setLoading, timeoutMs = DEFAULT_LOADING_TIMEOUT_MS) {
  useEffect(() => {
    if (!loading || typeof setLoading !== 'function') {
      return;
    }

    const timer = setTimeout(() => {
      setLoading(false);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [loading, setLoading, timeoutMs]);
}
