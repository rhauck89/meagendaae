import { supabase } from '@/integrations/supabase/client';

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a push notification to a specific user via edge function
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        user_id: userId,
        title: payload.title,
        body: payload.body,
        url: payload.url || '/dashboard',
      },
    });

    if (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Push notification error:', err);
    return { success: false, error: err };
  }
}

/**
 * Send push notification to the professional when appointment changes
 */
export async function notifyProfessionalPush(
  professionalUserId: string,
  event: 'created' | 'cancelled' | 'rescheduled',
  clientName: string,
  time: string
) {
  const messages: Record<string, PushPayload> = {
    created: {
      title: 'Novo agendamento',
      body: `${clientName} marcou horário às ${time}`,
      url: '/dashboard',
    },
    cancelled: {
      title: 'Agendamento cancelado',
      body: `${clientName} cancelou horário das ${time}`,
      url: '/dashboard',
    },
    rescheduled: {
      title: 'Agendamento reagendado',
      body: `${clientName} reagendou para ${time}`,
      url: '/dashboard',
    },
  };

  return sendPushToUser(professionalUserId, messages[event]);
}
