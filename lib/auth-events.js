const listeners = new Set();

export function subscribeForcedLogout(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function triggerForcedLogout() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('Error handling forced logout listener:', error);
    }
  });
}
