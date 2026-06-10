'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function saveSubscription(sub: PushSubscription) {
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
}

export function PushPermissionBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    if (Notification.permission === 'granted') {
      // Permission already granted — silently ensure subscription is saved in DB
      // (covers cases where subscription was lost: cache clear, new device, SW update)
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      navigator.serviceWorker.ready.then(async (reg) => {
        try {
          const existing = await reg.pushManager.getSubscription();
          const sub = existing ?? await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
          });
          await saveSubscription(sub);
        } catch { /* silent */ }
      });
      return;
    }

    const dismissed = localStorage.getItem('push_banner_dismissed');
    if (!dismissed) setShow(true);
  }, []);

  async function subscribe() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setShow(false); return; }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { setShow(false); return; }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });

      await saveSubscription(sub);

      setShow(false);
    } catch (err) {
      console.error('Push subscription error:', err);
    }
  }

  function dismiss() {
    localStorage.setItem('push_banner_dismissed', '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 px-4 pt-2 max-w-lg mx-auto animate-slide-up">
      <div className="bg-surface-card border border-crown/30 rounded-2xl p-4 flex items-start gap-3 shadow-xl">
        <Bell className="text-crown shrink-0 mt-0.5" size={18} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Activa las notificaciones</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Recibe avisos 1 hora antes de cada partido y cuando se actualicen los puntos.
          </p>
          <button
            onClick={subscribe}
            className="mt-3 bg-crown text-surface text-xs font-bold px-4 py-2 rounded-lg hover:bg-crown-muted transition-colors"
          >
            Activar notificaciones
          </button>
        </div>
        <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
