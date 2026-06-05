'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent;
  }
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
}

const DISMISS_KEY = 'pwa-install-dismissed-v2';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    if (isIOS()) {
      setPlatform('ios');
      return;
    }

    // Android: show banner immediately
    setPlatform('android');

    // Pick up event captured before React hydrated
    if (window.__pwaPrompt) {
      setDeferredPrompt(window.__pwaPrompt);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDeferredPrompt(null);
    setPlatform(null);
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') dismiss();
    else setDeferredPrompt(null);
  }

  if (dismissed || !platform) return null;

  return (
    <div className="mx-4 mt-2 mb-1 rounded-xl bg-field/20 border border-field/40 px-4 py-3 flex items-start gap-3">
      <img src="/icons/icon-72x72.png" alt="VARkings" className="w-10 h-10 rounded-xl flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {platform === 'ios' ? (
          <>
            <p className="text-sm font-semibold text-white">Instalar en iPhone</p>
            <p className="text-xs text-white/60">
              Pulsa{' '}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline align-middle text-white/80">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {' '}y luego <strong className="text-white/80">"Añadir a pantalla de inicio"</strong>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-white">Instalar VARkings</p>
            <p className="text-xs text-white/60">Añade la app a tu pantalla de inicio</p>
          </>
        )}
      </div>
      {platform === 'android' && (
        deferredPrompt ? (
          <button
            onClick={install}
            className="bg-crown text-surface text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 self-center"
          >
            Instalar
          </button>
        ) : (
          <p className="text-xs text-white/40 flex-shrink-0 self-center text-right leading-tight">
            Menú ⋮<br />→ Instalar
          </p>
        )
      )}
      <button onClick={dismiss} className="text-white/40 text-lg leading-none flex-shrink-0 self-start">×</button>
    </div>
  );
}
