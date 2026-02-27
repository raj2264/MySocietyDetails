// Mock implementation of Supabase Realtime client
// This completely disables WebSocket functionality

// Create a consistent seed value for mock randomness
const mockSeed = {
  seed: 'staticSeedForMock12345',
  encode: () => 'mockEncodedData',
  decode: () => ({ data: {} }),
  randomBytes: (n) => new Uint8Array(n).fill(1),
  randomInt: () => 42,
  randomUUID: () => '00000000-0000-0000-0000-000000000000'
};

class RealtimeClientMock {
  constructor(endpoint, options) {
    console.log('RealtimeClientMock: Supabase Realtime is disabled in this build');
    this.channels = [];
    this.seed = mockSeed.seed;
    this.encode = mockSeed.encode;
    this.decode = mockSeed.decode;
  }

  connect() { return this; }
  disconnect() { return this; }
  
  channel(topic, params = {}) {
    const channel = {
      topic,
      params,
      join: () => channel,
      on: () => channel,
      subscribe: (callback = () => {}) => {
        // Call callback but indicate that subscription was unsuccessful
        setTimeout(() => callback('CHANNEL_ERROR'), 0);
        return { 
          unsubscribe: () => {},
          seed: mockSeed.seed 
        };
      },
      unsubscribe: () => {},
      send: () => {},
      updateJoinPayload: () => {},
      rejoin: () => {},
      trigger: () => {},
      presence: {
        track: () => {},
        untrack: () => {},
      },
      seed: mockSeed.seed
    };
    
    this.channels.push(channel);
    return channel;
  }
  
  removeChannel(channel) {
    const idx = this.channels.indexOf(channel);
    if (idx > -1) this.channels.splice(idx, 1);
  }
  
  removeAllChannels() {
    this.channels = [];
  }
  
  isConnected() {
    return false;
  }
}

// Export the mock implementation with the same interface as the original
export { RealtimeClientMock as RealtimeClient };

// Also export a complete mock of the realtime-js package
export default {
  RealtimeClient: RealtimeClientMock,
  RealtimeSubscription: class RealtimeSubscriptionMock {
    constructor() {
      this.seed = mockSeed.seed;
    }
    unsubscribe() {}
  },
  RealtimePresence: class RealtimePresenceMock {
    constructor() {
      this.seed = mockSeed.seed;
    }
    track() {}
    untrack() {}
  },
  // Add helper functions that might be used
  serializeQueryParams: () => '',
  VSN: '1.0.0',
  SOCKET_STATES: {
    connecting: 0,
    open: 1,
    closing: 2,
    closed: 3
  },
  TRANSPORTS: {
    websocket: 'websocket'
  },
  DEFAULT_TIMEOUT: 10000,
  WS_CLOSE_NORMAL: 1000,
  CHANNEL_STATES: {
    closed: 'closed',
    errored: 'errored',
    joined: 'joined',
    joining: 'joining',
    leaving: 'leaving'
  },
  CHANNEL_EVENTS: {
    close: 'phx_close',
    error: 'phx_error',
    join: 'phx_join',
    reply: 'phx_reply',
    leave: 'phx_leave',
    access_token: 'access_token'
  },
  SUBSCRIPTION_STATES: {
    SUBSCRIBED: 'SUBSCRIBED',
    TIMED_OUT: 'TIMED_OUT',
    CLOSED: 'CLOSED',
    CHANNEL_ERROR: 'CHANNEL_ERROR'
  }
}; 