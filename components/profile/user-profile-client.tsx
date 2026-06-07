'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Target, Trophy, Users, Zap, UserPlus, Check, UserCheck, Loader2, Crown } from 'lucide-react';
import { LevelBadge } from '@/components/ui/level-badge';
import { cn } from '@/lib/utils';

interface LevelProgress {
  level: number;
  xpInLevel: number;
  xpNeeded: number;
  percent: number;
  totalXP: number;
}

interface UserProfileClientProps {
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  levelProgress: LevelProgress;
  stats: {
    matchPoints: number;
    totalPredictions: number;
    calculatedPredictions: number;
    winnerHits: number;
    friendsCount: number;
  };
  podio: {
    champion: string | null;
    runner_up: string | null;
    third_place: string | null;
  } | null;
  currentUserId: string | null;
  targetUserId: string;
  initialFriendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

export function UserProfileClient({
  profile,
  levelProgress,
  stats,
  podio,
  currentUserId,
  targetUserId,
  initialFriendshipStatus,
}: UserProfileClientProps) {
  const router = useRouter();
  const [friendStatus, setFriendStatus] = useState(initialFriendshipStatus);
  const [loading, setLoading] = useState(false);

  const initials = profile.username.slice(0, 2).toUpperCase();
  const isLoggedIn = !!currentUserId;

  async function sendRequest() {
    if (!currentUserId) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: currentUserId, addressee_id: targetUserId, status: 'pending' })
      .select()
      .single();
    if (!error && data) {
      setFriendStatus('pending_sent');
      supabase.channel(`notify:${targetUserId}`).send({
        type: 'broadcast',
        event: 'new_request',
        payload: { friendship: data },
      });
    }
    setLoading(false);
  }

  async function acceptRequest() {
    if (!currentUserId) return;
    setLoading(true);
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, requester_id')
      .or(
        `and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`
      )
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', existing.id);
      if (!error) {
        setFriendStatus('accepted');
        supabase.channel(`notify:${targetUserId}`).send({
          type: 'broadcast',
          event: 'request_accepted',
          payload: { friendship: { ...existing, status: 'accepted' } },
        });
        fetch('/api/xp/friend-accepted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ friendship_id: existing.id }),
        }).catch(() => {});
      }
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      {/* Profile card */}
      <div className="relative bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
        <div className="h-20 bg-gradient-to-br from-field-dark/60 via-field/20 to-crown/10" />
        <div className="px-5 pb-5">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-surface-card bg-surface-hover flex items-center justify-center text-xl font-black text-gray-300 shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.username}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            {isLoggedIn && (
              <button
                onClick={
                  friendStatus === 'pending_received' ? acceptRequest : sendRequest
                }
                disabled={
                  loading ||
                  friendStatus === 'accepted' ||
                  friendStatus === 'pending_sent'
                }
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                  friendStatus === 'accepted'
                    ? 'bg-field/20 text-field-light border border-field/30 cursor-default'
                    : friendStatus === 'pending_sent'
                    ? 'bg-white/5 text-gray-400 border border-white/10 cursor-default'
                    : 'bg-field text-white hover:bg-field-muted disabled:opacity-50'
                )}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : friendStatus === 'accepted' ? (
                  <><UserCheck size={14} /> Amigos</>
                ) : friendStatus === 'pending_sent' ? (
                  <><Check size={14} /> Pendiente</>
                ) : friendStatus === 'pending_received' ? (
                  <><UserCheck size={14} /> Aceptar</>
                ) : (
                  <><UserPlus size={14} /> Añadir</>
                )}
              </button>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-white">@{profile.username}</h1>
              <LevelBadge level={levelProgress.level} size="sm" />
            </div>
            {profile.full_name && (
              <p className="text-gray-400 text-sm">{profile.full_name}</p>
            )}
          </div>

          {/* XP bar */}
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap size={13} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-300">
                  Nivel {levelProgress.level}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {levelProgress.xpInLevel} / {levelProgress.xpNeeded} XP
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all"
                style={{ width: `${levelProgress.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-card border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-crown" />
            <span className="text-xs text-gray-500 font-medium">Puntos totales</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.matchPoints}</p>
        </div>
        <div className="bg-surface-card border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} className="text-field-light" />
            <span className="text-xs text-gray-500 font-medium">Predicciones</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.totalPredictions}</p>
          {stats.calculatedPredictions > 0 && (
            <p className="text-xs text-gray-600 mt-0.5">{stats.calculatedPredictions} calculadas</p>
          )}
        </div>
        <div className="bg-surface-card border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check size={14} className="text-green-400" />
            <span className="text-xs text-gray-500 font-medium">Ganadores acertados</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.winnerHits}</p>
        </div>
        <div className="bg-surface-card border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-indigo-400" />
            <span className="text-xs text-gray-500 font-medium">Amigos</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.friendsCount}</p>
        </div>
      </div>

      {/* Podio */}
      {podio?.champion && (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={15} className="text-crown" />
            <p className="text-sm font-bold text-white">Podio Mundial</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">🥇</span>
              <span className="text-white font-medium text-sm">{podio.champion}</span>
            </div>
            {podio.runner_up && (
              <div className="flex items-center gap-3">
                <span className="text-xl">🥈</span>
                <span className="text-gray-300 text-sm">{podio.runner_up}</span>
              </div>
            )}
            {podio.third_place && (
              <div className="flex items-center gap-3">
                <span className="text-xl">🥉</span>
                <span className="text-gray-400 text-sm">{podio.third_place}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
