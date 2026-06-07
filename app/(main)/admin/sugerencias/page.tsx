import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, User, ChevronLeft } from 'lucide-react';

const SUPERADMIN_EMAIL = 'andrescabreroamieva@gmail.com';

type SuggestionRow = {
  id: string;
  subject: string;
  message: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
};

export default async function SugerenciasAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== SUPERADMIN_EMAIL) {
    redirect('/profile');
  }

  const admin = createAdminClient();
  const { data: suggestions } = await admin
    .from('suggestions')
    .select('id, subject, message, created_at, profiles(username, avatar_url)')
    .order('created_at', { ascending: false });

  const rows = (suggestions ?? []) as SuggestionRow[];

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
          <p className="text-xs text-gray-500">{rows.length} mensaje{rows.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          Todavía no hay sugerencias.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <details key={s.id} className="bg-surface-card border border-white/10 rounded-2xl overflow-hidden group">
              <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none select-none">
                <div className="w-6 h-6 rounded-full bg-field/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {s.profiles?.avatar_url ? (
                    <img src={s.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={12} className="text-gray-400" />
                  )}
                </div>
                <span className="text-xs font-medium text-gray-400 flex-shrink-0">@{s.profiles?.username ?? 'desconocido'}</span>
                <span className="text-sm text-white font-medium truncate flex-1 min-w-0">{s.subject}</span>
                <span className="text-xs text-gray-600 flex-shrink-0">
                  {new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>
                <ChevronLeft size={14} className="text-gray-600 flex-shrink-0 -rotate-90 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 pt-1 border-t border-white/5">
                <p className="text-sm text-gray-200 whitespace-pre-wrap break-words overflow-hidden">{s.message}</p>
                <p className="text-xs text-gray-600 mt-2">
                  {new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
