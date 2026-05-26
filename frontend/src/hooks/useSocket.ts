'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function useSocket(onEvents?: (s: Socket) => void) {
  const user = useAuthStore((s) => s.user);
  const handlerRef = useRef(onEvents);
  handlerRef.current = onEvents;

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    handlerRef.current?.(socket);

    return () => {
      socket?.disconnect();
      socket = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  return socket;
}
