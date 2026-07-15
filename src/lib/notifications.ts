import { supabase } from './supabase';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export const createNotification = async (userId: string, title: string, message: string, type: NotificationType = 'info', route?: string) => {
  try {
    const { error } = await supabase.from('notifications').insert([{
      user_id: userId,
      title,
      message,
      type,
      route,
      is_read: false
    }]);
    if (error) throw error;
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
};

export const notifyAllAdmins = async (title: string, message: string, type: NotificationType = 'info', route?: string) => {
  // En este sistema simple, los admins son 'jorge' e 'isamar'
  const admins = ['jorge', 'isamar'];
  for (const adminId of admins) {
    await createNotification(adminId, title, message, type, route);
  }
};
