// crypto-mock.js - Mock implementation of crypto functions for Hermes
import { Buffer } from 'buffer';

// Mock randomBytes function that returns consistent data
const randomBytes = (size) => {
  const bytes = new Uint8Array(size);
  // Fill with a predictable pattern
  for (let i = 0; i < size; i++) {
    bytes[i] = (i % 256);
  }
  return bytes;
};

// Create a consistent seed value
const seed = 'staticCryptoSeed12345';

// Mock basic crypto functions
const cryptoMock = {
  randomBytes,
  seed,
  createHash: (algorithm) => ({
    update: (data) => ({
      digest: (encoding) => {
        if (encoding === 'hex') {
          return '0123456789abcdef0123456789abcdef';
        } else if (encoding === 'base64') {
          return 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
        } else {
          // Return a Uint8Array if no encoding specified
          return new Uint8Array(16).fill(1);
        }
      },
      seed
    }),
    seed
  }),
  createHmac: (algorithm, key) => ({
    update: (data) => ({
      digest: (encoding) => {
        if (encoding === 'hex') {
          return 'fedcba9876543210fedcba9876543210';
        } else if (encoding === 'base64') {
          return 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=';
        } else {
          // Return a Uint8Array if no encoding specified
          return new Uint8Array(16).fill(2);
        }
      },
      seed
    }),
    seed
  }),
  pbkdf2: (password, salt, iterations, keylen, digest, callback) => {
    // Simulate async behavior
    setTimeout(() => {
      callback(null, randomBytes(keylen));
    }, 0);
  },
  pbkdf2Sync: (password, salt, iterations, keylen, digest) => {
    return randomBytes(keylen);
  }
};

// Add additional properties that might be accessed by the crypto library
cryptoMock.DEFAULT_ENCODING = 'buffer';
cryptoMock.randomUUID = () => '00000000-0000-0000-0000-000000000000';

// Make sure the subtle crypto API is also mocked
const subtleCrypto = {
  digest: async (algorithm, data) => {
    return new Uint8Array(32).fill(1);
  },
  encrypt: async () => new Uint8Array(32).fill(2),
  decrypt: async () => new Uint8Array(32).fill(3),
  sign: async () => new Uint8Array(32).fill(4),
  verify: async () => true,
  deriveBits: async () => new Uint8Array(32).fill(5),
  deriveKey: async () => ({ type: 'secret', extractable: true }),
  exportKey: async () => new Uint8Array(32).fill(6),
  generateKey: async () => ({ type: 'secret', extractable: true }),
  importKey: async () => ({ type: 'secret', extractable: true }),
  wrapKey: async () => new Uint8Array(32).fill(7),
  unwrapKey: async () => ({ type: 'secret', extractable: true })
};

// Export the mock
export default cryptoMock;

// If crypto is referenced globally, add our mock
if (typeof global !== 'undefined') {
  global.crypto = global.crypto || {
    getRandomValues: (array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    subtle: subtleCrypto,
    randomUUID: () => '00000000-0000-0000-0000-000000000000'
  };
} 