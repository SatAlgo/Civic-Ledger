import type { Server as HttpServer } from 'http';
import { Server as IOServer, type Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth';
import { User } from '../models/User';
import { corsOrigins } from '../config/env';

let io: IOServer | null = null;

/**
 * Initialize Socket.IO on top of the given HTTP server.
 * Verifies JWT on connection; rejects unauthenticated sockets.
 */
export function initSocket(server: HttpServer): IOServer {
  io = new IOServer(server, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware — verify JWT, attach user
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('Missing token'));

      const payload = verifyToken(token);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error('User not found'));

      (socket.data as any).userId = user._id.toString();
      (socket.data as any).role = user.role;
      (socket.data as any).departmentId = user.department?.toString() ?? null;
      next();
    } catch (err: any) {
      next(new Error(err?.message ?? 'Auth failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, role, departmentId } = socket.data as any;

    // Per-user room — for status updates to the reporter
    socket.join(`user:${userId}`);

    // Dept room — for incoming-issue notifications
    if (role === 'department_admin' && departmentId) {
      socket.join(`dept:${departmentId}`);
    }

    // Super-admin room — for reroute notifications
    if (role === 'super_admin') {
      socket.join('super_admin');
    }

    // Optional client-driven room joins (e.g. live map page wants city-wide)
    socket.on('join:map', () => socket.join('map'));
    socket.on('leave:map', () => socket.leave('map'));
  });

  return io;
}

export function getIO(): IOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized — call initSocket() first');
  }
  return io;
}
