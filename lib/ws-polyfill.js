// Custom WebSocket implementation that doesn't use any Node.js modules
class CustomWebSocket {
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0; // CONNECTING
    
    // Event callbacks
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Add properties needed for Hermes
    this.bufferedAmount = 0;
    this.extensions = '';
    this.binaryType = 'arraybuffer';
    this.seed = 'staticWebSocketSeed12345';
    
    // Event listeners
    this._listeners = {
      open: [],
      close: [],
      error: [],
      message: []
    };
    
    // Immediately "fail" the connection but don't throw an error
    setTimeout(() => {
      this._handleError(new Error('WebSockets are disabled in this build'));
    }, 0);
  }
  
  // Add event listener
  addEventListener(type, listener) {
    if (this._listeners[type]) {
      this._listeners[type].push(listener);
    }
  }
  
  // Remove event listener
  removeEventListener(type, listener) {
    if (this._listeners[type]) {
      const index = this._listeners[type].indexOf(listener);
      if (index !== -1) {
        this._listeners[type].splice(index, 1);
      }
    }
  }
  
  // Send data (does nothing in this implementation)
  send(data) {
    this._handleError(new Error('Cannot send data: WebSockets are disabled'));
  }
  
  // Close connection
  close(code, reason) {
    if (this.readyState !== 2 && this.readyState !== 3) {
      this.readyState = 2; // CLOSING
      
      setTimeout(() => {
        this.readyState = 3; // CLOSED
        
        const closeEvent = {
          type: 'close',
          code: code || 1000,
          reason: reason || 'WebSockets are disabled',
          wasClean: true,
          target: this
        };
        
        // Call onclose callback
        if (typeof this.onclose === 'function') {
          this.onclose(closeEvent);
        }
        
        // Call close event listeners
        this._listeners.close.forEach(listener => {
          listener(closeEvent);
        });
      }, 0);
    }
  }
  
  // Handle error
  _handleError(error) {
    this.readyState = 3; // CLOSED
    
    const errorEvent = {
      type: 'error',
      error,
      message: error.message,
      target: this
    };
    
    // Call onerror callback
    if (typeof this.onerror === 'function') {
      this.onerror(errorEvent);
    }
    
    // Call error event listeners
    this._listeners.error.forEach(listener => {
      listener(errorEvent);
    });
    
    // Call close after error
    this.close(1006, 'WebSockets are disabled');
  }
}

// Define static constants
CustomWebSocket.CONNECTING = 0;
CustomWebSocket.OPEN = 1;
CustomWebSocket.CLOSING = 2;
CustomWebSocket.CLOSED = 3;

// Export the WebSocket class
export default CustomWebSocket;

// If in global context, replace global.WebSocket
if (typeof global !== 'undefined') {
  global.WebSocket = CustomWebSocket;
} 