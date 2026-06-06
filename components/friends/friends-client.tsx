'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, UserPlus, Check, X, Loader2, Users, Clock, UserMinus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

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
}

function Avatar({ profile, size = 11 }: { profile: FriendProfile; size?: number }) {
  const initials = profile.username.slice(0, 2).toUpperCase();
  const sizeClass = size === 11 ? 'w-11 h-11 text-sm' : 'w-10 h-10 text-xs';
  return (
    <div className={cn('rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-field to-field-dark flex items-center justify-center font-black text-white', sizeClass)}>
      {profile.avatar_url
        ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
        : initials
      }
    </div>
  );
}

export function FriendsClient({ currentUserId, friendships: initial, profiles: initialProfiles }: Props) {
  const supabase = createClient();

  const [friendships, setFriendships] = useState<Friendship[]>(initial);
  const [profileMap, setProfileMap] = useState<Map<string, FriendProfile>>(
    () => new Map(initialProfiles.map((p) => [p.id, p]))
  );

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const knownIds = new Set(friendships.flatMap((f) => [f.requester_id, f.addressee_id]));

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

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setSearchResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        const { data } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .ilike('username', `%${value.trim()}%`)
          .neq('id', currentUserId)
          .limit(10);
        setSearching(false);
        setSearchResults(data ?? []);
      }, 350);
    },
    [supabase, currentUserId]
  );

  const setItemLoading = (id: string, val: boolean) =>
    setLoading((prev) => ({ ...prev, [id]: val }));

  async function sendRequest(addressee: FriendProfile) {
    setItemLoading(addressee.id, true);
    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: currentUserId, addressee_id: addressee.id, status: 'pending' })
      .select()
      .single();
    setItemLoading(addressee.id, false);
    if (error || !data) return;
    setFriendships((prev) => [data as Friendship, ...prev]);
    setProfileMap((prev) => new Map(prev).set(addressee.id, addressee));
  }

  async function acceptRequest(friendship: Friendship) {
    setItemLoading(friendship.id, true);
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendship.id);
    setItemLoading(friendship.id, false);
    if (error) return;
    setFriendships((prev) =>
      prev.map((f) => (f.id === friendship.id ? { ...f, status: 'accepted' } : f))
    );
  }

  async function deleteFriendship(friendshipId: string) {
    setItemLoading(friendshipId, true);
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setItemLoading(friendshipId, false);
    setFriendships((prev) => prev.filter((f) => f.id !== friendshipId));
  }

  const getProfile = (id: string): FriendProfile =>
    profileMap.get(id) ?? { id, username: id.slice(0, 8), full_name: null, avatar_url: null };

  return (
    <div className="animate-fade-in max-w-lg mx-auto px-4 py-4 space-y-6">

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nombre de usuario…"
          className="w-full bg-surface-card border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-field/50 placeholder-gray-600"
        />
        {searching && (
          <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
        )}
      </div>

      {/* Search results */}
      {query.trim() && (
        <div className="space-y-2">
          {searchResults.length === 0 && !searching ? (
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
      {!query.trim() && received.length > 0 && (
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
                      onClick={() => deleteFriendship(f.id)}
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
      {!query.trim() && (
        <section>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Amigos ({accepted.length})
          </p>
          {accepted.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-surface-card flex items-center justify-center">
                <Users size={24} className="text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">Aún no tienes amigos.<br />Busca por nombre de usuario para añadir.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accepted.map((f) => {
                const friendId = f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
                const profile = getProfile(friendId);
                const isLoading = loading[f.id];
                return (
                  <div key={f.id} className="flex items-center gap-3 bg-surface-card border border-white/8 rounded-2xl p-3">
                    <Avatar profile={profile} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">@{profile.username}</p>
                      {profile.full_name && (
                        <p className="text-gray-500 text-xs truncate">{profile.full_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteFriendship(f.id)}
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
      {!query.trim() && sent.length > 0 && (
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
                    onClick={() => deleteFriendship(f.id)}
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
    </div>
  );
}
