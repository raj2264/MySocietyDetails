// Import polyfills needed for React Native
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';
import 'react-native-get-random-values';
// Import the crypto polyfill
import cryptoMock from './lib/crypto-mock';
// Import our custom WebSocket implementation
import CustomWebSocket from './lib/ws-polyfill';

// Only polyfill what's absolutely needed
global.Buffer = Buffer;

// Make sure process is defined
if (typeof global.process === 'undefined') {
  global.process = require('process/browser');
}

// Only polyfill TextEncoder/TextDecoder if they don't already exist (newer Hermes has them)
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(input = '') {
      const buf = new Uint8Array(input.length);
      for (let i = 0; i < input.length; i++) {
        buf[i] = input.charCodeAt(i);
      }
      return buf;
    }
  };
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(input) {
      if (typeof input === 'undefined') return '';
      if (input instanceof ArrayBuffer) {
        input = new Uint8Array(input);
      }
      let result = '';
      for (let i = 0; i < input.length; i++) {
        result += String.fromCharCode(input[i]);
      }
      return result;
    }
  };
}

// Mock unavailable node modules
global.net = null;
global.tls = null;
global.fs = null;

// Add crypto polyfill globally
global.crypto = global.crypto || cryptoMock;

// Add a seed property to global for crypto functions
global.seed = cryptoMock.seed;

// Override WebSocket with our custom implementation
global.WebSocket = CustomWebSocket;

// Set navigator.product to ReactNative to avoid warnings
if (typeof global.navigator !== 'undefined') {
  global.navigator.product = 'ReactNative';
} 