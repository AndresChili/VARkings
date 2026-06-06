'use client';

import { useEffect } from 'react';

export function useNavigationGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;

    window.history.pushState({ __guard: true }, '');

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = () => {
      const leave = window.confirm(
        '¿Seguro que quieres salir? Tus selecciones no guardadas se perderán.'
      );
      if (leave) {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.history.back();
      } else {
        window.history.pushState({ __guard: true }, '');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [active]);
}
