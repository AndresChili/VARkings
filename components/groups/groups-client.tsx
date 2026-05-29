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
    setShowJoin(false);
    setJoinCode('');
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
        <h1 className="text-2xl font-bold text-white">Mis grupos</h1>
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

      {/* Groups list */}
      {memberships.length === 0 ? (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-8 text-center">
          <Users size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Sin grupos todavía</p>
          <p className="text-gray-400 text-sm">Crea un grupo o únete con un código de invitación</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memberships.map((m) => {
            if (!m.groups) return null;
            const g = m.groups;
            const count = memberCounts[g.id] ?? 1;
            const isCreator = g.created_by === userId;

            return (
              <div key={g.id} className="bg-surface-card border border-white/10 rounded-2xl p-4 card-hover">
                <Link href={`/groups/${g.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white truncate">{g.name}</h3>
                        {isCreator && (
                          <span className="text-[10px] bg-crown/20 text-crown px-1.5 py-0.5 rounded font-medium shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      {g.description && (
                        <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{g.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        <Users size={11} className="inline mr-1" />
                        {count} {count === 1 ? 'miembro' : 'miembros'}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 mt-0.5 shrink-0" />
                  </div>
                </Link>

                {/* Invite code */}
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Código de invitación</p>
                    <p className="text-sm font-mono font-bold text-crown tracking-widest">{g.invite_code}</p>
                  </div>
                  <button
                    onClick={() => copyCode(g.invite_code, g.id)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors',
                      copiedId === g.id
                        ? 'bg-field/20 text-field-light'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    )}
                  >
                    {copiedId === g.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedId === g.id ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
