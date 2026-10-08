'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'varkings_v2_seen';

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={dismiss}
    >
      <div
        className="relative bg-surface-card border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm overflow-hidden shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cerrar */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X size={15} />
        </button>

        {/* Cabecera */}
        <div className="relative bg-gradient-to-br from-blue-950 via-blue-900/80 to-indigo-900 px-6 pt-10 pb-8 text-center overflow-hidden">
          {/* Formas decorativas */}
          <div className="absolute -top-8 -left-8 w-36 h-36 rounded-full bg-blue-500/10" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-indigo-500/15" />
          <div className="absolute top-5 right-12 w-2 h-2 rounded-full bg-blue-300/40" />
          <div className="absolute bottom-8 left-10 w-1.5 h-1.5 rounded-full bg-indigo-300/30" />

          <div className="relative">
            {/* Insignia de versión */}
            <div className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold px-3 py-1 rounded-full mb-4">
              <Sparkles size={11} />
              NOVEDAD
            </div>

            {/* Número de versión grande */}
            <div className="text-7xl font-black text-white leading-none tracking-tighter mb-1">
              2<span className="text-blue-400">.</span>0
            </div>
            <p className="text-blue-200/80 text-sm font-medium">VARkings 2.0.0</p>
          </div>
        </div>

        {/* Contenido */}
        <div className="px-5 py-5 space-y-3">
          <div>
            <h2 className="text-lg font-black text-white">¿Qué hay de nuevo?</h2>
            <p className="text-gray-500 text-sm mt-0.5">Esta actualización trae algo que pedíais</p>
          </div>

          {/* Tarjeta de funcionalidad */}
          <div className="relative bg-gradient-to-br from-blue-600/15 to-indigo-600/10 border border-blue-500/25 rounded-2xl p-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/5 rounded-bl-3xl pointer-events-none" />
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 bg-blue-500/20 border border-blue-400/30 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle size={21} className="text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Chat en tiempo real</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Cada grupo tiene ahora un chat. Habla con tus amigos mientras se juegan los partidos, en directo.
                </p>
                <div className="flex items-center gap-1.5 mt-2.5">
                  <span className="text-[11px] text-blue-400 font-semibold bg-blue-500/15 px-2 py-0.5 rounded-full">
                    Tiempo real
                  </span>
                  <span className="text-[11px] text-indigo-400 font-semibold bg-indigo-500/15 px-2 py-0.5 rounded-full">
                    Solo miembros
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-700 text-xs pt-1">Hecho por Andrés con ❤️</p>
        </div>

        {/* Llamada a la acción */}
        <div className="px-5 pb-6">
          <button
            onClick={dismiss}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
          >
            <MessageCircle size={17} />
            Ir a ver el chat
          </button>
        </div>
      </div>
    </div>
  );
}
