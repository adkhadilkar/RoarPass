import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createRealtimeServer } from './socketServer';

// As vitest static analysis requires modules to exist even with virtual: true if dynamic import is used (since vitest tries to bundle/analyze them),
// we avoid dynamic imports and we avoid static imports of non-existent files.
// But how do we get the mock instance if we don't import it?
// We can use vi.hoisted!

const mocks = vi.hoisted(() => {
  return {
    verifyAccessToken: vi.fn(),
    registerMessagingHandlers: vi.fn(),
    registerPresenceHandlers: vi.fn(),
    loggerInfo: vi.fn(),
    loggerWarn: vi.fn(),
    loggerError: vi.fn(),
    mockUse: vi.fn(),
    mockOn: vi.fn(),
  };
});

vi.mock('socket.io', () => {
  return {
    Server: class {
      use = mocks.mockUse;
      on = mocks.mockOn;
    },
  };
});

vi.mock('../auth/tokenService', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}), { virtual: true });

vi.mock('./handlers/messagingHandlers', () => ({
  registerMessagingHandlers: mocks.registerMessagingHandlers,
}), { virtual: true });

vi.mock('./handlers/presenceHandlers', () => ({
  registerPresenceHandlers: mocks.registerPresenceHandlers,
}), { virtual: true });

vi.mock('../../lib/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError },
}), { virtual: true });

describe('createRealtimeServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a server and register middleware', () => {
    const httpServer = new HTTPServer();
    const io = createRealtimeServer(httpServer);
    expect(io).toBeDefined();
    expect(mocks.mockUse).toHaveBeenCalled();
    expect(mocks.mockOn).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  describe('auth middleware', () => {
    it('should reject if no token is provided', async () => {
      const httpServer = new HTTPServer();
      const io = createRealtimeServer(httpServer);
      const middleware = mocks.mockUse.mock.calls[0][0];

      const socket: any = {
        handshake: { auth: {} },
      };
      const next = vi.fn();

      await middleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('UNAUTHENTICATED');
    });

    it('should authenticate successfully with valid token', async () => {
      const httpServer = new HTTPServer();
      const io = createRealtimeServer(httpServer);
      const middleware = mocks.mockUse.mock.calls[0][0];

      mocks.verifyAccessToken.mockResolvedValue({
        sub: 'user-123',
        locale: 'fr',
      });

      const socket: any = {
        handshake: { auth: { token: 'valid-token' } },
      };
      const next = vi.fn();

      await middleware(socket, next);

      expect(mocks.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(socket.user).toEqual({ fanProfileId: 'user-123', locale: 'fr' });
      expect(next).toHaveBeenCalledWith();
    });

    it('should handle token verification failure', async () => {
      const httpServer = new HTTPServer();
      const io = createRealtimeServer(httpServer);
      const middleware = mocks.mockUse.mock.calls[0][0];

      mocks.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      const socket: any = {
        handshake: { auth: { token: 'invalid-token' } },
      };
      const next = vi.fn();

      await middleware(socket, next);

      expect(mocks.loggerWarn).toHaveBeenCalledWith('realtime auth rejected', { err: 'Invalid token' });
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('UNAUTHENTICATED');
    });
  });

  describe('connection handler', () => {
    it('should register handlers on connection', () => {
      const httpServer = new HTTPServer();
      const io = createRealtimeServer(httpServer);
      const connectionHandler = mocks.mockOn.mock.calls.find(c => c[0] === 'connection')![1];

      const socket: any = {
        user: { fanProfileId: 'user-123' },
        on: vi.fn(),
      };

      connectionHandler(socket);

      expect(mocks.loggerInfo).toHaveBeenCalledWith('realtime connected', { fanProfileId: 'user-123' });
      expect(mocks.registerPresenceHandlers).toHaveBeenCalledWith(io, socket);
      expect(mocks.registerMessagingHandlers).toHaveBeenCalledWith(io, socket);
      expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));

      const disconnectHandler = vi.mocked(socket.on).mock.calls.find(c => c[0] === 'disconnect')![1];
      disconnectHandler('ping timeout');
      expect(mocks.loggerInfo).toHaveBeenCalledWith('realtime disconnected', {
        fanProfileId: 'user-123',
        reason: 'ping timeout',
      });
    });
  });
});
