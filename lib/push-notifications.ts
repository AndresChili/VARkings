import webpush from 'web-push';
import type { PushNotificationPayload } from '@/types';

function configureVapid() {
  const email = process.env.VAPID_EMAIL;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (email && publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey);
  }
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: PushNotificationPayload
) {
  try {
    configureVapid();
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth_key,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? '/icons/icon-192x192.png',
        badge: payload.badge ?? '/icons/badge-72x72.png',
        url: payload.url ?? '/',
      })
    );
    return { success: true };
  } catch (error) {
    console.error('Push notification error:', error);
    return { success: false, error };
  }
}

export async function sendBulkPushNotifications(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth_key: string }>,
  payload: PushNotificationPayload
) {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushNotification(sub, payload))
  );
  return results;
}
