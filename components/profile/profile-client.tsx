'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Target, Trophy, Zap, ChevronRight, CheckCircle, Edit3, X, Camera, Loader2, Plus, Trash2, ImageIcon, Share2, Copy, Check, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

interface ProfileClientProps {
  profile: Profile | null;
  stats: {
    totalPredictions: number;
    calculatedPredictions: number;
    matchPoints: number;
    correctWinners: number;
  };
  email: string;
}

function getLevel(points: number) {
  if (points >= 500) return { label: 'Leyenda', color: 'text-crown', bg: 'bg-crown/20', icon: '👑' };
  if (points >= 300) return { label: 'Experto', color: 'text-purple-400', bg: 'bg-purple-400/20', icon: '⚡' };
  if (points >= 150) return { label: 'Pro', color: 'text-blue-400', bg: 'bg-blue-400/20', icon: '🎯' };
  if (points >= 50) return { label: 'Amateur', color: 'text-field-light', bg: 'bg-field/20', icon: '⚽' };
  return { label: 'Novato', color: 'text-gray-400', bg: 'bg-gray-400/20', icon: '🌱' };
}

function cropAndResizeImage(file: File, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

export function ProfileClient({ profile, stats, email }: ProfileClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const supabase = createClient();
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??';
  const level = getLevel(stats.matchPoints);

  const accuracy = stats.calculatedPredictions > 0
    ? Math.round((stats.correctWinners / stats.calculatedPredictions) * 100)
    : 0;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setAvatarError('');
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Máx 5 MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const blob = await cropAndResizeImage(file, 256);
      const path = `${profile.id}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithBust } as { avatar_url: string })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithBust);
      await fetch('/api/profile/revalidate', { method: 'POST' });
      router.refresh();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Error subiendo imagen');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveAvatar() {
    if (!profile) return;
    setRemovingAvatar(true);
    setAvatarError('');
    try {
      await supabase.storage.from('avatars').remove([`${profile.id}.jpg`]);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null } as { avatar_url: null })
        .eq('id', profile.id);
      if (error) throw error;
      setAvatarUrl(null);
      await fetch('/api/profile/revalidate', { method: 'POST' });
      router.refresh();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Error eliminando foto');
    } finally {
      setRemovingAvatar(false);
    }
  }

  async function handleShare() {
    const shareData = {
      title: 'VARkings',
      text: '¡Juega conmigo en VARkings! Predice los partidos del Mundial 2026 y compite con amigos 🏆⚽',
      url: window.location.origin,
    };
    if (typeof navigator.share === 'function') {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.origin);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2500);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    if (!currentPassword) { setPasswordError('Introduce tu contraseña actual'); return; }
    if (newPassword.length < 6) { setPasswordError('Mínimo 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Las contraseñas no coinciden'); return; }
    setPasswordSaving(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      setPasswordSaving(false);
      setPasswordError('Contraseña actual incorrecta');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) { setPasswordError(error.message); return; }
    setPasswordSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordForm(false);
    setTimeout(() => setPasswordSaved(false), 3000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setDeleteError('');
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error ?? 'Error al eliminar cuenta');
      setDeletingAccount(false);
      return;
    }
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (username.length < 3) { setError('Mínimo 3 caracteres'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Solo letras, números y _'); return; }

    setSaving(true);
    const { error: saveError } = await supabase
      .from('profiles')
      .update({ username: username.toLowerCase(), full_name: fullName } as { username: string; full_name: string })
      .eq('id', profile!.id);

    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setSaved(true);
    setEditing(false);
    await fetch('/api/profile/revalidate', { method: 'POST' });
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="animate-fade-in max-w-lg mx-auto">

      {/* Hero banner */}
      <div className="relative h-32 field-gradient overflow-hidden">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="absolute top-3 right-1/3 w-16 h-16 rounded-full bg-crown/10" />
        <div className="absolute bottom-2 left-1/4 w-8 h-8 rounded-full bg-white/5" />
      </div>

      <div className="px-4">

        {/* Avatar row */}
        <div className="flex items-end justify-between -mt-12 mb-4">
          <div className="relative">
            {/* Avatar */}
            <button
              onClick={() => setShowAvatarMenu((v) => !v)}
              disabled={uploadingAvatar || removingAvatar}
              className="relative w-24 h-24 rounded-full border-4 border-surface overflow-hidden shadow-xl shadow-black/50 group block"
              aria-label="Cambiar foto de perfil"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile?.username ?? ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-field to-field-dark flex items-center justify-center text-2xl font-black text-white">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                {uploadingAvatar || removingAvatar
                  ? <Loader2 size={20} className="text-white animate-spin" />
                  : <Camera size={20} className="text-white" />
                }
              </div>
            </button>

            {/* + button at bottom-right */}
            <button
              onClick={() => setShowAvatarMenu((v) => !v)}
              disabled={uploadingAvatar || removingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-field border-2 border-surface flex items-center justify-center hover:bg-field-muted transition-colors shadow-md"
              aria-label="Opciones de foto"
            >
              {uploadingAvatar || removingAvatar
                ? <Loader2 size={12} className="text-white animate-spin" />
                : <Plus size={13} className="text-white" strokeWidth={2.5} />
              }
            </button>

            {/* Avatar menu */}
            {showAvatarMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAvatarMenu(false)} />
                <div className="absolute left-0 top-full mt-2 z-20 bg-surface-card border border-white/10 rounded-xl shadow-xl w-44 py-1 overflow-hidden">
                  <button
                    onClick={() => { cameraInputRef.current?.click(); setShowAvatarMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2.5"
                  >
                    <Camera size={14} className="text-gray-400" />
                    Hacer foto
                  </button>
                  <button
                    onClick={() => { fileInputRef.current?.click(); setShowAvatarMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2.5"
                  >
                    <ImageIcon size={14} className="text-gray-400" />
                    Cargar foto
                  </button>
                  {avatarUrl && (
                    <>
                      <div className="border-t border-white/10 mt-1 pt-1" />
                      <button
                        onClick={() => { handleRemoveAvatar(); setShowAvatarMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2.5"
                      >
                        <Trash2 size={14} />
                        Eliminar foto
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 text-sm text-gray-300 hover:border-field/50 hover:text-white transition-all bg-surface-card mt-2"
            >
              <Edit3 size={13} />
              Editar
            </button>
          )}
        </div>

        {avatarError && (
          <p className="text-red-400 text-xs mb-2 -mt-2">{avatarError}</p>
        )}

        {/* Identity */}
        {editing ? (
          <form onSubmit={handleSave} className="space-y-3 mb-6 bg-surface-card border border-white/10 rounded-2xl p-4">
            <p className="text-sm font-semibold text-white mb-1">Editar perfil</p>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Nombre de usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-field text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Opcional"
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-field text-sm placeholder-gray-600"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm flex items-center justify-center gap-1.5 hover:border-white/20 transition-colors"
              >
                <X size={13} />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-field text-white text-sm font-semibold disabled:opacity-50 hover:bg-field-muted transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white">@{profile?.username}</h1>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${level.bg} ${level.color}`}>
                {level.label}
              </span>
              {saved && (
                <span className="flex items-center gap-1 text-field-light text-xs">
                  <CheckCircle size={12} />
                  Guardado
                </span>
              )}
            </div>
            {profile?.full_name && (
              <p className="text-gray-300 text-sm mt-0.5">{profile.full_name}</p>
            )}
            <p className="text-gray-500 text-xs mt-0.5">{email}</p>
          </div>
        )}

        {/* Stats grid */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Estadísticas</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-crown/15 flex items-center justify-center">
                <Trophy size={15} className="text-crown" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Puntos</span>
            </div>
            <div className="text-3xl font-black text-crown tabular-nums">{stats.matchPoints}</div>
          </div>

          <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-field/20 flex items-center justify-center">
                <Target size={15} className="text-field-light" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Predicciones</span>
            </div>
            <div className="text-3xl font-black text-field-light tabular-nums">{stats.totalPredictions}</div>
          </div>

          <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <CheckCircle size={15} className="text-blue-400" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Aciertos</span>
            </div>
            <div className="text-3xl font-black text-blue-400 tabular-nums">{stats.correctWinners}</div>
          </div>

          <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
                <Zap size={15} className="text-purple-400" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Precisión</span>
            </div>
            <div className="text-3xl font-black text-purple-400 tabular-nums">{accuracy}%</div>
          </div>
        </div>

        {/* Precision bar */}
        {stats.calculatedPredictions > 0 && (
          <div className="bg-surface-card border border-white/8 rounded-2xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-xs text-gray-400 font-medium">Aciertos totales</span>
              <span className="text-xs font-bold text-white">{stats.correctWinners} / {stats.calculatedPredictions}</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-field to-field-light rounded-full transition-all duration-700"
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-gray-600">0%</span>
              <span className="text-xs font-semibold text-field-light">{accuracy}% precisión</span>
              <span className="text-xs text-gray-600">100%</span>
            </div>
          </div>
        )}

        {/* Share app */}
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-field/20 text-field-light hover:bg-field/8 transition-colors group mb-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-field/15 flex items-center justify-center group-hover:bg-field/25 transition-colors">
              {shareStatus === 'copied' ? <Check size={15} className="text-field-light" /> : <Share2 size={15} className="text-field-light" />}
            </div>
            <span className="font-medium text-sm">
              {shareStatus === 'copied' ? 'Enlace copiado' : 'Compartir app'}
            </span>
          </div>
          {shareStatus === 'idle' && <ChevronRight size={16} className="text-field/40" />}
        </button>

        {/* Change password */}
        {!showPasswordForm ? (
          <button
            onClick={() => { setShowPasswordForm(true); setPasswordError(''); setPasswordSaved(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/8 transition-colors group mb-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/15 flex items-center justify-center group-hover:bg-yellow-500/25 transition-colors">
                <Lock size={15} className="text-yellow-400" />
              </div>
              <span className="font-medium text-sm">
                {passwordSaved ? (
                  <span className="flex items-center gap-1 text-field-light"><CheckCircle size={13} /> Contraseña cambiada</span>
                ) : 'Cambiar contraseña'}
              </span>
            </div>
            <ChevronRight size={16} className="text-yellow-500/40" />
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="bg-surface-card border border-white/10 rounded-2xl p-4 mb-3 animate-slide-up space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-white">Cambiar contraseña</p>
              <button type="button" onClick={() => { setShowPasswordForm(false); setPasswordError(''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X size={15} />
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Contraseña actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-field text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-field text-sm"
                minLength={6}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Confirmar contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-field text-sm"
                minLength={6}
              />
            </div>
            {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setPasswordError(''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm flex items-center justify-center gap-1.5 hover:border-white/20 transition-colors"
              >
                <X size={13} />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={passwordSaving}
                className="flex-1 py-2.5 rounded-xl bg-field text-white text-sm font-semibold disabled:opacity-50 hover:bg-field-muted transition-colors"
              >
                {passwordSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-red-500/20 text-red-400 hover:bg-red-500/8 transition-colors group mb-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center group-hover:bg-red-500/25 transition-colors">
              <LogOut size={15} />
            </div>
            <span className="font-medium text-sm">Cerrar sesión</span>
          </div>
          <ChevronRight size={16} className="text-red-500/40" />
        </button>

        {/* Delete account */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-white/5 text-gray-600 hover:border-red-500/20 hover:text-red-400 transition-all group mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-red-500/15 transition-colors">
                <Trash2 size={15} />
              </div>
              <span className="font-medium text-sm">Eliminar cuenta</span>
            </div>
          </button>
        ) : (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-4 animate-slide-up">
            <p className="text-white font-semibold mb-1">¿Eliminar tu cuenta?</p>
            <p className="text-gray-400 text-sm mb-4">Se borrarán todos tus datos, predicciones y grupos. Esta acción no se puede deshacer.</p>
            {deleteError && <p className="text-red-400 text-xs mb-3">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                disabled={deletingAccount}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {deletingAccount ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
