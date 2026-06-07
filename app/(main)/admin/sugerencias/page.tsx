import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MessageSquare, User } from 'lucide-react';

const SUPERADMIN_EMAIL = 'andrescabreroamieva@gmail.com';

type SuggestionRow = {
  id: string;
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
    .select('id, message, created_at, profiles(username, avatar_url)')
    .order('created_at', { ascending: false });

  const rows = (suggestions ?? []) as SuggestionRow[];

  return (
    <div className="animate-fade-in max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
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
            <div key={s.id} className="bg-surface-card border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-field/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {s.profiles?.avatar_url ? (
                    <img src={s.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={12} className="text-gray-400" />
                  )}
                </div>
                <span className="text-xs font-medium text-gray-400">@{s.profiles?.username ?? 'desconocido'}</span>
                <span className="text-xs text-gray-600 ml-auto">
                  {new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
