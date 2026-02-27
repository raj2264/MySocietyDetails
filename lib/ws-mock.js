// ws-mock.js - Empty implementations for WebSocket
import { Buffer } from 'buffer';

class MockWebSocket {
  constructor() {
    console.warn('MockWebSocket: WebSocket functionality is disabled in this build');
    
    // Standard WebSocket properties
    this.url = '';
    this.protocol = '';
    this.readyState = 3; // CLOSED
    this.extensions = '';
    this.binaryType = 'arraybuffer';
    this.bufferedAmount = 0;
    
    // Event handlers
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // For cryptographic operations
    this.seed = 'staticMockSeed12345';
  }
  
  on() { return this; }
  addEventListener() { return this; }
  removeEventListener() { return this; }
  send() {}
  close() {}
  // Add internal methods that may be accessed
  _generateId() { return 'mock-id-123456'; }
  _getRandomBytes() { return new Uint8Array(16).fill(1); }
  _setMaxListeners() { return this; }
}

// Safely create a buffer alternative
const createSafeBuffer = (data) => {
  try {
    if (Buffer && typeof Buffer.from === 'function') {
      return Buffer.from(Array.isArray(data) ? data : []);
    }
  } catch (e) {
    // Ignore buffer errors
  }
  return new Uint8Array(0);
};

// Common supported extensions
const extensions = {
  'permessage-deflate': true,
  'x-webkit-deflate-frame': false
};

// Mock the entire ws module with empty implementations
const ws = {
  WebSocket: MockWebSocket,
  createWebSocketStream: () => ({}),
  Server: class MockServer {
    constructor() {
      console.warn('MockServer: WebSocket server is disabled in this build');
      this.clients = new Set();
      this.seed = 'staticMockSeed12345';
    }
    on() { return this; }
    close() {}
    handleUpgrade() {}
    emit() {}
    address() { return { port: 0 }; }
  },
  // Add these properties to match what might be accessed
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
  // Add Sender-related properties that might be accessed
  Sender: class MockSender {
    constructor() {
      this.seed = 'staticMockSeed12345';
    }
    close() {}
    ping() {}
    pong() {}
    send() {}
  },
  Receiver: class MockReceiver {
    constructor() {
      this.seed = 'staticMockSeed12345';
    }
    _write() {}
  },
  // Extensions and other properties
  extensions,
  // Add permessage-deflate related properties
  permessageDeflate: {
    seed: 'staticMockSeed12345',
    decompress: () => createSafeBuffer([]),
    compress: () => createSafeBuffer([])
  }
};

export default ws; 