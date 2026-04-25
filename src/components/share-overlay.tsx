"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Send, Check, Link2, MoreHorizontal } from "lucide-react";
import { messages as messagesApi, auth as authApi, type Conversation, type UserProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface Props {
  /** The text to send — a post URL or @username */
  sharePayload: string;
  /** Human-readable label for header (e.g. "post" or "profile") */
  kind: "post" | "profile";
  /** Preview component shown at top of overlay */
  preview: React.ReactNode;
  onClose: () => void;
}

function Avatar({ name, b64 }: { name: string; b64?: string | null }) {
  return (
    <div className="h-10 w-10 rounded-full bg-neutral-900 text-white text-[13px] font-medium grid place-items-center overflow-hidden flex-shrink-0">
      {b64
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={b64} alt={name} className="h-full w-full object-cover" />
        : name[0]?.toUpperCase()}
    </div>
  );
}

export default function ShareOverlay({ sharePayload, kind, preview, onClose }: Props) {
  const { user } = useAuth();
  const [query, setQuery]                 = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [sending, setSending]             = useState(false);
  const [sent, setSent]                   = useState<Set<string>>(new Set());
  const [linkCopied, setLinkCopied]       = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) messagesApi.conversations().then(setConversations).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [user]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => {
      authApi.searchUsers(query.trim())
        .then((r) => setSearchResults(r.filter((u) => u.id !== user?.id)))
        .catch(() => {});
    }, 250);
  }, [query, user?.id]);

  function toggle(key: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(key)) { n.delete(key); } else { n.add(key); } return n; });
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    const newSent = new Set<string>();

    await Promise.allSettled(
      Array.from(selected).map(async (key) => {
        try {
          if (key.startsWith("conv-")) {
            await messagesApi.send(parseInt(key.slice(5), 10), sharePayload);
          } else {
            const userId  = parseInt(key.slice(5), 10);
            const existing = conversations.find((c) => c.participant.id === userId);
            if (existing) await messagesApi.send(existing.id, sharePayload);
            else await messagesApi.sendRequest(userId, sharePayload);
          }
          newSent.add(key);
        } catch { /* ignore individual failures */ }
      })
    );

    setSent(newSent);
    setSending(false);
    setTimeout(onClose, 1000);
  }

  function copyLink() {
    // For posts: sharePayload IS the URL. For profiles: build URL from @username.
    const url = kind === "post" ? sharePayload : `${window.location.origin}/${sharePayload.replace(/^@/, "")}`;
    navigator.clipboard?.writeText(url).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); });
  }

  const showSearch = query.trim().length >= 2;
  const displayConvs = showSearch ? [] : conversations;
  const displayUsers = showSearch ? searchResults : [];

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ paddingBottom: "var(--share-nav-offset, 0px)" }}>
      <style>{".share-sheet-root { padding-bottom: 80px; } @media (min-width: 640px) { .share-sheet-root { padding-bottom: 0; } }"}</style>
      <div className="share-sheet-root bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(76dvh, calc(100dvh - 90px))" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-100">
          <h2 className="text-[15px] font-semibold">Share {kind}</h2>
          <button onClick={onClose} className="h-7 w-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Preview */}
        <div className="mx-4 my-3">{preview}</div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 px-4 pb-3 border-b border-neutral-100">
          <button onClick={copyLink}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[13px] font-medium transition-all ${linkCopied ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>
            {linkCopied ? <Check size={13} /> : <Link2 size={13} />}
            {linkCopied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={() => navigator.share?.({ url: kind === "post" ? sharePayload : `${window.location.origin}/${sharePayload.replace(/^@/,"")}` }).catch(() => {})}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[13px] font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors">
            <MoreHorizontal size={13} />
            More options
          </button>
        </div>

        {/* DM section */}
        {user && (
          <>
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2">
                <Search size={13} className="text-neutral-400 flex-shrink-0" />
                <input ref={inputRef} type="text" placeholder="Search people…" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
              {displayConvs.length === 0 && displayUsers.length === 0 && (
                <p className="text-center py-6 text-[13px] text-neutral-400">
                  {showSearch ? "No users found" : "No conversations yet"}
                </p>
              )}
              {[...displayConvs.map(c => ({ key: `conv-${c.id}`, name: c.participant.full_name, sub: `@${c.participant.username ?? ""}`, b64: c.participant.avatar_base64 })),
                ...displayUsers.map(u => ({ key: `user-${u.id}`, name: u.full_name, sub: `@${u.username ?? ""}`, b64: u.avatar_base64 }))
              ].map(({ key, name, sub, b64 }) => {
                const isSel = selected.has(key);
                const isDone = sent.has(key);
                return (
                  <button key={key} onClick={() => toggle(key)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-neutral-50 transition-colors">
                    <Avatar name={name} b64={b64} />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[13.5px] font-medium text-neutral-900 truncate">{name}</p>
                      <p className="text-[12px] text-neutral-400">{sub}</p>
                    </div>
                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${isDone ? "bg-green-500 border-green-500" : isSel ? "bg-neutral-900 border-neutral-900" : "border-neutral-300"}`}>
                      {(isSel || isDone) && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-4 pb-5 pt-2 border-t border-neutral-100">
              <button onClick={handleSend} disabled={selected.size === 0 || sending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-900 text-white text-[13.5px] font-medium disabled:opacity-30 hover:bg-neutral-700 active:scale-[.98] transition-all">
                {sending
                  ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : sent.size > 0
                    ? <><Check size={14} /> Sent!</>
                    : <><Send size={14} /> Send{selected.size > 0 ? ` (${selected.size})` : ""}</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
