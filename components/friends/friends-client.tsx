'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, UserPlus, Check, X, Loader2, Users, Clock, UserMinus, Link2, Plus, ArrowRight, User, Trophy, ChevronUp, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { LevelBadge } from '@/components/ui/level-badge';
import { triggerAchievementCheck } from '@/components/ui/achievement-checker';
import { getLevel } from '@/lib/xp';
import { isValidAvatarUrl } from '@/lib/avatar';

interface FriendProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

interface Props {
  currentUserId: string;
  friendships: Friendship[];
  profiles: FriendProfile[];
  xpMap: Record<string, number>;
  pointsMap: Record<string, number>;
}

function Avatar({ profile, size = 11 }: { profile: FriendProfile; size?: number }) {
  const initials = profile.username.slice(0, 2).toUpperCase();
  const sizeClass = size === 11 ? 'w-11 h-11 text-sm' : 'w-10 h-10 text-xs';
  return (
    <div className={cn('rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-field to-field-dark flex items-center justify-center font-black text-white', sizeClass)}>
      {isValidAvatarUrl(profile.avatar_url)
        ? <img src={profile.avatar_url!} alt={profile.username} className="w-full h-full object-cover" />
        : initials
      }
    </div>
  );
}

type FriendsSort = 'none' | 'level-high' | 'level-low';
type RankingSort = 'points-high' | 'points-low';

function SortToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
}) {
  return (
    <div className="flex gap-0.5 bg-black/20 border border-white/8 rounded-xl p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
            value === opt.value ? 'bg-field/30 text-field-light' : 'text-gray-600 hover:text-gray-400'
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const RANKING_POSITION: Record<number, string> = {
  1: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20',
  2: 'bg-gray-400/15 text-gray-300 border border-gray-400/15',
  3: 'bg-orange-600/20 text-orange-400 border border-orange-500/20',
};

export function FriendsClient({ currentUserId, friendships: initial, profiles: initialProfiles, xpMap, pointsMap }: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [friendships, setFriendships] = useState<Friendship[]>(initial);
  const [profileMap, setProfileMap] = useState<Map<string, FriendProfile>>(
    () => new Map(initialProfiles.map((p) => [p.id, p]))
  );

  const [activeTab, setActiveTab] = useState<'friends' | 'ranking'>('friends');
  const [friendsSort, setFriendsSort] = useState<FriendsSort>('none');
  const [rankingSort, setRankingSort] = useState<RankingSort>('points-high');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ friendshipId: string; username: string; otherUserId: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    if (showAddMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  useEffect(() => {
    const channel = supabase
      .channel(`notify:${currentUserId}`)
      .on('broadcast', { event: 'new_request' }, async ({ payload }) => {
        const f = payload.friendship as Friendship;
        setFriendships((prev) => prev.find((x) => x.id === f.id) ? prev : [f, ...prev]);
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', f.requester_id)
          .single();
        if (profile) setProfileMap((prev) => new Map(prev).set(profile.id, profile));
      })
      .on('broadcast', { event: 'request_accepted' }, ({ payload }) => {
        const f = payload.friendship as Friendship;
        setFriendships((prev) => prev.map((x) => x.id === f.id ? f : x));
      })
      .on('broadcast', { event: 'friendship_deleted' }, ({ payload }) => {
        setFriendships((prev) => prev.filter((x) => x.id !== payload.friendshipId));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${currentUserId}`,
      }, async ({ new: f }) => {
        setFriendships((prev) => prev.find((x) => x.id === f.id) ? prev : [f as Friendship, ...prev]);
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', (f as Friendship).requester_id)
          .single();
        if (profile) setProfileMap((prev) => new Map(prev).set(profile.id, profile));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friendships',
        filter: `requester_id=eq.${currentUserId}`,
      }, ({ new: f }) => {
        setFriendships((prev) => prev.map((x) => x.id === f.id ? (f as Friendship) : x));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, currentUserId]);

  const getFriendship = (otherId: string) =>
    friendships.find(
      (f) =>
        (f.requester_id === currentUserId && f.addressee_id === otherId) ||
        (f.addressee_id === currentUserId && f.requester_id === otherId)
    );

  const received = friendships.filter(
    (f) => f.addressee_id === currentUserId && f.status === 'pending'
  );
  const accepted = friendships.filter((f) => f.status === 'accepted');
  const sent = friendships.filter(
    (f) => f.requester_id === currentUserId && f.status === 'pending'
  );

  const getFriendId = (f: Friendship) =>
    f.requester_id === currentUserId ? f.addressee_id : f.requester_id;

  const acceptedSorted = friendsSort === 'none'
    ? accepted
    : [...accepted].sort((a, b) => {
        const aLevel = getLevel(xpMap[getFriendId(a)] ?? 0);
        const bLevel = getLevel(xpMap[getFriendId(b)] ?? 0);
        return friendsSort === 'level-high' ? bLevel - aLevel : aLevel - bLevel;
      });

  const rankingSorted = [...accepted].sort((a, b) => {
    const aPts = pointsMap[getFriendId(a)] ?? 0;
    const bPts = pointsMap[getFriendId(b)] ?? 0;
    return rankingSort === 'points-high' ? bPts - aPts : aPts - bPts;
  });

  async function triggerSearch() {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setSearched(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .ilike('username', `%${term}%`)
      .neq('id', currentUserId)
      .limit(10);
    setSearching(false);
    setSearchResults(data ?? []);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      setSearched(false);
    }
  }

  const setItemLoading = (id: string, val: boolean) =>
    setLoading((prev) => ({ ...prev, [id]: val }));

  async function sendRequest(addressee: FriendProfile) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: Friendship = {
      id: tempId,
      requester_id: currentUserId,
      addressee_id: addressee.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    setFriendships((prev) => [optimistic, ...prev]);
    setProfileMap((prev) => new Map(prev).set(addressee.id, addressee));

    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressee_id: addressee.id }),
    });

    if (!res.ok) {
      setFriendships((prev) => prev.filter((f) => f.id !== tempId));
      return;
    }

    const data = await res.json();
    setFriendships((prev) => prev.map((f) => (f.id === tempId ? (data as Friendship) : f)));

    supabase.channel(`notify:${addressee.id}`).send({
      type: 'broadcast',
      event: 'new_request',
      payload: { friendship: data },
    });
  }

  async function acceptRequest(friendship: Friendship) {
    setFriendships((prev) =>
      prev.map((f) => (f.id === friendship.id ? { ...f, status: 'accepted' } : f))
    );

    const res = await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendship_id: friendship.id }),
    });

    if (!res.ok) {
      setFriendships((prev) =>
        prev.map((f) => (f.id === friendship.id ? { ...f, status: 'pending' } : f))
      );
      return;
    }

    triggerAchievementCheck();

    supabase.channel(`notify:${friendship.requester_id}`).send({
      type: 'broadcast',
      event: 'request_accepted',
      payload: { friendship: { ...friendship, status: 'accepted' } },
    });

    fetch('/api/xp/friend-accepted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendship_id: friendship.id }),
    }).catch(() => {});
  }

  async function deleteFriendship(friendshipId: string, otherUserId: string) {
    setFriendships((prev) => prev.filter((f) => f.id !== friendshipId));
    await supabase.from('friendships').delete().eq('id', friendshipId);

    supabase.channel(`notify:${otherUserId}`).send({
      type: 'broadcast',
      event: 'friendship_deleted',
      payload: { friendshipId },
    });
  }

  const getProfile = (id: string): FriendProfile =>
    profileMap.get(id) ?? { id, username: id.slice(0, 8), full_name: null, avatar_url: null };

  async function handleShare() {
    setShowAddMenu(false);
    const link = `${window.location.origin}/add/${currentUserId}`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'VARkings', text: '¡Añádeme como amigo en VARkings!', url: link }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(link);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2500);
    }
  }

  function handleAddByUsername() {
    setShowAddMenu(false);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  return (
    <div className="animate-fade-in max-w-lg mx-auto px-4 py-4 space-y-6">

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-surface-card border border-white/10 rounded-3xl p-6 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <UserMinus size={22} className="text-red-400" />
              </div>
              <div>
                <p className="font-bold text-white text-lg">¿Eliminar amigo?</p>
                <p className="text-gray-400 text-sm mt-1">@{confirmDelete.username} dejará de ser tu amigo</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-2xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    deleteFriendship(confirmDelete.friendshipId, confirmDelete.otherUserId);
                    setConfirmDelete(null);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-red-500/90 text-white text-sm font-semibold hover:bg-red-500 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-surface-card border border-white/10 rounded-2xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('friends')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            activeTab === 'friends'
              ? 'bg-gradient-to-br from-field to-field-dark text-white shadow-lg shadow-field/25'
              : 'text-gray-500 hover:text-gray-300'
          )}
        >
          <Users size={15} />
          Amigos
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            activeTab === 'ranking'
              ? 'bg-gradient-to-br from-field to-field-dark text-white shadow-lg shadow-field/25'
              : 'text-gray-500 hover:text-gray-300'
          )}
        >
          <Trophy size={15} />
          Ranking
        </button>
      </div>

      {/* ── AMIGOS TAB ── */}
      {activeTab === 'friends' && (
        <>
          {/* Search + Add */}
          <div className="flex gap-2.5 items-stretch">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
                placeholder="Nombre de usuario exacto…"
                className="w-full h-12 bg-surface-card border border-white/10 rounded-2xl pl-10 pr-12 text-white text-sm focus:outline-none focus:border-field/40 focus:bg-surface-hover placeholder-gray-600 transition-colors"
              />
              {searching ? (
                <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
              ) : query.trim() ? (
                <button
                  onClick={triggerSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl bg-field flex items-center justify-center text-white hover:bg-field-muted transition-colors"
                  aria-label="Buscar"
                >
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>
              ) : null}
            </div>
            <div className="relative shrink-0" ref={addMenuRef}>
              <button
                onClick={() => setShowAddMenu((v) => !v)}
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200',
                  'bg-gradient-to-br from-field to-field-dark border border-field-light/25',
                  'shadow-lg shadow-field/25 text-white',
                  'hover:shadow-field/45 hover:scale-105 active:scale-95',
                  showAddMenu && 'scale-95 shadow-none brightness-90'
                )}
                aria-label="Añadir amigo"
              >
                <Plus
                  size={20}
                  strokeWidth={2.5}
                  className={cn('transition-transform duration-200', showAddMenu && 'rotate-45')}
                />
              </button>

              {showAddMenu && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-64 bg-surface-card border border-white/10 rounded-2xl overflow-hidden z-20 shadow-2xl shadow-black/40 animate-slide-up">
                  <div className="px-4 pt-3.5 pb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Añadir amigo</p>
                  </div>

                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-hover transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-field/25 to-field-dark/25 border border-field/20 flex items-center justify-center shrink-0 group-hover:border-field/40 transition-colors">
                      {shareStatus === 'copied'
                        ? <Check size={15} className="text-field-light" />
                        : <Link2 size={15} className="text-field-light" />
                      }
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-sm text-white leading-tight">
                        {shareStatus === 'copied' ? '¡Enlace copiado!' : 'Compartir enlace'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-tight">Invita con tu link personal</p>
                    </div>
                  </button>

                  <div className="h-px bg-white/5 mx-4" />

                  <button
                    onClick={handleAddByUsername}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-hover transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-field/25 to-field-dark/25 border border-field/20 flex items-center justify-center shrink-0 group-hover:border-field/40 transition-colors">
                      <UserPlus size={15} className="text-field-light" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-sm text-white leading-tight">Buscar usuario</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-tight">Añade por nombre de usuario</p>
                    </div>
                  </button>

                  <div className="pb-1" />
                </div>
              )}
            </div>
          </div>

          {/* Search results */}
          {searched && (
            <div className="space-y-2">
              {searching ? null : searchResults.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">Sin resultados para &ldquo;{query}&rdquo;</p>
              ) : (
                searchResults.map((profile) => {
                  const existing = getFriendship(profile.id);
                  const isLoading = loading[profile.id];
                  return (
                    <div key={profile.id} className="flex items-center gap-3 bg-surface-card border border-white/8 rounded-2xl p-3">
                      <Avatar profile={profile} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">@{profile.username}</p>
                        {profile.full_name && (
                          <p className="text-gray-500 text-xs truncate">{profile.full_name}</p>
                        )}
                      </div>
                      {!existing && (
                        <button
                          onClick={() => sendRequest(profile)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-field text-white text-xs font-semibold disabled:opacity-50 hover:bg-field-muted transition-colors shrink-0"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                          Añadir
                        </button>
                      )}
                      {existing?.status === 'pending' && existing.requester_id === currentUserId && (
                        <span className="flex items-center gap-1 text-gray-500 text-xs shrink-0">
                          <Clock size={12} />
                          Enviada
                        </span>
                      )}
                      {existing?.status === 'pending' && existing.addressee_id === currentUserId && (
                        <button
                          onClick={() => acceptRequest(existing)}
                          disabled={isLoading || loading[existing.id]}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-field text-white text-xs font-semibold disabled:opacity-50 shrink-0"
                        >
                          <Check size={12} />
                          Aceptar
                        </button>
                      )}
                      {existing?.status === 'accepted' && (
                        <span className="flex items-center gap-1 text-field-light text-xs shrink-0">
                          <Check size={12} />
                          Amigo
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Received requests */}
          {!searched && received.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Solicitudes recibidas ({received.length})
              </p>
              <div className="space-y-2">
                {received.map((f) => {
                  const profile = getProfile(f.requester_id);
                  const isLoading = loading[f.id];
                  return (
                    <div key={f.id} className="flex items-center gap-3 bg-surface-card border border-field/20 rounded-2xl p-3">
                      <Avatar profile={profile} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">@{profile.username}</p>
                        {profile.full_name && (
                          <p className="text-gray-500 text-xs truncate">{profile.full_name}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => deleteFriendship(f.id, f.requester_id)}
                          disabled={isLoading}
                          className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-gray-500 hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50"
                          aria-label="Rechazar"
                        >
                          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        </button>
                        <button
                          onClick={() => acceptRequest(f)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-field text-white text-xs font-semibold disabled:opacity-50 hover:bg-field-muted transition-colors"
                          aria-label="Aceptar"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Aceptar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Friends list */}
          {!searched && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Amigos ({accepted.length})
                </p>
                {accepted.length > 1 && (
                  <SortToggle<FriendsSort>
                    value={friendsSort}
                    onChange={setFriendsSort}
                    options={[
                      { value: 'none', label: 'Nivel', icon: <span className="text-[9px] leading-none">—</span> },
                      { value: 'level-high', label: 'Nivel', icon: <ChevronDown size={10} /> },
                      { value: 'level-low', label: 'Nivel', icon: <ChevronUp size={10} /> },
                    ]}
                  />
                )}
              </div>
              {accepted.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-surface-card flex items-center justify-center">
                    <Users size={24} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">Aún no tienes amigos.<br />Busca por nombre de usuario para añadir.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {acceptedSorted.map((f) => {
                    const friendId = getFriendId(f);
                    const profile = getProfile(friendId);
                    const isLoading = loading[f.id];
                    const friendLevel = getLevel(xpMap[friendId] ?? 0);
                    return (
                      <div key={f.id} className="flex items-center gap-3 bg-surface-card border border-white/8 rounded-2xl p-3">
                        <Avatar profile={profile} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white text-sm font-semibold truncate">@{profile.username}</p>
                            <LevelBadge level={friendLevel} size="xs" />
                          </div>
                          {profile.full_name && (
                            <p className="text-gray-500 text-xs truncate">{profile.full_name}</p>
                          )}
                        </div>
                        <button
                          onClick={() => router.push(`/users/${friendId}`)}
                          className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-gray-500 hover:text-white hover:border-white/30 transition-colors"
                          aria-label="Ver perfil"
                        >
                          <User size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ friendshipId: f.id, username: profile.username, otherUserId: friendId })}
                          disabled={isLoading}
                          className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-gray-600 hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50"
                          aria-label="Eliminar amigo"
                        >
                          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Sent requests */}
          {!searched && sent.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Solicitudes enviadas ({sent.length})
              </p>
              <div className="space-y-2">
                {sent.map((f) => {
                  const profile = getProfile(f.addressee_id);
                  const isLoading = loading[f.id];
                  return (
                    <div key={f.id} className="flex items-center gap-3 bg-surface-card border border-white/8 rounded-2xl p-3 opacity-75">
                      <Avatar profile={profile} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">@{profile.username}</p>
                        <p className="text-gray-600 text-xs flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          Pendiente
                        </p>
                      </div>
                      <button
                        onClick={() => deleteFriendship(f.id, f.addressee_id)}
                        disabled={isLoading}
                        className="text-gray-600 hover:text-red-400 text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                        Cancelar
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── RANKING TAB ── */}
      {activeTab === 'ranking' && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Ranking ({accepted.length})
            </p>
            {accepted.length > 1 && (
              <SortToggle<RankingSort>
                value={rankingSort}
                onChange={setRankingSort}
                options={[
                  { value: 'points-high', label: 'Pts', icon: <ChevronDown size={10} /> },
                  { value: 'points-low', label: 'Pts', icon: <ChevronUp size={10} /> },
                ]}
              />
            )}
          </div>

          {accepted.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-surface-card flex items-center justify-center">
                <Trophy size={24} className="text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">Añade amigos para ver el ranking.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rankingSorted.map((f, index) => {
                const friendId = getFriendId(f);
                const profile = getProfile(friendId);
                const friendPts = pointsMap[friendId] ?? 0;
                const friendLevel = getLevel(xpMap[friendId] ?? 0);
                const position = index + 1;
                const positionClass = RANKING_POSITION[position] ?? 'bg-white/5 text-gray-600 border border-white/5';

                return (
                  <div
                    key={f.id}
                    className={cn(
                      'flex items-center gap-3 bg-surface-card border border-white/8 rounded-2xl p-3',
                      position === 1 && 'border-yellow-500/15 bg-yellow-500/5'
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0', positionClass)}>
                      {position}
                    </div>
                    <Avatar profile={profile} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white text-sm font-semibold truncate">@{profile.username}</p>
                        <LevelBadge level={friendLevel} size="xs" />
                      </div>
                      {profile.full_name && (
                        <p className="text-gray-500 text-xs truncate">{profile.full_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white text-sm font-bold tabular-nums">{friendPts.toLocaleString()}</p>
                      <p className="text-gray-600 text-xs">pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
