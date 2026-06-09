/// <reference lib="webworker" />
export type {};

self.addEventListener('push', (event) => {
  const e = event as PushEvent;
  const data = e.data?.json() ?? {};
  (e as ExtendableEvent).waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(
      data.title ?? 'VARkings',
      {
        body: data.body ?? '',
        icon: data.icon ?? '/icons/icon-192x192.png',
        badge: data.badge ?? '/icons/badge-72x72.png',
        data: { url: data.url ?? '/' },
      }
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  const e = event as NotificationEvent;
  e.notification.close();
  const url: string = e.notification.data?.url ?? '/';
  e.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => c.url.endsWith(url) && 'focus' in c);
        if (existing) return (existing as WindowClient).focus();
        return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(url);
      })
  );
});
