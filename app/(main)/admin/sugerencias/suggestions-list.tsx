'use client';

import { useState } from 'react';
import { MessageSquare, User, ChevronLeft, ChevronDown, Trash2, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { isValidAvatarUrl } from '@/lib/avatar';

export type SuggestionRow = {
  id: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
};

export function SuggestionsList({ initial }: { initial: SuggestionRow[] }) {
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>(initial);
  const [tab, setTab] = useState<'unread' | 'read'>('unread');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  async function markRead(id: string) {
    setSuggestions((prev) => prev.map((x) => x.id === id ? { ...x, is_read: true } : x));
    setExpanded(null);
    await fetch(`/api/suggestions/${id}`, { method: 'PATCH' });
  }

  async function deleteSuggestion(id: string) {
    setDeleting(id);
    setSuggestions((prev) => prev.filter((x) => x.id !== id));
    setExpanded(null);
    await fetch(`/api/suggestions/${id}`, { method: 'DELETE' });
    setDeleting(null);
  }

  const unread = suggestions.filter((s) => !s.is_read);
  const read = suggestions.filter((s) => s.is_read);
  const list = tab === 'unread' ? unread : read;

  return (
    <div className="animate-fade-in max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/profile"
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Volver al perfil"
        >
          <ChevronLeft size={18} className="text-gray-400" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
          <MessageSquare size={17} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white">Sugerencias</h1>
          <p className="text-xs text-gray-500">{suggestions.length} en total</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('unread')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            tab === 'unread'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/8'
          }`}
        >
          No leídas
          {unread.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
              {unread.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('read')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            tab === 'read'
              ? 'bg-white/10 text-gray-300 border border-white/15'
              : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/8'
          }`}
        >
          Leídas
          <span className="text-xs text-gray-600">{read.length}</span>
        </button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          {tab === 'unread' ? 'No hay mensajes sin leer.' : 'No hay mensajes leídos.'}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div key={s.id} className="bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
              {/* Fila de cabecera — solo expande/colapsa */}
              <button
                onClick={() => toggleExpand(s.id)}
                className="w-full flex items-center gap-2 px-4 py-3.5 text-left"
              >
                <div className="w-6 h-6 rounded-full bg-field/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {isValidAvatarUrl(s.profiles?.avatar_url) ? (
                    <img src={s.profiles!.avatar_url!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={12} className="text-gray-400" />
                  )}
                </div>
                <span className="text-xs font-medium text-gray-500 flex-shrink-0">
                  @{s.profiles?.username ?? '?'}
                </span>
                <span className={`text-sm truncate flex-1 min-w-0 ${s.is_read ? 'text-gray-400' : 'text-white font-semibold'}`}>
                  {s.subject}
                </span>
                <span className="text-xs text-gray-600 flex-shrink-0">
                  {new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-gray-600 flex-shrink-0 transition-transform ${expanded === s.id ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Cuerpo expandido */}
              {expanded === s.id && (
                <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words overflow-hidden">{s.message}</p>
                  <p className="text-xs text-gray-600">
                    {new Date(s.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <div className="flex gap-2 pt-1">
                    {!s.is_read && (
                      <button
                        onClick={() => markRead(s.id)}
                        className="flex-1 py-2 rounded-xl bg-field/15 text-field-light text-sm font-semibold hover:bg-field/25 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCheck size={14} />
                        Leída
                      </button>
                    )}
                    <button
                      onClick={() => deleteSuggestion(s.id)}
                      disabled={deleting === s.id}
                      className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Borrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
