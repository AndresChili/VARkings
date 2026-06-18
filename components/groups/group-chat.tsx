'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Send, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { isValidAvatarUrl } from '@/lib/avatar';
import type { LeaderboardEntry } from '@/types';

interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null } | null;
}

interface GroupChatProps {
  groupId: string;
  userId: string;
  leaderboard: LeaderboardEntry[];
  onNewMessage?: () => void;
  hidden?: boolean;
}

function getProfile(
  userId: string,
  leaderboard: LeaderboardEntry[],
  profileFromMsg?: { username: string; avatar_url: string | null } | null
) {
  if (profileFromMsg) return profileFromMsg;
  const entry = leaderboard.find((e) => e.user_id === userId);
  return entry
    ? { username: entry.username, avatar_url: entry.avatar_url }
    : { username: 'Usuario', avatar_url: null };
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function GroupChat({ groupId, userId, leaderboard, onNewMessage, hidden }: GroupChatProps) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/groups/${groupId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
      setLoading(false);
    }
    load();
  }, [groupId]);

  useEffect(() => {
    if (!loading) scrollToBottom('instant');
  }, [loading, scrollToBottom]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => scrollToBottom(), 50);
          if (msg.user_id !== userId) onNewMessage?.();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, supabase, scrollToBottom]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      group_id: groupId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(), 50);

    const res = await fetch(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setSending(false);

    if (!res.ok) {
      // Rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
    } else {
      const saved: ChatMessage = await res.json();
      // Replace temp with real (Realtime may also arrive — dedup handles it)
      setMessages((prev) => prev.map((m) => m.id === tempId ? saved : m));
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Group messages by calendar date for separators
  const grouped: Array<{ date: string; msgs: ChatMessage[] }> = [];
  for (const msg of messages) {
    const date = new Date(msg.created_at).toDateString();
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== date) {
      grouped.push({ date, msgs: [msg] });
    } else {
      last.msgs.push(msg);
    }
  }

  if (loading) {
    return (
      <div className={cn('bg-surface-card border border-white/10 rounded-2xl flex items-center justify-center', hidden && 'hidden')} style={{ height: '480px' }}>
        <div className="w-5 h-5 border-2 border-field/30 border-t-field rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={cn('bg-surface-card border border-white/10 rounded-2xl overflow-hidden flex flex-col', hidden && 'hidden')}
      style={{ height: '480px' }}
    >
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <MessageCircle size={32} className="text-gray-700" />
            <p className="text-gray-500 text-sm">Sé el primero en escribir algo</p>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[11px] text-gray-600 font-medium shrink-0">
                {formatDateLabel(msgs[0].created_at)}
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="space-y-1">
              {msgs.map((msg, idx) => {
                const isMe = msg.user_id === userId;
                const profile = getProfile(msg.user_id, leaderboard, msg.profiles);
                const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                const isFirstInRun = !prevMsg || prevMsg.user_id !== msg.user_id;

                return (
                  <div
                    key={msg.id}
                    className={cn('flex gap-2 items-end', isMe ? 'flex-row-reverse' : 'flex-row')}
                  >
                    {/* Avatar (other users only) */}
                    {!isMe && (
                      <div className="w-7 shrink-0 self-end mb-0.5">
                        {isFirstInRun ? (
                          isValidAvatarUrl(profile.avatar_url) ? (
                            <Image
                              src={profile.avatar_url!}
                              alt={profile.username}
                              width={28}
                              height={28}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-surface-hover flex items-center justify-center text-[10px] font-bold text-gray-400">
                              {profile.username.slice(0, 2).toUpperCase()}
                            </div>
                          )
                        ) : null}
                      </div>
                    )}

                    <div className={cn('flex flex-col max-w-[72%]', isMe ? 'items-end' : 'items-start')}>
                      {!isMe && isFirstInRun && (
                        <span className="text-[11px] text-gray-500 ml-1 mb-0.5">{profile.username}</span>
                      )}
                      <div
                        className={cn(
                          'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
                          isMe
                            ? 'bg-field text-white rounded-br-sm'
                            : 'bg-surface-hover text-white rounded-bl-sm'
                        )}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-gray-700 mt-0.5 mx-1">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-white/5 p-3 flex gap-2 items-end shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          maxLength={500}
          className="flex-1 bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-field/50 transition-colors text-sm resize-none leading-relaxed"
          style={{ maxHeight: '96px' }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-xl bg-field text-white flex items-center justify-center hover:bg-field-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
