// Empty module for Node.js dependencies
// This is used to replace Node.js modules that aren't available in React Native
import { Buffer } from 'buffer';

// Socket class for network modules
class MockSocket {
  constructor() {
    this.destroyed = true;
    this.readable = false;
    this.writable = false;
  }
  connect() { return this; }
  on() { return this; }
  once() { return this; }
  end() {}
  destroy() {}
}

// TLS Socket extending the mock socket
class MockTLSSocket extends MockSocket {
  constructor() {
    super();
    this.encrypted = true;
    this.authorized = false;
  }
}

// Net module mock
const net = {
  Socket: MockSocket,
  createConnection: () => new MockSocket(),
  connect: () => new MockSocket(),
};

// TLS module mock
const tls = {
  connect: () => new MockSocket(),
  TLSSocket: MockTLSSocket,
};

// FS module mock
const fs = {
  readFile: (path, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }
    if (typeof callback === 'function') {
      callback(new Error('File system not available in React Native'));
    }
  },
  readFileSync: () => {
    throw new Error('File system not available in React Native');
  },
  writeFile: (path, data, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }
    if (typeof callback === 'function') {
      callback(new Error('File system not available in React Native'));
    }
  },
  writeFileSync: () => {
    throw new Error('File system not available in React Native');
  },
  existsSync: () => false,
  promises: {
    readFile: async () => {
      throw new Error('File system not available in React Native');
    },
    writeFile: async () => {
      throw new Error('File system not available in React Native');
    }
  }
};

// Zlib module mock
const zlib = {
  createGzip: () => ({ 
    on: () => ({}),
    pipe: () => ({}),
    flush: () => ({}),
    end: () => ({})
  }),
  createGunzip: () => ({ 
    on: () => ({}),
    pipe: () => ({}),
    flush: () => ({}),
    end: () => ({})
  }),
  gzip: (data, callback) => {
    if (typeof callback === 'function') {
      callback(null, Buffer.from([]));
    }
  },
  gunzip: (data, callback) => {
    if (typeof callback === 'function') {
      callback(null, Buffer.from([]));
    }
  },
  gzipSync: () => Buffer.from([]),
  gunzipSync: () => Buffer.from([]),
  deflate: (data, callback) => {
    if (typeof callback === 'function') {
      callback(null, Buffer.from([]));
    }
  },
  inflate: (data, callback) => {
    if (typeof callback === 'function') {
      callback(null, Buffer.from([]));
    }
  },
  deflateSync: () => Buffer.from([]),
  inflateSync: () => Buffer.from([]),
};

// Http module mock
const http = {
  createServer: () => ({
    listen: () => ({}),
    on: () => ({}),
    close: () => ({})
  }),
  request: () => ({
    on: () => ({}),
    end: () => ({})
  }),
  get: (url, callback) => {
    if (typeof callback === 'function') {
      callback({
        on: () => ({}),
        statusCode: 404,
        headers: {}
      });
    }
    return {
      on: () => ({}),
      end: () => ({})
    };
  }
};

// Export everything directly so they can be accessed as properties
export { net, tls, fs, zlib, http };

// Also export as default object for compatibility
export default { net, tls, fs, zlib, http }; 