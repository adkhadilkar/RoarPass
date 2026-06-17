import type { Server as HTTPServer } from 'http';
import { type Server as SocketIOServer, type Socket } from 'socket.io';
import { verifyAccessToken } from '../auth/tokenService';
import { registerMessagingHandlers } from './handlers/messagingHandlers';
import { registerPresenceHandlers } from './handlers/presenceHandlers';
import { logger } from '../../lib/logger';

export interface SocketUser {
  fanProfileId: string;
  locale: string;
}

declare module 'socket.io' {
  interface Socket {
    user?: SocketUser;
  }
}

/**
 * Single Socket.IO server instance shared across realtime features.
 * Conflict resolution: presence (already on main) and messaging (incoming)
 * both registered their own io factory. Merged into one bootstrap that
 * mounts both handler groups onto the same namespace.
 */
export function createRealtimeServer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    path: '/realtime',
    cors: {
      origin: process.env.REALTIME_CORS_ORIGINS?.split(',') ?? [],
      credentials: true,
    },
    // messaging chunk requires larger buffer for media metadata payloads
    maxHttpBufferSize: 1e6,
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('UNAUTHENTICATED'));
      const claims = await verifyAccessToken(token);
      socket.user = { fanProfileId: claims.sub, locale: claims.locale ?? 'en' };
      return next();
    } catch (err) {
      logger.warn('realtime auth rejected', { err: (err as Error).message });
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info('realtime connected', { fanProfileId: socket.user?.fanProfileId });
    // Both feature handler groups share the authenticated socket.
    registerPresenceHandlers(io, socket);
    registerMessagingHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info('realtime disconnected', {
        fanProfileId: socket.user?.fanProfileId,
        reason,
      });
    });
  });

  return io;
}