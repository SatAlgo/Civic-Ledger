import type { Types } from 'mongoose';
import { Notification, type NotificationType } from '../models/Notification';
import { getIO } from '../sockets';

interface CreateNotificationParams {
  user: string | Types.ObjectId;
  issue?: string | Types.ObjectId;
  type: NotificationType;
  message: string;
}

/**
 * Persist a notification and push it to the user's socket room.
 */
export async function pushNotification(params: CreateNotificationParams) {
  const notification = await Notification.create({
    user: params.user,
    issue: params.issue ?? null,
    type: params.type,
    message: params.message,
    read: false,
  });

  try {
    getIO()
      .to(`user:${params.user.toString()}`)
      .emit('notification:new', notification);
  } catch {
    // Socket may not be initialised in tests — just skip
  }

  return notification;
}
