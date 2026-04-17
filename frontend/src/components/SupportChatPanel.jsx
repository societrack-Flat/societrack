import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Headphones, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { mergeMessagesById, markSupportThreadRead } from '../lib/supportChat';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '+91 8142112121';
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@societrack.com';

function labelForMessage(msg, currentUserId) {
  if (msg.sender_id === currentUserId) return 'You';
  if (msg.sender_role === 'super_admin') return 'Societrack Support';
  return 'Society admin';
}

function normalizeMessage(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    sender_id: row.sender_id,
    sender_role: row.sender_role,
  };
}

export default function SupportChatPanel({
  variant = 'admin',
  apartmentId,
  onApartmentChange,
  apartmentOptions = [],
  /** Fixed height to align with dashboard chart column; internal message list scrolls */
  dashboardCompact = false,
}) {
  const { userProfile } = useAuth();
  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showSupportInfo, setShowSupportInfo] = useState(false);
  const scrollRef = useRef(null);
  const supportPopoverRef = useRef(null);
  const broadcastRef = useRef(null);
  /** If false, user scrolled up to read history — do not jump to bottom on poll/new messages */
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    if (!showSupportInfo) return undefined;
    const close = (ev) => {
      if (supportPopoverRef.current && !supportPopoverRef.current.contains(ev.target)) {
        setShowSupportInfo(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showSupportInfo]);

  const scrollToBottomIfStuck = useCallback((smooth) => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    const targetTop = el.scrollHeight;
    if (smooth) {
      el.scrollTo({ top: targetTop, behavior: 'smooth' });
    } else {
      el.scrollTop = targetTop;
    }
  }, []);

  const onMessagesScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = gap < 100;
  }, []);

  /** New apartment/thread: start pinned to latest messages */
  useEffect(() => {
    stickToBottomRef.current = true;
  }, [apartmentId]);

  const loadMessages = useCallback(async (tid) => {
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, body, created_at, sender_id, sender_role')
      .eq('thread_id', tid)
      .order('created_at', { ascending: true })
      .limit(300);
    if (error) throw error;
    setMessages((prev) => mergeMessagesById(prev, data || []));
  }, []);

  const ensureThread = useCallback(async (aptId) => {
    if (!aptId) return null;
    const { data: existing, error: e1 } = await supabase
      .from('support_threads')
      .select('id')
      .eq('apartment_id', aptId)
      .maybeSingle();
    if (e1) throw e1;
    if (existing?.id) return existing.id;
    const { data: created, error: e2 } = await supabase
      .from('support_threads')
      .insert({ apartment_id: aptId })
      .select('id')
      .single();
    if (e2) throw e2;
    return created.id;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apartmentId || !userProfile?.id) {
        setLoading(false);
        setThreadId(null);
        setMessages([]);
        return;
      }
      try {
        setLoading(true);
        const tid = await ensureThread(apartmentId);
        if (cancelled || !tid) return;
        setThreadId(tid);
        const { data, error } = await supabase
          .from('support_messages')
          .select('id, body, created_at, sender_id, sender_role')
          .eq('thread_id', tid)
          .order('created_at', { ascending: true })
          .limit(300);
        if (error) throw error;
        if (!cancelled) setMessages(data || []);
      } catch (e) {
        console.error(e);
        toast.error(e?.message || 'Could not load support chat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apartmentId, userProfile?.id, ensureThread]);

  /** Supabase Broadcast: instant delivery without relying on Postgres Realtime replication */
  useEffect(() => {
    if (!threadId) return undefined;
    const ch = supabase.channel(`support-broadcast-${threadId}`, {
      config: { broadcast: { self: true } },
    });
    ch.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      const row = normalizeMessage(payload?.record);
      if (!row) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
    }).subscribe();
    broadcastRef.current = ch;
    return () => {
      broadcastRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [threadId]);

  /** Postgres changes (when Realtime is enabled on the table) */
  useEffect(() => {
    if (!threadId) return undefined;
    const channel = supabase
      .channel(`support-pg-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = normalizeMessage(payload.new);
          if (!row) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  /** Polling fallback so messages appear even if Realtime/Broadcast miss */
  useEffect(() => {
    if (!threadId) return undefined;
    const id = setInterval(() => {
      loadMessages(threadId).catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [threadId, loadMessages]);

  /** Only auto-scroll when the user is already at the bottom (or initial load). Reading history upward stays put. */
  useEffect(() => {
    if (loading) return;
    const id = requestAnimationFrame(() => {
      scrollToBottomIfStuck(false);
    });
    return () => cancelAnimationFrame(id);
  }, [messages, loading, scrollToBottomIfStuck]);

  /** Mark read when thread opens + while chat is open (clears bell for new messages) */
  useEffect(() => {
    if (!threadId || loading) return undefined;
    markSupportThreadRead(threadId).catch(() => {});
    const id = setInterval(() => {
      markSupportThreadRead(threadId).catch(() => {});
    }, 6000);
    return () => clearInterval(id);
  }, [threadId, loading]);

  useEffect(() => {
    if (!threadId || loading) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        markSupportThreadRead(threadId).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [threadId, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !threadId || !userProfile?.id) return;
    if (text.length > 8000) {
      toast.error('Message is too long');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          thread_id: threadId,
          sender_id: userProfile.id,
          body: text,
        })
        .select('id, body, created_at, sender_id, sender_role')
        .single();
      if (error) throw error;
      if (data) {
        stickToBottomRef.current = true;
        setMessages((prev) => mergeMessagesById(prev, [data]));
        broadcastRef.current?.send({
          type: 'broadcast',
          event: 'new_message',
          payload: { record: data },
        });
        markSupportThreadRead(threadId).catch(() => {});
      }
      setInput('');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const isSuper = variant === 'superadmin';

  const shellClassName = [
    'bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 overflow-hidden',
    dashboardCompact
      ? 'h-full min-h-[360px] lg:min-h-0'
      : 'h-[min(440px,75vh)] max-h-[520px]',
  ].join(' ');

  return (
    <div className={shellClassName}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">
            {isSuper ? 'Support inbox' : 'Chat with superadmin'}
          </h3>
          <p className="text-[11px] text-gray-500 truncate">
            {isSuper ? 'Message society admins (per apartment)' : 'Societrack platform support'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 relative" ref={supportPopoverRef}>
          <button
            type="button"
            onClick={() => setShowSupportInfo((o) => !o)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            title="Support contact"
            aria-label="Support contact"
          >
            <Headphones size={18} />
          </button>
          {showSupportInfo && (
            <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-xs text-gray-700">
              <p className="font-semibold text-gray-900 mb-2">Contact</p>
              <p className="text-gray-600">
                <span className="text-gray-500">Phone:</span> {SUPPORT_PHONE}
              </p>
              <p className="text-gray-600 mt-1 break-all">
                <span className="text-gray-500">Email:</span> {SUPPORT_EMAIL}
              </p>
              <button
                type="button"
                className="mt-2 text-blue-600 hover:underline"
                onClick={() => setShowSupportInfo(false)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {isSuper && Array.isArray(apartmentOptions) && apartmentOptions.length > 0 && typeof onApartmentChange === 'function' && (
        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
          <label className="text-[11px] text-gray-500 block mb-1">Society admin</label>
          <select
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            value={apartmentId || ''}
            onChange={(e) => onApartmentChange(e.target.value)}
          >
            {apartmentOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onMessagesScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth px-3 py-2 space-y-2 bg-slate-50/80"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : !apartmentId ? (
          <p className="text-sm text-gray-500 text-center py-8">Select an apartment to chat.</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userProfile?.id;
            const label = labelForMessage(m, userProfile?.id);
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    mine
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                  }`}
                >
                  <p className="text-[10px] opacity-80 mb-0.5">{label}</p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${mine ? 'text-emerald-100' : 'text-gray-400'}`}>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="p-2 border-t border-gray-100 flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={!threadId || sending}
          className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          maxLength={8000}
        />
        <button
          type="submit"
          disabled={!threadId || sending || !input.trim()}
          className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
