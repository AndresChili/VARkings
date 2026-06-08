'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { UserPlus, Check, Clock, Users, ArrowLeft, Loader2, LogIn } from 'lucide-react';
import { isValidAvatarUrl } from '@/lib/avatar';

interface Profile {
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
}

interface Props {
  currentUserId: string | null;
  target: Profile;
  existingFriendship: Friendship | null;
}

export function AddFriendClient({ currentUserId, target, existingFriendship: initial }: Props) {
  const router = useRouter();

  const [friendship, setFriendship] = useState<Friendship | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const initials = target.username.slice(0, 2).toUpperCase();

  async function sendRequest() {
    if (!currentUserId) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressee_id: target.id }),
    });
    setLoading(false);
    if (!res.ok) { setError('No se pudo enviar la solicitud'); return; }
    const data = await res.json();
    setFriendship(data as Friendship);
  }

  async function cancelRequest() {
    if (!friendship) return;
    setLoading(true);
    await fetch('/api/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendship_id: friendship.id }),
    });
    setLoading(false);
    setFriendship(null);
  }

  const isSelf = false;
  const isSent = friendship?.requester_id === currentUserId && friendship?.status === 'pending';
  const isReceived = friendship?.addressee_id === currentUserId && friendship?.status === 'pending';
  const isAccepted = friendship?.status === 'accepted';

  return (
    <div className="animate-fade-in max-w-lg mx-auto px-4 py-6">

      <button
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push(currentUserId ? '/friends' : '/login');
        }}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors text-sm mb-8"
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      {/* Profile card */}
      <div className="bg-surface-card border border-white/8 rounded-3xl p-8 flex flex-col items-center text-center gap-4">

        {/* Avatar */}
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-field to-field-dark flex items-center justify-center font-black text-white text-2xl shadow-xl relative">
          {isValidAvatarUrl(target.avatar_url)
            ? <Image src={target.avatar_url!} alt={target.username} fill className="object-cover" />
            : initials
          }
        </div>

        <div>
          <h1 className="text-2xl font-black text-white">@{target.username}</h1>
          {target.full_name && (
            <p className="text-gray-400 text-sm mt-0.5">{target.full_name}</p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Not logged in */}
        {!currentUserId && (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-gray-400 text-sm">Inicia sesión para añadir a @{target.username} como amigo</p>
            <button
              onClick={() => router.push(`/login?next=/add/${target.id}`)}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-field text-white font-semibold hover:bg-field-muted transition-colors text-sm w-full justify-center"
            >
              <LogIn size={16} />
              Iniciar sesión
            </button>
          </div>
        )}

        {/* Logged in states */}
        {currentUserId && isAccepted && (
          <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-field/15 text-field-light font-semibold text-sm">
            <Users size={16} />
            Ya sois amigos
          </div>
        )}

        {currentUserId && isReceived && (
          <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-surface border border-white/10 text-gray-400 text-sm">
            <Clock size={16} />
            Te ha enviado una solicitud — revisa Amigos
          </div>
        )}

        {currentUserId && isSent && (
          <button
            onClick={cancelRequest}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-white/15 text-gray-400 text-sm hover:border-red-400/30 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
            Solicitud enviada · Cancelar
          </button>
        )}

        {currentUserId && !friendship && (
          <button
            onClick={sendRequest}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-field text-white font-semibold hover:bg-field-muted transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Añadir amigo
          </button>
        )}

      </div>
    </div>
  );
}
