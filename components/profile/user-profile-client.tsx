'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Target, Trophy, Zap, UserPlus, Check, UserCheck, Loader2, CheckCircle } from 'lucide-react';
import { LevelBadge } from '@/components/ui/level-badge';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/lib/achievements';

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
    winnerHits: number;
    exactHits: number;
    teamGoalHits: number;
    groupTeamsCorrect: number;
    podioExactHits: number;
    podioAnyHits: number;
  };
  completedAchievements: Achievement[];
  currentUserId: string | null;
  targetUserId: string;
  initialFriendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

const CAT_COLORS = {
  predicciones: { bg: 'from-blue-500/30 via-cyan-500/20 to-blue-700/10',       border: 'border-blue-500/35',   icon: 'bg-blue-500/20',   badge: 'bg-blue-500/20 text-blue-200 border-blue-400/30'    },
  social:       { bg: 'from-pink-500/30 via-rose-500/20 to-pink-700/10',        border: 'border-pink-500/35',   icon: 'bg-pink-500/20',   badge: 'bg-pink-500/20 text-pink-200 border-pink-400/30'    },
  grupos:       { bg: 'from-field/40 via-field-dark/25 to-field/10',            border: 'border-field/40',      icon: 'bg-field/25',      badge: 'bg-field/25 text-field-light border-field/35'       },
  puntos:       { bg: 'from-amber-500/30 via-yellow-500/20 to-amber-700/10',    border: 'border-amber-500/35',  icon: 'bg-amber-500/20',  badge: 'bg-amber-500/20 text-amber-200 border-amber-400/30'  },
  perfil:       { bg: 'from-purple-500/30 via-violet-500/20 to-purple-700/10',  border: 'border-purple-500/35', icon: 'bg-purple-500/20', badge: 'bg-purple-500/20 text-purple-200 border-purple-400/30' },
  rachas:       { bg: 'from-orange-500/30 via-red-500/20 to-orange-700/10',     border: 'border-orange-500/35', icon: 'bg-orange-500/20', badge: 'bg-orange-500/20 text-orange-200 border-orange-400/30' },
} as const;

function AchievementCard({ a }: { a: Achievement }) {
  const c = CAT_COLORS[a.category];
  return (
    <div className={`relative bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-4 overflow-hidden`}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl ${c.icon} flex items-center justify-center text-2xl shrink-0`}>
          {a.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <p className="font-bold text-white text-xs leading-snug">{a.title}</p>
            <CheckCircle size={14} className="text-white/70 shrink-0 mt-0.5" />
          </div>
          <p className="text-[10px] text-white/50 leading-snug">{a.description}</p>
          <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.badge}`}>
            ✓ Conseguido
          </span>
        </div>
      </div>
    </div>
  );
}

export function UserProfileClient({
  profile,
  levelProgress,
  stats,
  completedAchievements,
  currentUserId,
  targetUserId,
  initialFriendshipStatus,
}: UserProfileClientProps) {
  const router = useRouter();
  const [friendStatus, setFriendStatus] = useState(initialFriendshipStatus);
  const [loading, setLoading] = useState(false);

  const initials = profile.username.slice(0, 2).toUpperCase();

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
      .select('id')
      .eq('requester_id', targetUserId)
      .eq('addressee_id', currentUserId)
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
          payload: { friendship: { id: existing.id, status: 'accepted' } },
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

  const statRows = [
    { icon: <Trophy size={14} className="text-crown" />,       label: 'Puntos totales',        value: stats.matchPoints,       color: 'text-crown'      },
    { icon: <Target size={14} className="text-field-light" />, label: 'Ganador o empate',      value: stats.winnerHits,        color: 'text-field-light'},
    { icon: <CheckCircle size={14} className="text-blue-400" />, label: 'Resultado exacto',    value: stats.exactHits,         color: 'text-blue-400'   },
    { icon: <Zap size={14} className="text-yellow-400" />,     label: 'Goles de equipo',       value: stats.teamGoalHits,      color: 'text-yellow-400' },
    { icon: <Target size={14} className="text-orange-400" />,  label: 'Fase de grupos',        value: stats.groupTeamsCorrect, color: 'text-orange-400' },
    { icon: <Trophy size={14} className="text-crown" />,       label: 'Podio acertado exacto', value: stats.podioExactHits,    color: 'text-crown'      },
    { icon: <Trophy size={14} className="text-purple-400" />,  label: 'Podio acertado',        value: stats.podioAnyHits,      color: 'text-purple-400' },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-fade-in pb-10">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      {/* Profile hero card */}
      <div className="relative bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-field-dark/60 via-field/20 to-crown/10 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
          <div className="absolute -bottom-12 -left-6 w-28 h-28 rounded-full bg-white/5" />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-surface-card bg-surface-hover flex items-center justify-center text-xl font-black text-gray-300 shrink-0">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.username} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {currentUserId && (
              <button
                onClick={friendStatus === 'pending_received' ? acceptRequest : sendRequest}
                disabled={loading || friendStatus === 'accepted' || friendStatus === 'pending_sent'}
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
                <Zap size={12} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-300">Nivel {levelProgress.level}</span>
              </div>
              <span className="text-xs text-gray-500 tabular-nums">
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
      <div className="bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estadísticas</p>
        </div>
        <div className="divide-y divide-white/5">
          {statRows.map((row, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-5 flex items-center justify-center shrink-0">{row.icon}</div>
              <span className="flex-1 text-sm text-gray-300">{row.label}</span>
              <span className={cn('text-sm font-bold tabular-nums', row.color)}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Completed achievements */}
      {completedAchievements.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Logros conseguidos</p>
            <span className="text-xs text-gray-600 tabular-nums">{completedAchievements.length} desbloqueados</span>
          </div>
          <div className="space-y-2.5">
            {completedAchievements.map((a) => (
              <AchievementCard key={a.id} a={a} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center bg-surface-card border border-white/8 rounded-2xl">
          <span className="text-3xl opacity-30">🏆</span>
          <p className="text-gray-600 text-sm">Aún no tiene logros desbloqueados</p>
        </div>
      )}
    </div>
  );
}
