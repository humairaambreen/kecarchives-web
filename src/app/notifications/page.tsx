"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, CheckCheck, ChevronRight, Heart,
  MessageCircle, Search, Trash2, UserPlus, X,
} from "lucide-react";
import { notifications as notifApi, type Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// Module-level cache — survives navigation within the SPA session
let _notifCache: Notification[] | null = null;

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function iconForType(type: string) {
  if (type === "like" || type === "reaction")
    return { icon: <Heart size={13} fill="currentColor" strokeWidth={0} />, bg: "#fef2f2", color: "#ef4444" };
  if (type === "comment" || type === "comment_reply" || type === "mention")
    return { icon: <MessageCircle size={13} />, bg: "#f0f9ff", color: "#0ea5e9" };
  if (type === "message" || type === "dm_request" || type === "request_accepted")
    return { icon: <MessageCircle size={13} fill="currentColor" strokeWidth={0} />, bg: "#f5f0ff", color: "#8b5cf6" };
  if (type === "request" || type === "follow")
    return { icon: <UserPlus size={13} />, bg: "#f0fdf4", color: "#22c55e" };
  return { icon: <Bell size={13} />, bg: "#fafafa", color: "#737373" };
}

function NotificationItem({ n, onRead, onRemove, onClick }: {
  n: Notification;
  onRead: (id: number) => void;
  onRemove: (id: number) => void;
  onClick: (n: Notification) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const { icon, bg, color } = iconForType(n.type);

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    swiping.current = true;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!swiping.current || !ref.current) return;
    currentX.current = e.touches[0].clientX;
    const offset = Math.min(0, Math.max(-80, currentX.current - startX.current));
    ref.current.style.transform = `translateX(${offset}px)`;
  }
  function handleTouchEnd() {
    if (!ref.current) return;
    const dx = currentX.current - startX.current;
    ref.current.style.transform = dx < -50 ? "translateX(-72px)" : "translateX(0)";
    swiping.current = false;
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl">
      {/* Delete action revealed on swipe (mobile only) */}
      <div className="md:hidden absolute right-0 top-0 bottom-0 w-[72px] flex items-center justify-center bg-red-500 rounded-r-2xl">
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(n.id); }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Trash2 size={15} />
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </div>

      {/* Card */}
      <div
        ref={ref}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (!n.read) onRead(n.id); onClick(n); }}
        className="relative flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 bg-white hover:bg-neutral-50 transition-all"
        style={{
          transition: "transform 0.15s ease-out, background 0.15s",
          borderColor: !n.read ? "#e5e5e5" : "#f5f5f5",
          backgroundColor: !n.read ? "#fafafa" : "#fff",
        }}
      >
        {/* Unread dot (mobile) / desktop delete button (desktop) */}
        {!n.read && (
          <div className="md:hidden absolute top-3.5 right-3.5 h-1.5 w-1.5 rounded-full bg-neutral-900" />
        )}
        {/* Desktop delete button — always present, visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(n.id); }}
          className="hidden md:flex absolute top-3 right-3 h-6 w-6 items-center justify-center rounded-full text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete notification"
        >
          <Trash2 size={13} />
        </button>

        {/* Icon */}
        <div
          className="h-8 w-8 shrink-0 rounded-xl grid place-items-center mt-0.5"
          style={{ background: bg, color }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 pr-4">
          <p className="text-[13.5px] font-semibold text-neutral-900 leading-snug">{n.title}</p>
          <p className="mt-0.5 text-[12.5px] text-neutral-500 line-clamp-2 leading-relaxed">{n.body}</p>
          <p className="mt-1.5 text-[11px] text-neutral-300">{formatTimestamp(n.created_at)}</p>
        </div>

        {n.target_url && (
          <ChevronRight size={13} className="mt-1 text-neutral-300 shrink-0 self-center" />
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>(_notifCache ?? []);
  const [loading, setLoading] = useState(_notifCache === null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    notifApi.list().then((data) => {
      _notifCache = data;
      setItems(data);
    }).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  function markRead(id: number) {
    setItems((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      _notifCache = next;
      return next;
    });
    notifApi.markRead(id).catch(() => {});
  }

  function markAllRead() {
    setItems((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      _notifCache = next;
      return next;
    });
    notifApi.markAllRead().catch(() => {});
  }

  async function removeNotification(id: number) {
    setItems((prev) => {
      const next = prev.filter((n) => n.id !== id);
      _notifCache = next;
      return next;
    });
    try { await notifApi.remove(id); } catch { /* */ }
  }

  function handleClick(n: Notification) {
    if (n.target_url) router.push(n.target_url);
  }

  const unreadCount = items.filter((n) => !n.read).length;
  const filtered = search.trim()
    ? items.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.body.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[13px] text-neutral-400">Sign in to view notifications</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .notif-root { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.22s ease forwards; }
        .search-input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #e5e5e5;
          padding: 10px 14px 10px 40px;
          font-size: 13px;
          font-family: inherit;
          background: #fafafa;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          color: #171717;
        }
        .search-input:focus {
          border-color: #a3a3a3;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
        }
        .search-input::placeholder { color: #a3a3a3; }
      `}</style>

      <div className="notif-root pb-24 fade-up space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-neutral-950 leading-tight">Notifications</h1>
            <p className="text-[13px] text-neutral-400 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors mt-1 rounded-full border border-neutral-200 px-3 py-1.5"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-100" />

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            className="search-input"
            placeholder="Search notifications…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="grid place-items-center py-20">
            <div className="h-4 w-4 border-[1.5px] border-neutral-200 border-t-neutral-700 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-2">
            <Bell size={24} className="text-neutral-200" />
            <p className="text-[13px] font-medium text-neutral-400 mt-1">
              {search ? "No matching notifications" : "No notifications yet"}
            </p>
            <p className="text-[12px] text-neutral-300">
              {search ? "Try a different search term" : "Updates will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Unread group */}
            {filtered.some((n) => !n.read) && (
              <div>
                <p className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase mb-2 px-1">Unread</p>
                <div className="space-y-1.5">
                  {filtered.filter((n) => !n.read).map((n) => (
                    <NotificationItem key={n.id} n={n} onRead={markRead} onRemove={removeNotification} onClick={handleClick} />
                  ))}
                </div>
              </div>
            )}

            {/* Read group */}
            {filtered.some((n) => n.read) && (
              <div className={filtered.some((n) => !n.read) ? "mt-5" : ""}>
                {filtered.some((n) => !n.read) && (
                  <p className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase mb-2 px-1">Earlier</p>
                )}
                <div className="space-y-1.5">
                  {filtered.filter((n) => n.read).map((n) => (
                    <NotificationItem key={n.id} n={n} onRead={markRead} onRemove={removeNotification} onClick={handleClick} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}