'use client';

import { useEffect } from 'react';

// Neutraliza cualquier llamada de red real desde la demo: ni las rutas /api/* de la app
// ni Supabase (REST o Realtime) llegan a tocar el backend de verdad. Así la demo puede
// reutilizar los componentes reales sin depender de infraestructura viva ni poder escribir datos.
function isGuardedUrl(url: string): boolean {
  if (url.startsWith('/api/')) return true;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined);
    if (parsed.pathname.startsWith('/api/')) return true;
    return parsed.hostname.includes('supabase.co');
  } catch {
    return false;
  }
}

class DummyWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = DummyWebSocket.CLOSED;
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(_url: string | URL, _protocols?: string | string[]) {}
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
}

export function DemoNetworkGuard() {
  useEffect(() => {
    const originalFetch = window.fetch;
    const OriginalWebSocket = window.WebSocket;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!isGuardedUrl(url)) return originalFetch(input, init);

      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET' || method === 'HEAD') {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(
        JSON.stringify({ error: 'Modo demo: solo lectura', message: 'Modo demo: solo lectura' }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      );
    };

    // @ts-expect-error -- sustitución deliberada por una clase compatible mínima para la demo
    window.WebSocket = DummyWebSocket;

    return () => {
      window.fetch = originalFetch;
      window.WebSocket = OriginalWebSocket;
    };
  }, []);

  return null;
}
