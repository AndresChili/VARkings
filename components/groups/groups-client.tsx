'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, LogIn, Users, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupMembership {
  joined_at: string;
  groups: {
    id: string;
    name: string;
    description: string | null;
    invite_code: string;
    created_by: string | null;
    created_at: string;
  } | null;
}

interface GroupsClientProps {
  memberships: GroupMembership[];
  memberCounts: Record<string, number>;
  userId: string;
}

export function GroupsClient({ memberships, memberCounts, userId }: GroupsClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinPending, setJoinPending] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setShowCreate(false);
    setCreateForm({ name: '', description: '' });
    router.push(`/groups/${data.group.id}`);
    router.refresh();
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: joinCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    if (data.already_member) { setError('Ya eres miembro de este grupo'); return; }
    setShowJoin(false);
    setJoinCode('');
    if (data.pending) {
      setJoinPending(true);
      return;
    }
    router.push(`/groups/${data.group.id}`);
    router.refresh();
  }

  async function copyCode(code: string, id: string) {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis grupos</h1>
          {memberships.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {memberships.length} {memberships.length === 1 ? 'grupo' : 'grupos'}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError(''); }}
            className="flex items-center gap-1.5 bg-surface-card border border-white/10 text-gray-300
              px-3 py-2 rounded-xl text-sm hover:border-field/50 transition-colors"
          >
            <LogIn size={16} />
            Unirse
          </button>
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(''); }}
            className="flex items-center gap-1.5 bg-field text-white px-3 py-2 rounded-xl text-sm
              hover:bg-field-muted transition-colors font-medium"
          >
            <Plus size={16} />
            Crear
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-card border border-field/30 rounded-2xl p-5 animate-slide-up">
          <h3 className="font-bold text-white mb-4">Crear grupo</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              placeholder="Nombre del grupo"
              value={createForm.name}
              onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              required
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                placeholder-gray-600 focus:outline-none focus:border-field transition-colors text-sm"
            />
            <input
              type="text"
              placeholder="Descripción (opcional)"
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                placeholder-gray-600 focus:outline-none focus:border-field transition-colors text-sm"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm
                  hover:border-white/20 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-field text-white text-sm font-semibold
                  disabled:opacity-50 hover:bg-field-muted transition-colors"
              >
                {loading ? 'Creando...' : 'Crear grupo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Join form */}
      {showJoin && (
        <div className="bg-surface-card border border-crown/30 rounded-2xl p-5 animate-slide-up">
          <h3 className="font-bold text-white mb-4">Unirse con código</h3>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Código de invitación (ej: AB12CD34)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              required
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                placeholder-gray-600 focus:outline-none focus:border-crown transition-colors text-sm
                tracking-widest uppercase"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowJoin(false); setError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm
                  hover:border-white/20 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-crown text-surface text-sm font-bold
                  disabled:opacity-50 hover:bg-crown-muted transition-colors"
              >
                {loading ? 'Uniéndome...' : 'Unirse'}
              </button>
            </div>
          </form>
        </div>
      )}

      {joinPending && (
        <div className="bg-field/10 border border-field/30 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-lg">⏳</span>
          <div>
            <p className="text-sm font-semibold text-white">Solicitud enviada</p>
            <p className="text-xs text-gray-400 mt-0.5">El admin del grupo debe aceptarte para unirte.</p>
          </div>
          <button onClick={() => setJoinPending(false)} className="ml-auto text-gray-500 hover:text-gray-300 transition-colors">
            <span className="text-sm">✕</span>
          </button>
        </div>
      )}

      {/* Groups list */}
      {memberships.length === 0 ? (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-field/20 to-field-dark/30 border border-field/20 flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-field-light" />
          </div>
          <p className="text-white font-semibold mb-1">Sin grupos todavía</p>
          <p className="text-gray-500 text-sm">Crea un grupo o únete con un código de invitación</p>
        </div>
      ) : (
        <div className="space-y-4">
          {memberships.map((m) => {
            if (!m.groups) return null;
            const g = m.groups;
            const count = memberCounts[g.id] ?? 1;
            const isCreator = g.created_by === userId;
            const initials = g.name.slice(0, 2).toUpperCase();

            return (
              <div
                key={g.id}
                className="group relative bg-surface-card border border-white/10 rounded-2xl overflow-hidden
                  transition-all duration-200 hover:border-field/40 hover:shadow-lg hover:shadow-field/5 card-hover"
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-field via-field-light/60 to-transparent" />

                <Link href={`/groups/${g.id}`} className="block p-4 pt-5">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-field/30 to-field-dark/60
                      border border-field/25 flex items-center justify-center shadow-inner">
                      <span className="text-field-light font-bold text-base">{initials}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white truncate">{g.name}</h3>
                        {isCreator && (
                          <span className="text-[10px] bg-crown/20 text-crown border border-crown/20 px-1.5 py-0.5 rounded-md font-semibold shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      {g.description ? (
                        <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{g.description}</p>
                      ) : (
                        <p className="text-xs text-gray-600 mt-0.5 italic">Sin descripción</p>
                      )}
                      <div className="flex items-center gap-1 mt-1.5">
                        <Users size={11} className="text-gray-500" />
                        <span className="text-xs text-gray-500">{count} {count === 1 ? 'miembro' : 'miembros'}</span>
                      </div>
                    </div>

                    <ChevronRight
                      size={16}
                      className="text-gray-500 mt-1 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-field-light"
                    />
                  </div>
                </Link>

                {/* Invite code */}
                <div className="mx-4 mb-4">
                  <div className="bg-surface/70 border border-white/5 rounded-xl px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Código</span>
                      <span className="text-sm font-mono font-bold text-crown tracking-[0.2em]">{g.invite_code}</span>
                    </div>
                    <button
                      onClick={() => copyCode(g.invite_code, g.id)}
                      className={cn(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all duration-200',
                        copiedId === g.id
                          ? 'bg-field/20 text-field-light border border-field/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                      )}
                    >
                      {copiedId === g.id ? <Check size={11} /> : <Copy size={11} />}
                      {copiedId === g.id ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
