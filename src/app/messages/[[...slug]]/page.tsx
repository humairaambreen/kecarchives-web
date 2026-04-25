"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowDown,
  ChevronDown,
  Users,
  Settings,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  FileText,
  MessageCircle,
  Mic,
  MicOff,
  Paperclip,
  Pause,
  Phone,
  PhoneOff,
  Play,
  Search,
  Send,
  Share2,
  X,
  Copy,
  Reply,
  Trash2,
  Pencil,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  auth,
  messages as messagesApi,
  type Conversation,
  type Message,
  type MessageRequest,
  type UserProfile,
} from "@/lib/api";
import { SharedPostCard, SharedProfileCard } from "@/components/shared-cards";
import { isPostUrl, isProfileMention, sharePreview } from "@/lib/msg-share-cache";
import { useAuth } from "@/lib/auth-context";
import { groups as groupsApi, type GroupOut, type GroupMember, type GroupMessage as GMsg } from "@/lib/api";
import CreateGroupModal from "@/components/create-group-modal";
import { setGroupCache } from "@/lib/group-cache";

/* ─── helpers ─────────────────────────────────────────────── */

function parseDate(iso: string): Date {
  const d = new Date(iso);
  if (!isNaN(d.getTime())) return d;
  return new Date(iso + "Z");
}

function formatTime(iso: string): string {
  return parseDate(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatShort(iso: string): string {
  const d = parseDate(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0)
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateSep(iso: string): string {
  const d = parseDate(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type?: string | null): boolean {
  return !!type && type.startsWith("image/");
}

function isAudioType(type?: string | null): boolean {
  return !!type && (type.startsWith("audio/") || type === "video/webm");
}

function isVideoType(type?: string | null): boolean {
  return !!type && type.startsWith("video/") && type !== "video/webm";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Download a file from a URL preserving the original filename */
async function downloadFileWithName(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
}

/* ─── Media preview modal ────────────────────────────────── */

interface PreviewMedia {
  type: "image" | "video";
  src: string;
  name: string;
}

function MediaPreviewModal({ media, onClose }: { media: PreviewMedia; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (media.type === "image") {
        if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
        if (e.key === "-") setZoom((z) => { const nz = Math.max(z - 0.25, 1); if (nz === 1) setPos({ x: 0, y: 0 }); return nz; });
        if (e.key === "0") { setZoom(1); setPos({ x: 0, y: 0 }); }
      }
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, media.type]);

  function handleWheel(e: React.WheelEvent) {
    if (media.type !== "image") return;
    e.preventDefault();
    setZoom((z) => {
      const nz = Math.max(1, Math.min(5, z - e.deltaY * 0.002));
      if (nz === 1) setPos({ x: 0, y: 0 });
      return nz;
    });
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (media.type !== "image" || zoom <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setPos({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  }

  function handlePointerUp() {
    setDragging(false);
  }

  function handleDoubleClick() {
    if (media.type !== "image") return;
    if (zoom > 1) { setZoom(1); setPos({ x: 0, y: 0 }); }
    else setZoom(2.5);
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black animate-in fade-in duration-200">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <X size={20} className="text-white" />
        </button>
        <p className="text-white/80 text-sm font-medium truncate max-w-[50%]">{media.name}</p>
        <button
          onClick={() => downloadFileWithName(media.src, media.name)}
          className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
          aria-label="Download"
        >
          <Download size={20} className="text-white" />
        </button>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
        onClick={(e) => { if (e.target === containerRef.current) onClose(); }}
        onWheel={handleWheel}
      >
        {media.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.src}
            alt={media.name}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
              transition: dragging ? "none" : "transform 0.2s ease",
              cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
            }}
            draggable={false}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
          />
        ) : (
          <video
            src={media.src}
            controls
            autoPlay
            className="max-w-full max-h-full object-contain"
            style={{ maxWidth: "100vw", maxHeight: "100vh" }}
            controlsList="nodownload"
          />
        )}
      </div>

      {/* Bottom controls for images */}
      {media.type === "image" && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 py-4 bg-gradient-to-t from-black/70 to-transparent">
          <button
            onClick={() => { setZoom((z) => { const nz = Math.max(z - 0.5, 1); if (nz === 1) setPos({ x: 0, y: 0 }); return nz; }); }}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white disabled:opacity-30"
            disabled={zoom <= 1}
            aria-label="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-white/60 text-xs tabular-nums min-w-[3rem] text-center font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.5, 5))}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white disabled:opacity-30"
            disabled={zoom >= 5}
            aria-label="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          {zoom > 1 && (
            <button
              onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }}
              className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white text-xs font-medium"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Forward picker modal ───────────────────────────────── */

function ForwardPickerModal({
  conversations,
  currentConversationId,
  onSelect,
  onClose,
}: {
  conversations: { id: number; participant: { id: number; full_name: string; username?: string | null; avatar_base64?: string | null } }[];
  currentConversationId: number;
  onSelect: (conversationId: number) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = conversations.filter(
    (c) =>
      c.id !== currentConversationId &&
      (c.participant.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.participant.username || "").toLowerCase().includes(search.toLowerCase())),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Forward to</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No conversations found</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <Avatar name={c.participant.full_name} src={c.participant.avatar_base64} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.participant.full_name}</p>
                  {c.participant.username && (
                    <p className="text-xs text-gray-400 truncate">@{c.participant.username}</p>
                  )}
                </div>
                <Share2 size={16} className="text-gray-300 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Avatar ──────────────────────────────────────────────── */

function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full bg-neutral-900 text-white grid place-items-center"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="font-semibold select-none">{(name || "?")[0].toUpperCase()}</span>
      )}
    </div>
  );
}

/* ─── Typing dots ─────────────────────────────────────────── */

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.6s" }}
        />
      ))}
    </span>
  );
}

/* ─── Voice note player ──────────────────────────────────── */

function VoiceNotePlayer({ src, mine }: { src: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const animRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !playing) return;
    if (audio.duration && isFinite(audio.duration)) {
      setProgress(audio.currentTime / audio.duration);
      setDuration(audio.duration);
    }
    animRef.current = requestAnimationFrame(updateProgress);
  }, [playing]);

  useEffect(() => {
    if (playing) {
      animRef.current = requestAnimationFrame(updateProgress);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, updateProgress]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  function handleEnded() {
    setPlaying(false);
    setProgress(0);
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !isFinite(audio.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  }

  function formatDur(s: number) {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const bars = 32;

  return (
    <div className="flex items-center gap-3 py-1.5 px-1 min-w-[220px] max-w-[280px]">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" onEnded={handleEnded} onLoadedMetadata={handleLoadedMetadata} />

      {/* Play/Pause button */}
      <button
        onClick={toggle}
        className={`w-10 h-10 rounded-full grid place-items-center shrink-0 transition-all active:scale-90 ${
          mine
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-neutral-900/10 hover:bg-neutral-900/15 text-neutral-700"
        }`}
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-[1px]" />}
      </button>

      {/* Waveform + duration */}
      <div className="flex-1 flex flex-col gap-1.5">
        {/* Clickable waveform */}
        <div className="flex items-end gap-[2px] h-6 cursor-pointer" onClick={handleSeek}>
          {Array.from({ length: bars }).map((_, i) => {
            const filled = progress > i / bars;
            const seed = (Math.sin(i * 2.1 + 5) * 0.5 + 0.5) * 0.7 + 0.3;
            const h = Math.round(6 + seed * 18);
            return (
              <div
                key={i}
                className={`w-[2.5px] rounded-full transition-colors duration-75 ${
                  filled
                    ? mine ? "bg-white" : "bg-neutral-800"
                    : mine ? "bg-white/20" : "bg-neutral-300"
                }`}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
        <span className={`text-[10px] tabular-nums leading-none ${mine ? "text-white/50" : "text-gray-400"}`}>
          {playing ? formatDur(audioRef.current?.currentTime || 0) : formatDur(duration)}
        </span>
      </div>
    </div>
  );
}

/* ─── Message bubble ──────────────────────────────────────── */

interface BubbleProps {
  msg: Message;
  mine: boolean;
  showAvatar: boolean;
  isLastMine: boolean;
  isSeen: boolean;
  partnerName: string;
  partnerAvatar?: string | null;
  userId: number;
  allMessages: Message[];
  onReply: (m: Message) => void;
  onContextMenu: (m: Message, x: number, y: number) => void;
  onScrollToMsg: (id: number) => void;
  onPreview: (media: PreviewMedia) => void;
  // Group-specific props
  isGroup?: boolean;
  senderName?: string;
  senderAvatar?: string | null;
  showSenderInfo?: boolean;
  canDelete?: boolean;
}

function MessageBubble({
  msg,
  mine,
  showAvatar,
  isLastMine,
  isSeen,
  partnerName,
  partnerAvatar,
  allMessages,
  onReply,
  onContextMenu,
  onScrollToMsg,
  onPreview,
  isGroup,
  senderName,
  senderAvatar,
  showSenderInfo,
}: BubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef(0);
  const swipeCurrent = useRef(0);
  const swipeStartY = useRef(0);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const lastLongPressAt = useRef(0);
  const swipeLocked = useRef(false);
  const isDeleted = msg.is_deleted;
  const fileName = msg.file_name || "file";
  const fileSize = msg.file_size || 0;
  const fileType = msg.file_type || "application/octet-stream";
  // Cloudinary URLs are absolute; legacy local URLs start with /
  const fileHref = msg.file_url
    ? msg.file_url.startsWith("http") ? msg.file_url : `${API_URL}${msg.file_url}`
    : null;
  const hasFile = !!fileHref;
  const isImage = isImageType(fileType);
  const isAudio = isAudioType(fileType);
  const isVoiceNote = isAudio && (fileName.toLowerCase().includes("voice") || msg.content === "Voice message");
  const isVideo = isVideoType(fileType);

  // Find the replied-to message
  const repliedMsg = msg.reply_to_id ? allMessages.find((m) => m.id === msg.reply_to_id) : null;

  // Legacy quote support (> prefix)
  const hasLegacyQuote = !isDeleted && !msg.reply_to_id && msg.content.startsWith("> ");
  const mainContent = hasLegacyQuote
    ? msg.content.split("\n").slice(1).join("\n")
    : msg.content;
  const legacyQuote = hasLegacyQuote ? msg.content.split("\n")[0].slice(2) : "";

  function handleTouchStart(e: React.TouchEvent) {
    if (isDeleted) return;
    isLongPress.current = false;
    swipeLocked.current = false;
    swipeStart.current = e.touches[0].clientX;
    swipeCurrent.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    longPressRef.current = setTimeout(() => {
      isLongPress.current = true;
      lastLongPressAt.current = Date.now();
      if (navigator.vibrate) navigator.vibrate(20);
      onContextMenu(msg, touchX, touchY);
    }, 500);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (isDeleted) return;
    if (isLongPress.current) {
      e.preventDefault();
      return;
    }
    const dx = e.touches[0].clientX - swipeStart.current;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
    // Cancel long-press if finger moves significantly
    if ((Math.abs(dx) > 8 || dy > 8) && longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    // Lock into horizontal swipe mode once threshold met
    if (!swipeLocked.current && Math.abs(dx) > 12 && Math.abs(dx) > dy) {
      swipeLocked.current = true;
    }
    if (!swipeLocked.current) return;
    swipeCurrent.current = e.touches[0].clientX;
    const el = bubbleRef.current;
    if (!el) return;
    // Only allow right swipe for reply
    const offset = Math.max(0, Math.min(70, dx));
    el.style.transform = `translateX(${offset}px)`;
    el.style.transition = "none";
    el.style.opacity = offset > 30 ? "0.8" : "1";
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => { isLongPress.current = false; }, 100);
      return;
    }
    const el = bubbleRef.current;
    if (!el) return;
    const dx = swipeCurrent.current - swipeStart.current;
    el.style.transform = "";
    el.style.transition = "transform 0.2s ease, opacity 0.2s ease";
    el.style.opacity = "1";
    if (dx > 50 && !isDeleted && swipeLocked.current) {
      onReply(msg);
    }
    isLongPress.current = false;
    swipeLocked.current = false;
  }

  function handleRightClick(e: React.MouseEvent) {
    e.preventDefault();
    // Ignore contextmenu events fired by the browser as a side-effect of our
    // custom touch long-press — prevents double-open / instant-close on Android.
    if (Date.now() - lastLongPressAt.current < 800) return;
    if (!isDeleted) onContextMenu(msg, e.clientX, e.clientY);
  }

  return (
    <div
      ref={bubbleRef}
      data-msg-id={msg.id}
      className={`flex items-end gap-1.5 mb-0.5 ${mine ? "justify-end" : "justify-start"}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleRightClick}
      style={{ touchAction: "pan-y", WebkitTouchCallout: "none", userSelect: "none" }}
    >
      {/* Partner avatar */}
      {!mine && (
        <div className="w-7 shrink-0">
          {showAvatar && <Avatar name={(isGroup && senderName) ? senderName : partnerName} src={(isGroup && senderAvatar !== undefined) ? senderAvatar : partnerAvatar} size={28} />}
        </div>
      )}

      <div
        className={`max-w-[72%] relative ${
          isDeleted
            ? "rounded-2xl bg-gray-50 border border-gray-200 px-3 py-2"
            : mine
              ? "rounded-2xl rounded-br-md bg-neutral-900 text-white px-3.5 py-2"
              : "rounded-2xl rounded-bl-md bg-gray-100 text-gray-900 px-3.5 py-2"
        }`}
      >
        {/* Group sender name */}
        {isGroup && !mine && showSenderInfo && (
          <p className="text-[10px] font-semibold text-violet-600 mb-0.5 -mt-0.5">{senderName}</p>
        )}

        {/* Reply reference */}
        {repliedMsg && (
          <button
            onClick={() => onScrollToMsg(repliedMsg.id)}
            className={`w-full text-left text-[11px] mb-1 pb-1 border-b ${
              mine ? "border-white/15 text-white/50 hover:text-white/70" : "border-gray-300 text-gray-400 hover:text-gray-600"
            } transition-colors`}
          >
            <Reply size={10} className="inline mr-1 opacity-60" />
            {repliedMsg.is_deleted
              ? "Deleted message"
              : repliedMsg.content.slice(0, 60)}
          </button>
        )}

        {/* Legacy quote */}
        {legacyQuote && (
          <div
            className={`text-[11px] mb-1 pb-1 border-b ${
              mine ? "border-white/15 text-white/50" : "border-gray-300 text-gray-400"
            }`}
          >
            <Reply size={10} className="inline mr-1 opacity-60" />
            {legacyQuote}
          </div>
        )}

        {/* File attachment */}
        {hasFile && !isDeleted && (
          <div className="mb-1">
            {isVoiceNote ? (
              /* Voice note player */
              <VoiceNotePlayer src={fileHref || ""} mine={mine} />
            ) : isAudio ? (
              /* Audio file (non-voice) */
              <div className={`rounded-xl p-2.5 ${mine ? "bg-white/10" : "bg-gray-200/60"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${mine ? "bg-white/15" : "bg-neutral-100"}`}>
                    <Mic size={14} className={mine ? "text-white/70" : "text-gray-500"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${mine ? "text-white/90" : "text-gray-700"}`}>
                      {fileName}
                    </p>
                    {fileSize > 0 && (
                      <p className={`text-[10px] ${mine ? "text-white/40" : "text-gray-400"}`}>
                        {formatFileSize(fileSize)}
                      </p>
                    )}
                  </div>
                  <button onClick={() => downloadFileWithName(fileHref!, fileName)} className="p-1 rounded-full hover:bg-black/5 transition-colors">
                    <Download size={14} className={mine ? "text-white/50" : "text-gray-400"} />
                  </button>
                </div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={fileHref || ""} controls className="w-full h-8 [&::-webkit-media-controls-panel]:bg-transparent" style={{ maxWidth: "100%" }} />
              </div>
            ) : isImage ? (
              /* Image — click for fullscreen preview */
              <button
                onClick={() => onPreview({ type: "image", src: fileHref!, name: fileName })}
                className="block cursor-pointer rounded-xl overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileHref || ""}
                  alt={fileName}
                  className="rounded-xl max-w-full max-h-60 object-contain hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              </button>
            ) : isVideo ? (
              /* Video — thumbnail, click for fullscreen preview */
              <button
                onClick={() => onPreview({ type: "video", src: fileHref!, name: fileName })}
                className="block cursor-pointer rounded-xl overflow-hidden relative group"
              >
                <video
                  src={fileHref || ""}
                  className="rounded-xl max-w-full max-h-60 pointer-events-none"
                  preload="metadata"
                  muted
                />
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-white/90 grid place-items-center shadow-lg">
                    <Play size={22} fill="black" className="text-black translate-x-[1px]" />
                  </div>
                </div>
              </button>
            ) : (
              /* Generic file — download with original name */
              <div
                className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
                  mine ? "bg-white/10 hover:bg-white/15" : "bg-gray-100 hover:bg-gray-200/80"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${
                  mine ? "bg-white/15" : "bg-gray-200"
                }`}>
                  <FileText size={18} className={mine ? "text-white/70" : "text-gray-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium truncate ${mine ? "text-white/90" : "text-gray-700"}`}>
                    {fileName}
                  </p>
                  <p className={`text-[10px] ${mine ? "text-white/40" : "text-gray-400"}`}>
                    {fileSize > 0 ? formatFileSize(fileSize) : fileType.split("/")[1]?.toUpperCase() || "FILE"}
                    {fileSize > 0 && ` · ${fileType.split("/")[1]?.toUpperCase() || "FILE"}`}
                  </p>
                </div>
                <button
                  onClick={() => downloadFileWithName(fileHref!, fileName)}
                  className="p-1.5 rounded-full hover:bg-black/5 transition-colors shrink-0"
                  aria-label="Download"
                >
                  <Download size={16} className={`shrink-0 ${mine ? "text-white/40" : "text-gray-400"}`} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Shared card (post or profile) */}
        {!isDeleted && !hasFile && isPostUrl(msg.content) && (
          <SharedPostCard url={msg.content} mine={mine} />
        )}
        {!isDeleted && !hasFile && isProfileMention(msg.content) && (
          <SharedProfileCard username={msg.content} mine={mine} />
        )}

        {/* Content — hide for voice notes, image-only, and shared cards */}
        {(!hasFile || isDeleted || (!isImage && !isVoiceNote && !isVideo)) &&
          !(!isDeleted && (isPostUrl(msg.content) || isProfileMention(msg.content))) && (
          <p className={`text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${isDeleted ? "text-gray-400 italic text-xs" : ""}`}>
            {isDeleted ? "This message was deleted" : (hasFile ? "" : (hasLegacyQuote ? mainContent : msg.content))}
          </p>
        )}

        {/* Metadata row */}
        <div className={`flex items-center gap-1 mt-0.5 ${mine ? "justify-end" : ""}`}>
          <span className={`text-[10px] ${mine ? "text-white/35" : "text-gray-400"}`}>
            {formatTime(msg.created_at)}
          </span>
          {msg.is_edited && !isDeleted && (
            <span className={`text-[10px] ${mine ? "text-white/35" : "text-gray-400"}`}>
              · edited
            </span>
          )}
          {isLastMine && mine && !isDeleted && (
            isSeen ? (
              <CheckCheck size={12} className="text-blue-400 ml-0.5" />
            ) : (
              <Check size={12} className="text-white/30 ml-0.5" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* ─── Cache helpers (localStorage) ───────────────────────── */
/* ═══════════════════════════════════════════════════════════ */

const CACHE_CONVOS   = "kec_convos_v1";
const CACHE_GROUPS   = "kec_groups_v1";
const CACHE_REQUESTS = "kec_requests_v1";
const dmMsgsKey  = (id: number) => `kec_dm_${id}_v1`;
const grpMsgsKey = (id: number) => `kec_grp_${id}_v1`;

function readCache<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T[]) : []; } catch { return []; }
}
function writeCache(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/** Pull the first slug segment from the current URL path at render time */
function getSlugFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/\/messages\/([^/]+)/);
  return m?.[1] ?? null;
}

/* ═══════════════════════════════════════════════════════════ */
/* ─── Main Page ───────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════ */

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slugArr = params.slug as string[] | undefined;
  const chatUsername = slugArr?.[0] || null;

  /* ── state — hydrated from localStorage on first render ── */
  // loading is only true when we have zero cached data (true first-time cold start)
  const [loading, setLoading] = useState<boolean>(() =>
    readCache(CACHE_CONVOS).length === 0 && readCache(CACHE_GROUPS).length === 0
  );
  const [requests, setRequests]       = useState<MessageRequest[]>(() => readCache(CACHE_REQUESTS));
  const [conversations, setConversations] = useState<Conversation[]>(() => readCache(CACHE_CONVOS));
  const [myGroups, setMyGroups]       = useState<GroupOut[]>(() => readCache(CACHE_GROUPS));
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  // Hydrate the active chat immediately from the URL slug + cached data.
  // This means on any return visit the chat view renders on the VERY FIRST frame —
  // the message-list never flashes even for a single render cycle.
  const [activeGroupId, setActiveGroupId] = useState<number | null>(() => {
    const slug = getSlugFromPath();
    if (!slug?.startsWith("group-")) return null;
    const id = parseInt(slug.slice(6), 10);
    return isNaN(id) ? null : id;
  });
  const [activeGroup, setActiveGroup] = useState<GroupOut | null>(() => {
    const slug = getSlugFromPath();
    if (!slug?.startsWith("group-")) return null;
    const id = parseInt(slug.slice(6), 10);
    if (isNaN(id)) return null;
    return (readCache<GroupOut>(CACHE_GROUPS)).find(g => g.id === id) ?? null;
  });
  const [activeConversationId, setActiveConversationId] = useState<number | null>(() => {
    const slug = getSlugFromPath();
    if (!slug || slug.startsWith("group-")) return null;
    const cached = readCache<Conversation>(CACHE_CONVOS);
    return cached.find(c => (c.participant.username ?? "").toLowerCase() === slug.toLowerCase())?.id ?? null;
  });
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupMessages, setGroupMessages] = useState<GMsg[]>(() => {
    const slug = getSlugFromPath();
    if (!slug?.startsWith("group-")) return [];
    const id = parseInt(slug.slice(6), 10);
    return isNaN(id) ? [] : readCache<GMsg>(grpMsgsKey(id));
  });
  const [groupMsgsLoaded, setGroupMsgsLoaded] = useState<boolean>(() => {
    const slug = getSlugFromPath();
    if (!slug?.startsWith("group-")) return false;
    const id = parseInt(slug.slice(6), 10);
    return !isNaN(id) && readCache<GMsg>(grpMsgsKey(id)).length > 0;
  });
  const [groupInput, setGroupInput] = useState("");
  const [, setGroupSending] = useState(false);
  const [groupReplyTo, setGroupReplyTo] = useState<GMsg | null>(null);
  const [groupEditMsg, setGroupEditMsg] = useState<GMsg | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>(() => {
    const slug = getSlugFromPath();
    if (!slug || slug.startsWith("group-")) return [];
    const cached = readCache<Conversation>(CACHE_CONVOS);
    const convoId = cached.find(c => (c.participant.username ?? "").toLowerCase() === slug.toLowerCase())?.id;
    return convoId ? readCache<Message>(dmMsgsKey(convoId)) : [];
  });
  const [dmMsgsLoaded, setDmMsgsLoaded] = useState<boolean>(() => {
    const slug = getSlugFromPath();
    if (!slug || slug.startsWith("group-")) return false;
    const cached = readCache<Conversation>(CACHE_CONVOS);
    const convoId = cached.find(c => (c.participant.username ?? "").toLowerCase() === slug.toLowerCase())?.id;
    return !!convoId && readCache<Message>(dmMsgsKey(convoId)).length > 0;
  });
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [requestTarget, setRequestTarget] = useState<UserProfile | null>(null);
  const [requestText, setRequestText] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerLastRead, setPartnerLastRead] = useState<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchResults, setChatSearchResults] = useState<Message[]>([]);
  const [chatSearchIdx, setChatSearchIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Media preview state
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);

  // Forward state
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);

  // Requests sub-view & delete chat state
  const [showRequestsView, setShowRequestsView] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Conversation | null>(null);
  const [swipedConvoId, setSwipedConvoId] = useState<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const swipeDragRef = useRef<{ el: HTMLElement; startX: number; locked: boolean } | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingCancelledRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Call state
  const [callState, setCallState] = useState<{
    active: boolean;
    callId?: number;
    callType?: string;
    status?: string;
    isCaller?: boolean;
  }>({ active: false });
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const peerRef = useRef<import("peerjs").Peer | null>(null);
  const peerCallRef = useRef<import("peerjs").MediaConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const groupContainerRef = useRef<HTMLDivElement>(null);
  const groupEndRef = useRef<HTMLDivElement>(null);
  const [groupSearchOpen, setGroupSearchOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTypingSent = useRef(0);
  // Compute initial cached message counts once — used to pre-set scroll refs below
  const _initDmCache = (() => {
    const slug = getSlugFromPath();
    if (!slug || slug.startsWith("group-")) return 0;
    const cached = readCache<Conversation>(CACHE_CONVOS);
    const convoId = cached.find(c => (c.participant.username ?? "").toLowerCase() === slug.toLowerCase())?.id;
    return convoId ? readCache<Message>(dmMsgsKey(convoId)).length : 0;
  })();
  const _initGrpCache = (() => {
    const slug = getSlugFromPath();
    if (!slug?.startsWith("group-")) return 0;
    const id = parseInt(slug.slice(6), 10);
    return isNaN(id) ? 0 : readCache<GMsg>(grpMsgsKey(id)).length;
  })();
  // Pre-initialize scroll state from cache so first fetch doesn't re-scroll or re-blink
  const prevMsgCount = useRef(_initDmCache);
  const initialScrollDone = useRef(_initDmCache > 0);
  const prevGroupMsgCount = useRef(_initGrpCache);
  const groupInitialScrollDone = useRef(_initGrpCache > 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevents slug resolver from re-opening a chat we just intentionally closed

  // Poll group messages when in group chat (only when authenticated)
  useEffect(() => {
    if (!activeGroupId || !user) { if (groupPollRef.current) { clearInterval(groupPollRef.current); groupPollRef.current = null; } return; }
    if (groupPollRef.current) clearInterval(groupPollRef.current);

    // Immediate first fetch (covers the URL-hydrated cold-start case)
    const loadGroup = async () => {
      try {
        const [msgs, mems, grp] = await Promise.all([
          groupsApi.messages(activeGroupId) as Promise<GMsg[]>,
          groupsApi.members(activeGroupId),
          activeGroup ? Promise.resolve(activeGroup) : groupsApi.get(activeGroupId),
        ]);
        setGroupMessages(msgs);
        writeCache(grpMsgsKey(activeGroupId), msgs);
        setGroupMembers(mems);
        setGroupMsgsLoaded(true);
        if (!activeGroup || activeGroup.id !== (grp as GroupOut).id) setActiveGroup(grp as GroupOut);
        // Scroll to bottom after first load
        requestAnimationFrame(() => {
          groupEndRef.current?.scrollIntoView({ behavior: "instant" });
        });
      } catch { /**/ }
    };
    loadGroup();

    const pollGroupMessages = async () => {
      try {
        const msgs = await groupsApi.messages(activeGroupId) as GMsg[];
        setGroupMessages(prev => {
          const pending = prev.filter(m => m.id < 0);
          const stillPending = pending.filter(p => {
            const confirmedByServer = msgs.some(s =>
              s.sender_id === p.sender_id &&
              s.content === p.content &&
              Math.abs(new Date(s.created_at).getTime() - new Date(p.created_at).getTime()) < 10000
            );
            return !confirmedByServer;
          });
          const latestServerId = msgs.length > 0 ? Math.max(...msgs.map(m => m.id)) : 0;
          const recentMissed = prev.filter(m => m.id > 0 && m.id > latestServerId);
          if (stillPending.length === 0 && recentMissed.length === 0 && prev.length === msgs.length &&
            prev.every((m, i) => m.id === msgs[i].id && m.content === msgs[i].content)) return prev;
          writeCache(grpMsgsKey(activeGroupId), msgs);
          return [...msgs, ...recentMissed, ...stillPending];
        });
      } catch { /**/ }
    };

    groupPollRef.current = setInterval(pollGroupMessages, 3000);

    const onVisible = () => { if (document.visibilityState === "visible") pollGroupMessages(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (groupPollRef.current) { clearInterval(groupPollRef.current); groupPollRef.current = null; }
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, user]);

  async function handleGroupSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = groupInput.trim();
    if (!text || !activeGroupId || !user) return;
    setGroupInput("");

    if (groupEditMsg) {
      setGroupSending(true);
      const prevContent = groupEditMsg.content;
      const editId = groupEditMsg.id;
      setGroupMessages(prev => prev.map(m => m.id === editId ? { ...m, content: text, is_edited: true } : m));
      setGroupEditMsg(null);
      try {
        const updated = await groupsApi.editMessage(activeGroupId, editId, text);
        setGroupMessages(prev => prev.map(m => m.id === editId ? updated as GMsg : m));
      } catch {
        setGroupMessages(prev => prev.map(m => m.id === editId ? { ...m, content: prevContent, is_edited: false } : m));
        setGroupInput(text);
      } finally {
        setGroupSending(false);
      }
    } else {
      // Optimistic: add temp message immediately — no blocking, allow rapid sends
      const tempId = -Date.now();
      const optimistic: GMsg = {
        id: tempId, group_id: activeGroupId, sender_id: user.id,
        sender_name: user.full_name, sender_username: user.username ?? null,
        sender_avatar: user.avatar_base64 ?? null,
        content: text, is_deleted: false, is_edited: false,
        reply_to_id: groupReplyTo?.id ?? null,
        file_url: null, file_name: null, file_size: null, file_type: null,
        created_at: new Date().toISOString(),
      };
      setGroupMessages(prev => [...prev, optimistic]);
      setGroupReplyTo(null);
      setMyGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, last_message: text, last_message_at: new Date().toISOString() } : g));
      setTimeout(() => groupEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      try {
        const msg = await groupsApi.sendMessage(activeGroupId, text, optimistic.reply_to_id);
        setGroupMessages(prev => {
          const replaced = prev.map(m => m.id === tempId ? msg as GMsg : m);
          const seen = new Set<number>();
          return replaced.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
        });
      } catch {
        setGroupMessages(prev => prev.filter(m => m.id !== tempId));
        setGroupInput(prev => prev ? prev + "\n" + text : text);
      }
    }
  }

  async function handleGroupDelete(msg: GMsg) {
    if (!activeGroupId) return;
    await groupsApi.deleteMessage(activeGroupId, msg.id).catch(() => {});
    setGroupMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_deleted: true, content: "This message was deleted" } : m));
  }

  function openGroupChat(gid: number) {
    // Already open — don't reset anything
    if (activeGroupId === gid) return;
    if (groupPollRef.current) { clearInterval(groupPollRef.current); groupPollRef.current = null; }
    setActiveConversationId(null);
    setActiveGroupId(gid);
    const g = myGroups.find(x => x.id === gid);
    if (g) setActiveGroup(g);
    const cachedGrpMsgs = readCache<GMsg>(grpMsgsKey(gid));
    setGroupMessages(cachedGrpMsgs);
    setGroupMsgsLoaded(cachedGrpMsgs.length > 0);
    setGroupReplyTo(null); setGroupEditMsg(null); setGroupInput(""); setGroupSearchOpen(false); setGroupSearch("");
    groupInitialScrollDone.current = false;
    prevGroupMsgCount.current = 0;
    window.history.replaceState(null,'',`/messages/group-${gid}`);
    Promise.all([groupsApi.messages(gid), groupsApi.members(gid), groupsApi.get(gid)]).then(([msgs, mems, grp]) => {
      setGroupMessages(msgs as GMsg[]);
      writeCache(grpMsgsKey(gid), msgs);
      setGroupMsgsLoaded(true);
      setGroupMembers(mems);
      setActiveGroup(grp);
    }).catch(() => {});
  }

  /* ── derived ── */
  const inChat = activeConversationId !== null;

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId],
  );

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      ),
    [conversations],
  );

  const visibleConversations = useMemo(
    () =>
      sortedConversations.filter(
        (c) =>
          !search ||
          c.participant.full_name.toLowerCase().includes(search.toLowerCase()) ||
          (c.participant.username || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [sortedConversations, search],
  );

  const incomingRequests = useMemo(
    () => requests.filter((r) => r.status === "pending" && r.to_user?.id === user?.id),
    [requests, user],
  );

  const sentRequests = useMemo(
    () => requests.filter((r) => r.status === "pending" && r.from_user?.id === user?.id),
    [requests, user],
  );

  /* ── Hide bottom navbar when in chat (DM or group) ── */
  useEffect(() => {
    const inAnyChat = inChat || !!activeGroupId;
    const navbar = document.querySelector("nav.fixed.inset-x-0.bottom-4") as HTMLElement | null;
    if (!navbar) return;
    if (inAnyChat) {
      navbar.style.display = "none";
    } else {
      navbar.style.display = "";
    }
    return () => {
      navbar.style.display = "";
    };
  }, [inChat, activeGroupId]);

  /* ── Initial fetch ── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [r, c, g] = await Promise.all([messagesApi.requests(), messagesApi.conversations(), groupsApi.list().catch(() => [])]);
        setRequests(r); writeCache(CACHE_REQUESTS, r);
        setConversations(c); writeCache(CACHE_CONVOS, c);
        setMyGroups(g as GroupOut[]); writeCache(CACHE_GROUPS, g);
        // Patch the active group metadata if it was served from cache
        if (activeGroupId) {
          const fresh = (g as GroupOut[]).find(x => x.id === activeGroupId);
          if (fresh) setActiveGroup(fresh);
        }
      } catch {
        /* keep cached data intact */
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── Slug resolver — cold load only (hard refresh / direct URL paste).
     All in-app navigation uses state + window.history directly — no router calls.
     This effect is guarded so it runs at most once per mount. ── */
  const coldLoadDone = useRef(false);
  useEffect(() => {
    if (!chatUsername || !user || coldLoadDone.current) return;
    // Wait until conversations are loaded before resolving
    if (loading && conversations.length === 0) return;
    coldLoadDone.current = true;

    // Group slug
    if (chatUsername.startsWith("group-")) {
      const gid = parseInt(chatUsername.slice(6), 10);
      if (!isNaN(gid) && activeGroupId !== gid) {
        const cachedMsgs = readCache<GMsg>(grpMsgsKey(gid));
        const existing = myGroups.find(g => g.id === gid);
        setActiveGroupId(gid);
        setActiveGroup(existing ?? null);
        setActiveConversationId(null);
        setGroupMessages(cachedMsgs);
        setGroupMsgsLoaded(cachedMsgs.length > 0);
        setGroupMembers([]);
        groupInitialScrollDone.current = false;
        prevGroupMsgCount.current = 0;
      }
      return;
    }

    // DM slug
    const convo = conversations.find(
      (c) => (c.participant.username || "").toLowerCase() === chatUsername.toLowerCase(),
    );
    if (convo) {
      if (activeConversationId !== convo.id) openChatDirect(convo.id);
      return;
    }

    if (loading) return;
    (async () => {
      try {
        const candidates = await auth.searchUsers(chatUsername);
        const exact = candidates.find(
          (u) => (u.username || "").toLowerCase() === chatUsername.toLowerCase(),
        );
        if (exact && exact.id !== user.id) {
          setRequestTarget(exact);
          setShowNewRequest(true);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatUsername, user, loading, conversations]);


  /* ── Poll conversation list every 5s ── */
  useEffect(() => {
    if (!user) return;

    const pollConvos = async () => {
      try {
        const [r, c] = await Promise.all([messagesApi.requests(), messagesApi.conversations()]);
        setConversations(prev => {
          const same = prev.length === c.length &&
            prev.every((p, i) => p.id === c[i].id &&
              p.last_message === c[i].last_message &&
              p.last_message_at === c[i].last_message_at);
          if (same) return prev;
          writeCache(CACHE_CONVOS, c);
          return c;
        });
        setRequests(prev => {
          const same = prev.length === r.length && prev.every((p, i) => p.id === r[i].id && p.status === r[i].status);
          if (same) return prev;
          writeCache(CACHE_REQUESTS, r);
          return r;
        });
      } catch { /* ignore */ }
    };

    pollRef.current = setInterval(pollConvos, 5000);

    // Poll immediately when user returns to the tab (catches up after background)
    const onVisible = () => { if (document.visibilityState === "visible") pollConvos(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  /* ── Poll messages + info every 3s while chat open ── */
  useEffect(() => {
    if (!activeConversationId) {
      if (msgPollRef.current) {
        clearInterval(msgPollRef.current);
        msgPollRef.current = null;
      }
      return;
    }

    const fetchMessages = async () => {
      try {
        const [msgs, info] = await Promise.all([
          messagesApi.getMessages(activeConversationId),
          messagesApi.conversationInfo(activeConversationId),
        ]);
        // Deduplicate by id (guards against race with handleSendMessage)
        const deduped = msgs.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
        setChatMessages((prev) => {
          const pending = prev.filter(m => m.id < 0);
          const stillPending = pending.filter(p => {
            const confirmedByServer = deduped.some(s =>
              s.sender_id === p.sender_id &&
              s.content === p.content &&
              Math.abs(new Date(s.created_at).getTime() - new Date(p.created_at).getTime()) < 10000
            );
            return !confirmedByServer;
          });
          const latestServerId = deduped.length > 0 ? Math.max(...deduped.map(m => m.id)) : 0;
          const recentMissed = prev.filter(m => m.id > 0 && m.id > latestServerId);
          if (
            stillPending.length === 0 && recentMissed.length === 0 &&
            prev.length === deduped.length &&
            prev.every((m, i) => m.id === deduped[i].id && m.content === deduped[i].content)
          )
            return prev;
          writeCache(dmMsgsKey(activeConversationId), deduped);
          return [...deduped, ...recentMissed, ...stillPending];
        });
        setDmMsgsLoaded(true);
        setPartnerTyping(info.partner_is_typing);
        setPartnerLastRead(info.partner_last_read_msg_id);
      } catch {
        /* ignore */
      }
    };

    fetchMessages();
    messagesApi.markRead(activeConversationId).catch(() => {});

    const pollDmMessages = async () => {
      if (!activeConversationId) return;
      try {
        const [msgs, info] = await Promise.all([
          messagesApi.getMessages(activeConversationId),
          messagesApi.conversationInfo(activeConversationId),
        ]);
        const deduped = msgs.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
        setChatMessages((prev) => {
          const pending = prev.filter(m => m.id < 0);
          const stillPending = pending.filter(p => {
            const confirmedByServer = deduped.some(s =>
              s.sender_id === p.sender_id &&
              s.content === p.content &&
              Math.abs(new Date(s.created_at).getTime() - new Date(p.created_at).getTime()) < 10000
            );
            return !confirmedByServer;
          });
          const latestServerId = deduped.length > 0 ? Math.max(...deduped.map(m => m.id)) : 0;
          const recentMissed = prev.filter(m => m.id > 0 && m.id > latestServerId);
          if (
            stillPending.length === 0 && recentMissed.length === 0 &&
            prev.length === deduped.length &&
            prev.every((m, i) => m.id === deduped[i].id && m.content === deduped[i].content)
          ) return prev;
          writeCache(dmMsgsKey(activeConversationId), deduped);
          return [...deduped, ...recentMissed, ...stillPending];
        });
        setPartnerTyping(info.partner_is_typing);
        setPartnerLastRead(info.partner_last_read_msg_id);
        messagesApi.markRead(activeConversationId).catch(() => {});
      } catch { /* ignore */ }
    };

    msgPollRef.current = setInterval(pollDmMessages, 3000);

    // Immediately re-fetch when user switches back to this tab
    const onVisible = () => { if (document.visibilityState === "visible") pollDmMessages(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (msgPollRef.current) clearInterval(msgPollRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeConversationId]);

  /* ── Scroll: open at bottom, then smart-scroll on new msgs ── */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || chatMessages.length === 0) return;

    if (!initialScrollDone.current) {
      // First load: instantly jump to bottom
      container.scrollTop = container.scrollHeight;
      initialScrollDone.current = true;
      prevMsgCount.current = chatMessages.length;
      return;
    }

    if (chatMessages.length > prevMsgCount.current) {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      const isNewFromSelf =
        chatMessages[chatMessages.length - 1].sender_id === user?.id;
      if (isNearBottom || isNewFromSelf) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages, user?.id]);

  /* ── Group scroll: open at bottom, smart-scroll on new msgs ── */
  useEffect(() => {
    const container = groupContainerRef.current;
    if (!container || groupMessages.length === 0) return;

    if (!groupInitialScrollDone.current) {
      // First load: instantly jump to bottom (same as DMs)
      container.scrollTop = container.scrollHeight;
      groupInitialScrollDone.current = true;
      prevGroupMsgCount.current = groupMessages.length;
      return;
    }

    if (groupMessages.length > prevGroupMsgCount.current) {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      const isNewFromSelf =
        groupMessages[groupMessages.length - 1].sender_id === user?.id;
      if (isNearBottom || isNewFromSelf) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
    prevGroupMsgCount.current = groupMessages.length;
  }, [groupMessages, user?.id]);

  /* ── Track scroll position for "scroll to bottom" button ── */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    function onScroll() {
      if (!container) return;
      const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollBtn(dist > 300);
    }
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [inChat, activeConversationId]);

  /* ── Scroll to bottom helper ── */
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, []);

  /* ── Scroll to a specific message ── */
  const scrollToMessage = useCallback((msgId: number) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Flash highlight
    el.style.transition = "background-color 0.3s";
    el.style.backgroundColor = "rgba(59,130,246,0.15)";
    setTimeout(() => {
      el.style.backgroundColor = "";
    }, 1500);
  }, []);

  /* ── Navigation ── */
  function openChatDirect(convoId: number) {
    // Already open — don't reset anything (prevents blink/spinner from slug-resolver re-runs)
    if (activeConversationId === convoId) return;
    if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }
    const cached = readCache<Message>(dmMsgsKey(convoId));
    setChatMessages(cached);
    setDmMsgsLoaded(cached.length > 0);
    setActiveConversationId(convoId);
    setShowNewRequest(false);
    setRequestTarget(null);
    setReplyTo(null);
    setContextMsg(null);
    setEditingMsg(null);
    setChatSearchOpen(false);
    setChatSearch("");
    setChatSearchResults([]);
    prevMsgCount.current = 0;
    initialScrollDone.current = false; // always reset so scroll fires when view mounts
  }

  const openChat = useCallback(
    (convo: Conversation) => {
      if (convo.participant.username) {
          window.history.replaceState(null,'',`/messages/${convo.participant.username}`);
      }
      openChatDirect(convo.id);
    },
    [router],
  );

  const goBack = useCallback(() => {
    setIsClosing(true);
    window.history.replaceState(null,'','/messages');
    setTimeout(() => {
      setIsClosing(false);
      setActiveConversationId(null);
      setActiveGroupId(null);
      setActiveGroup(null);
      setGroupMessages([]);
      setGroupMembers([]);
      setGroupInput("");
      setGroupReplyTo(null);
      setGroupEditMsg(null);
      setShowNewRequest(false);
      setRequestTarget(null);
      setReplyTo(null);
      setContextMsg(null);
      setEditingMsg(null);
      setPartnerTyping(false);
      setPartnerLastRead(null);
      setChatSearchOpen(false);
      setChatSearch("");
      setCallState({ active: false });
      cleanupCall();
      prevMsgCount.current = 0;
      initialScrollDone.current = false;
      groupInitialScrollDone.current = false;
      prevGroupMsgCount.current = 0;
      setDmMsgsLoaded(false);
      setGroupMsgsLoaded(false);
    }, 220);
  }, [router]);

  /* ── Typing indicator ── */
  const sendTypingSignal = useCallback(() => {
    if (!activeConversationId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 3000) return;
    lastTypingSent.current = now;
    messagesApi.typing(activeConversationId).catch(() => {});
  }, [activeConversationId]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNewMessage(e.target.value);
    sendTypingSignal();
  }

  /* ── Request actions ── */
  async function sendRequest() {
    if (!requestTarget || !requestText.trim() || requestSending) return;
    setRequestSending(true);
    try {
      const req = (await messagesApi.sendRequest(requestTarget.id, requestText.trim())) as MessageRequest;
      setRequests((prev) => [req, ...prev]);
      setRequestText("");
      setRequestTarget(null);
      setShowNewRequest(false);
      goBack();
    } catch {
      /* ignore */
    } finally {
      setRequestSending(false);
    }
  }

  async function handleRequestDecision(req: MessageRequest, accept: boolean) {
    try {
      const response = (await messagesApi.respondToRequest(req.id, accept)) as { conversation_id?: number };
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: accept ? "accepted" : "rejected" } : r)),
      );
      if (accept) {
        const latest = await messagesApi.conversations();
        setConversations(latest);
        const convoId = response?.conversation_id ?? latest.find((c) => c.participant.id === req.from_user.id)?.id;
        if (convoId) {
          const convo = latest.find((c) => c.id === convoId);
          if (convo) openChat(convo);
          else openChatDirect(convoId);
        } else {
          goBack();
        }
      }
    } catch {
      /* ignore */
    }
  }

  /* ── Messaging ── */
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = newMessage.trim();
    if (!activeConversationId || !text) return;

    // Optimistic: clear input & show message instantly — no blocking, allow rapid sends
    const tempId = -Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: user!.id,
      content: text,
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_edited: false,
      reply_to_id: replyTo?.id ?? null,
      file_url: null, file_name: null, file_size: null, file_type: null,
    };
    setNewMessage("");
    setReplyTo(null);
    inputRef.current?.focus();
    setChatMessages(prev => [...prev, optimisticMsg]);
    setConversations(prev => prev.map(c =>
      c.id === activeConversationId ? { ...c, last_message: text, last_message_at: optimisticMsg.created_at } : c
    ));
    // Scroll immediately
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });

    try {
      const sent = (await messagesApi.send(activeConversationId, text, optimisticMsg.reply_to_id ?? undefined)) as Message;
      // Replace temp with real; remove any poll-added duplicate of sent.id
      setChatMessages(prev => {
        const withoutDup = prev.filter(m => m.id !== sent.id);
        const hasTempId = withoutDup.some(m => m.id === tempId);
        if (hasTempId) return withoutDup.map(m => m.id === tempId ? sent : m);
        return withoutDup.some(m => m.id === sent.id) ? withoutDup : [...withoutDup, sent];
      });
      setConversations(prev => prev.map(c =>
        c.id === activeConversationId ? { ...c, last_message: sent.content, last_message_at: sent.created_at } : c
      ));
    } catch {
      // Revert on error
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(prev => prev === "" ? text : prev + " " + text);
    }
  }

  async function handleDeleteMessage(msg: Message) {
    if (!activeConversationId) return;
    try {
      await messagesApi.deleteMessage(activeConversationId, msg.id);
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, content: "This message was deleted", is_deleted: true } : m,
        ),
      );
    } catch {
      /* ignore */
    }
    setContextMsg(null);
  }

  async function handleEditMessage() {
    if (!activeConversationId || !editingMsg || !editText.trim()) return;
    try {
      await messagesApi.editMessage(activeConversationId, editingMsg.id, editText.trim());
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === editingMsg.id ? { ...m, content: editText.trim(), is_edited: true } : m,
        ),
      );
    } catch {
      /* ignore */
    }
    setEditingMsg(null);
    setEditText("");
    inputRef.current?.focus();
  }

  /* ── Context menu ── */
  function showContextMenu(msg: Message, x: number, y: number) {
    if (msg.is_deleted) return;
    setContextMsg(msg);
    const menuW = 180;
    const hasFile = !!msg.file_url;
    const isOwn = msg.sender_id === user?.id;
    // Adjust height: no Edit for file msgs
    const menuH = isOwn ? (hasFile ? 170 : 200) : 110;
    setContextPos({
      x: Math.min(x, window.innerWidth - menuW - 12),
      y: Math.min(Math.max(y - 60, 8), window.innerHeight - menuH - 12),
    });
  }

  function copyMessage(msg: Message) {
    navigator.clipboard?.writeText(msg.content);
    setContextMsg(null);
  }

  function startForward(msg: Message) {
    setForwardMsg(msg);
    setContextMsg(null);
  }

  async function handleForward(targetConversationId: number) {
    if (!forwardMsg || !activeConversationId) return;
    try {
      const fwdMsg = await messagesApi.forwardMessage(activeConversationId, forwardMsg.id, targetConversationId);
      // Update target conversation's last_message preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConversationId
            ? { ...c, last_message: fwdMsg.content || "Forwarded", last_message_at: fwdMsg.created_at }
            : c
        )
      );
    } catch {
      /* ignore */
    }
    setForwardMsg(null);
  }

  async function handleDeleteConversation() {
    if (!deleteConfirm) return;
    try {
      await messagesApi.deleteConversation(deleteConfirm.id);
      setConversations((prev) => prev.filter((c) => c.id !== deleteConfirm.id));
      if (activeConversationId === deleteConfirm.id) {
        setActiveConversationId(null);
        setChatMessages([]);
        router.back();
      }
    } catch {
      /* ignore */
    }
    setDeleteConfirm(null);
  }

  /* ── File upload (backend storage) ── */
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!activeConversationId || !user) return;
    if (uploading) return;

    // Capture reply before clearing it
    const replyId = replyTo?.id;
    const localUrl = URL.createObjectURL(file);
    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      content: file.name,
      created_at: new Date().toISOString(),
      reply_to_id: replyId ?? null,
      file_url: localUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
    };
    setChatMessages(prev => [...prev, optimistic]);
    setConversations(prev => prev.map(c =>
      c.id === activeConversationId ? { ...c, last_message: file.name, last_message_at: optimistic.created_at } : c
    ));
    setReplyTo(null);
    setUploading(true);

    try {
      const sent = await messagesApi.uploadFile(activeConversationId, file, replyId) as Message;
      URL.revokeObjectURL(localUrl);
      setChatMessages(prev => {
        const replaced = prev.map(m => m.id === tempId ? sent : m);
        const seen = new Set<number>();
        return replaced.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
      });
      setConversations(prev => prev.map(c =>
        c.id === activeConversationId ? { ...c, last_message: sent.content, last_message_at: sent.created_at } : c
      ));
    } catch {
      URL.revokeObjectURL(localUrl);
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setUploading(false);
    }
  }

  /* ── Voice recording (WhatsApp-style hold to record) ── */
  async function startVoiceRecording() {
    if (isRecording || !activeConversationId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        if (recordingCancelledRef.current || recordedChunksRef.current.length === 0) {
          setIsRecording(false);
          setRecordingDuration(0);
          recordingCancelledRef.current = false;
          return;
        }

        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          // Too short, discard
          setIsRecording(false);
          setRecordingDuration(0);
          return;
        }

        const file = new File([blob], `voice_${Date.now()}.webm`, { type: mimeType });

        setUploading(true);
        setIsRecording(false);
        setRecordingDuration(0);

        // Optimistic voice note — shows waveform/player immediately while uploading
        const replyId = replyTo?.id;
        const localUrl = URL.createObjectURL(blob);
        const tempId = -Date.now();
        const optimistic: Message = {
          id: tempId,
          sender_id: user!.id,
          content: "Voice message",
          created_at: new Date().toISOString(),
          reply_to_id: replyId ?? null,
          file_url: localUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: mimeType,
        };
        setChatMessages(prev => [...prev, optimistic]);
        setConversations(prev => prev.map(c =>
          c.id === activeConversationId ? { ...c, last_message: "Voice message", last_message_at: optimistic.created_at } : c
        ));
        setReplyTo(null);

        try {
          const sent = await messagesApi.uploadFile(activeConversationId!, file, replyId) as Message;
          URL.revokeObjectURL(localUrl);
          setChatMessages(prev => {
            const replaced = prev.map(m => m.id === tempId ? sent : m);
            const seen = new Set<number>();
            return replaced.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
          });
          setConversations(prev => prev.map(c =>
            c.id === activeConversationId ? { ...c, last_message: sent.content, last_message_at: sent.created_at } : c
          ));
        } catch {
          URL.revokeObjectURL(localUrl);
          setChatMessages(prev => prev.filter(m => m.id !== tempId));
        } finally {
          setUploading(false);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingCancelledRef.current = false;
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      /* microphone permission denied */
    }
  }

  function stopVoiceRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function cancelVoiceRecording() {
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
  }

  function toggleRecording() {
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  }

  /* ── Chat search ── */
  async function handleChatSearch(query: string) {
    setChatSearch(query);
    if (!query.trim() || !activeConversationId) {
      setChatSearchResults([]);
      setChatSearchIdx(0);
      return;
    }
    try {
      const results = await messagesApi.searchMessages(activeConversationId, query.trim());
      setChatSearchResults(results);
      setChatSearchIdx(0);
      if (results.length > 0) scrollToMessage(results[0].id);
    } catch {
      setChatSearchResults([]);
    }
  }

  function navigateSearchResult(delta: number) {
    if (chatSearchResults.length === 0) return;
    const next = (chatSearchIdx + delta + chatSearchResults.length) % chatSearchResults.length;
    setChatSearchIdx(next);
    scrollToMessage(chatSearchResults[next].id);
  }

  /* ── PeerJS Calling ── */
  function cleanupCall() {
    if (peerCallRef.current) {
      try { peerCallRef.current.close(); } catch { /* ignore */ }
      peerCallRef.current = null;
    }
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch { /* ignore */ }
      peerRef.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    }
    if (callPollRef.current) {
      clearInterval(callPollRef.current);
      callPollRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setIsMuted(false);
    setCallDuration(0);
  }

  function startCallTimer() {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }

  function toggleMute() {
    if (!localStream.current) return;
    const audioTrack = localStream.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }

  function formatCallDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  async function startCall() {
    if (!activeConversationId) return;
    cleanupCall();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;

      const { Peer } = await import("peerjs");
      const peerId = `kec-${Math.random().toString(36).slice(2, 10)}`;
      const peer = new Peer(peerId);
      peerRef.current = peer;

      const res = await messagesApi.startCall(activeConversationId, peerId);
      setCallState({ active: true, callId: res.call_id, callType: "audio", status: "ringing", isCaller: true });

      // Callee will call into us — we answer when they do
      peer.on("call", (incomingCall) => {
        incomingCall.answer(stream);
        peerCallRef.current = incomingCall;

        incomingCall.on("stream", (remoteStream) => {
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
          setCallState((prev) => ({ ...prev, status: "active" }));
          startCallTimer();
        });

        incomingCall.on("close", () => { cleanupCall(); setCallState({ active: false }); });
        incomingCall.on("error", () => { cleanupCall(); setCallState({ active: false }); });
      });

      // Poll only to detect if the callee declines / call is ended from their side
      callPollRef.current = setInterval(async () => {
        try {
          const state = await messagesApi.getActiveCall(activeConversationId);
          if (!state.active || state.status === "ended") {
            cleanupCall();
            setCallState({ active: false });
          }
        } catch { /* ignore */ }
      }, 4000);
    } catch {
      cleanupCall();
      setCallState({ active: false });
    }
  }

  async function answerIncomingCall() {
    if (!activeConversationId || !callState.callId) return;
    cleanupCall();

    try {
      const state = await messagesApi.getActiveCall(activeConversationId);
      if (!state.active || !state.caller_peer_id) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;

      const { Peer } = await import("peerjs");
      const peer = new Peer();
      peerRef.current = peer;

      const callerPeerId = state.caller_peer_id;
      const callId = callState.callId;

      peer.on("open", async () => {
        const outgoingCall = peer.call(callerPeerId, stream);
        peerCallRef.current = outgoingCall;

        outgoingCall.on("stream", (remoteStream) => {
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
          setCallState((prev) => ({ ...prev, status: "active" }));
          startCallTimer();
        });

        outgoingCall.on("close", () => { cleanupCall(); setCallState({ active: false }); });
        outgoingCall.on("error", () => { cleanupCall(); setCallState({ active: false }); });

        try { await messagesApi.answerCall(activeConversationId, callId); } catch { /* ignore */ }
      });

      // Poll to detect if caller hangs up
      callPollRef.current = setInterval(async () => {
        try {
          const s = await messagesApi.getActiveCall(activeConversationId);
          if (!s.active || s.status === "ended") {
            cleanupCall();
            setCallState({ active: false });
          }
        } catch { /* ignore */ }
      }, 4000);
    } catch {
      cleanupCall();
      setCallState({ active: false });
    }
  }

  async function endCurrentCall() {
    if (!activeConversationId || !callState.callId) return;
    try { await messagesApi.endCall(activeConversationId, callState.callId); } catch { /* ignore */ }
    cleanupCall();
    setCallState({ active: false });
  }

  // Poll for incoming calls
  useEffect(() => {
    if (!activeConversationId || callState.active) return;
    const interval = setInterval(async () => {
      try {
        const state = await messagesApi.getActiveCall(activeConversationId);
        if (state.active && state.status === "ringing" && !state.is_caller) {
          setCallState({
            active: true,
            callId: state.call_id,
            callType: state.call_type,
            status: "ringing",
            isCaller: false,
          });
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConversationId, callState.active]);

  /* ── Guards ── */
  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        {authLoading
          ? <div className="h-6 w-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          : <p className="text-sm text-gray-400">Sign in to view messages</p>
        }
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════ */
  /* ─── GROUP CHAT VIEW ───────────────────────────────── */
  /* ════════════════════════════════════════════════════════ */

  if (activeGroupId) {
    const isGAdmin = activeGroup?.my_role === "admin";
    const filteredGroupMsgs = groupSearch.trim()
      ? groupMessages.filter(m => m.content.toLowerCase().includes(groupSearch.toLowerCase()))
      : groupMessages;

    return (
      <>
        <input ref={fileInputRef} type="file" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file || !activeGroupId || !user) return;
          const bytes = await file.arrayBuffer();
          if (bytes.byteLength > 50 * 1024 * 1024) return;
          e.target.value = "";

          // Optimistic — show immediately while uploading
          const replyId = groupReplyTo?.id ?? null;
          const localUrl = URL.createObjectURL(file);
          const tempId = -Date.now();
          const optimistic: GMsg = {
            id: tempId, group_id: activeGroupId, sender_id: user.id,
            sender_name: user.full_name, sender_username: user.username ?? null,
            sender_avatar: user.avatar_base64 ?? null,
            content: file.name, is_deleted: false, is_edited: false,
            reply_to_id: replyId,
            file_url: localUrl, file_name: file.name, file_size: file.size, file_type: file.type,
            created_at: new Date().toISOString(),
          };
          setGroupMessages(prev => [...prev, optimistic]);
          setGroupReplyTo(null);
          setTimeout(() => groupEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

          const token = document.cookie.match(/access_token=([^;]+)/)?.[1] ?? "";
          const fd = new FormData(); fd.append("file", file);
          if (replyId) fd.append("reply_to_id", String(replyId));
          const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
          try {
            const res = await fetch(`${apiBase}/api/v1/groups/${activeGroupId}/upload`, { method: "POST", body: fd, headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const msg = await res.json();
              URL.revokeObjectURL(localUrl);
              setGroupMessages(prev => {
                const replaced = prev.map(m => m.id === tempId ? msg as GMsg : m);
                const seen = new Set<number>();
                return replaced.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
              });
            } else {
              URL.revokeObjectURL(localUrl);
              setGroupMessages(prev => prev.filter(m => m.id !== tempId));
            }
          } catch {
            URL.revokeObjectURL(localUrl);
            setGroupMessages(prev => prev.filter(m => m.id !== tempId));
          }
        }} />

        <div className={`fixed inset-0 z-40 flex flex-col bg-white md:static md:inset-auto md:z-auto md:h-[calc(100dvh-5rem)] md:rounded-2xl md:border md:border-gray-100 md:shadow-sm ${isClosing ? "chat-slide-out" : "chat-slide-in"}`}>

          {/* ══ Header ══ */}
          <div className="shrink-0 flex items-center gap-2 bg-white border-b border-gray-100 px-3 py-2.5 z-10">
            <button onClick={goBack}
              className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 transition-colors md:hidden">
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <button onClick={goBack}
              className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 transition-colors hidden md:block">
              <ArrowLeft size={18} className="text-gray-500" />
            </button>
            <Link
              href={activeGroup ? `/groups/${activeGroupId}/settings` : '#'}
              onClick={() => { if (activeGroup && activeGroupId) setGroupCache(activeGroupId, activeGroup, groupMembers); }}
              className="flex items-center gap-2.5 flex-1 min-w-0"
            >
              <Avatar name={activeGroup?.name ?? "…"} src={activeGroup?.avatar_base64} size={36} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">{activeGroup?.name ?? "…"}</p>
                <p className="text-xs text-gray-400 truncate leading-tight">
                  {groupMembers.length > 0 ? groupMembers.map(m => m.full_name.split(" ")[0]).slice(0, 3).join(", ") + (groupMembers.length > 3 ? ` +${groupMembers.length - 3}` : "") : "…"}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-1">
              <button onClick={() => setGroupSearchOpen(v => !v)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <Search size={18} className="text-gray-500" />
              </button>
              <Link
                href={activeGroup ? `/groups/${activeGroupId}/settings` : '#'}
                onClick={() => { if (activeGroup && activeGroupId) setGroupCache(activeGroupId, activeGroup, groupMembers); }}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <Settings size={18} className="text-gray-500" />
              </Link>
            </div>
          </div>

          {/* ══ Search bar ══ */}
          {groupSearchOpen && (
            <div className="shrink-0 flex items-center gap-2 bg-gray-50 border-b border-gray-100 px-3 py-2">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                placeholder="Search in group..." autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" />
              <button onClick={() => { setGroupSearchOpen(false); setGroupSearch(""); }}>
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          )}

          {/* ══ Messages area — uses MessageBubble exactly like DMs ══ */}
          <div ref={groupContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-0.5"
            style={{ scrollbarWidth: "thin" }}
            onScroll={() => {
              const c = groupContainerRef.current;
              if (c) { const near = c.scrollHeight - c.scrollTop - c.clientHeight < 120; if (!near) setShowScrollBtn(true); else setShowScrollBtn(false); }
            }}>
            {filteredGroupMsgs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                {!groupMsgsLoaded ? (
                  <div className="h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-gray-50 grid place-items-center mb-3">
                      <Users size={28} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">{groupSearch ? "No messages found" : "No messages yet"}</p>
                    {!groupSearch && <p className="text-xs text-gray-300 mt-1">Say hello!</p>}
                  </>
                )}
              </div>
            ) : (
              <>
                {filteredGroupMsgs.map((msg, idx) => {
                  const prevMsg = filteredGroupMsgs[idx - 1];
                  const showTimeSep = idx === 0 || (prevMsg && parseDate(msg.created_at).getTime() - parseDate(prevMsg.created_at).getTime() > 1800000);
                  return (
                    <div key={msg.id}>
                      {showTimeSep && (
                        <div className="flex justify-center py-3">
                          <span className="text-[11px] text-gray-400 bg-gray-50 rounded-full px-3 py-1 font-medium">{formatDateSep(msg.created_at)}</span>
                        </div>
                      )}
                      <MessageBubble
                        msg={{
                          id: msg.id,
                          sender_id: msg.sender_id,
                          content: msg.content,
                          created_at: msg.created_at,
                          is_deleted: msg.is_deleted,
                          is_edited: msg.is_edited,
                          reply_to_id: msg.reply_to_id ?? null,
                          file_url: msg.file_url ?? null,
                          file_name: msg.file_name ?? null,
                          file_size: msg.file_size ?? null,
                          file_type: msg.file_type ?? null,
                        }}
                        mine={msg.sender_id === user.id}
                        showAvatar={msg.sender_id !== user.id && (!filteredGroupMsgs[idx + 1] || filteredGroupMsgs[idx + 1].sender_id !== msg.sender_id)}
                        isLastMine={msg.sender_id === user.id && (!filteredGroupMsgs[idx + 1] || filteredGroupMsgs[idx + 1].sender_id !== user.id)}
                        isSeen={false}
                        partnerName={msg.sender_name}
                        partnerAvatar={msg.sender_avatar ?? null}
                        userId={user.id}
                        senderName={msg.sender_id !== user.id ? msg.sender_name : undefined}
                        senderAvatar={msg.sender_id !== user.id ? (msg.sender_avatar ?? null) : null}
                        showSenderInfo={msg.sender_id !== user.id && (!filteredGroupMsgs[idx - 1] || filteredGroupMsgs[idx - 1].sender_id !== msg.sender_id)}
                        allMessages={filteredGroupMsgs.map(m => ({
                          id: m.id, sender_id: m.sender_id,
                          content: m.content, created_at: m.created_at, is_deleted: m.is_deleted,
                          is_edited: m.is_edited, reply_to_id: m.reply_to_id ?? null,
                          file_url: m.file_url ?? null, file_name: m.file_name ?? null,
                          file_size: m.file_size ?? null, file_type: m.file_type ?? null,
                        }))}
                        onReply={(m) => { setGroupReplyTo(groupMessages.find(x => x.id === m.id) ?? null); }}
                        onContextMenu={(m, x, y) => {
                          setContextMsg(m); setContextPos({ x, y });
                        }}
                        onScrollToMsg={(id) => {
                          const container = groupContainerRef.current;
                          if (!container) return;
                          const el = container.querySelector(`[data-msg-id="${id}"]`) as HTMLElement | null;
                          if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.transition = "background 0.3s"; el.style.background = "rgba(124,58,237,0.12)"; setTimeout(() => { el.style.background = ""; }, 1200); }
                        }}
                        onPreview={setPreviewMedia}
                        isGroup
                        canDelete={msg.sender_id === user.id || isGAdmin}
                      />
                    </div>
                  );
                })}
              </>
            )}
            <div ref={groupEndRef} />
          </div>

          {/* Scroll-to-bottom button */}
          {showScrollBtn && (
            <button onClick={() => groupEndRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="absolute bottom-24 right-4 z-20 h-9 w-9 rounded-full bg-white border border-gray-200 shadow-md grid place-items-center hover:bg-gray-50 transition-colors">
              <ChevronDown size={18} className="text-gray-500" />
            </button>
          )}

          {/* Reply/Edit bar */}
          {(groupReplyTo || groupEditMsg) && (
            <div className="shrink-0 flex items-center gap-2 border-t border-gray-100 px-4 py-2 bg-amber-50/80">
              <Reply size={13} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-700">{groupEditMsg ? "Editing message" : `Replying to ${groupReplyTo!.sender_name}`}</p>
                <p className="text-xs text-amber-600 truncate">{groupEditMsg ? groupEditMsg.content.slice(0, 50) : groupReplyTo!.content.slice(0, 50)}</p>
              </div>
              <button onClick={() => { setGroupReplyTo(null); setGroupEditMsg(null); setGroupInput(""); }}
                className="p-0.5 rounded-full hover:bg-amber-100 transition-colors">
                <X size={13} className="text-amber-500" />
              </button>
            </div>
          )}

          {/* ══ Input bar — identical to DM ══ */}
          <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)]">
            {groupEditMsg ? (
              <form onSubmit={e => { e.preventDefault(); handleGroupSend(); }} className="flex items-center gap-2">
                <input value={groupInput} onChange={e => setGroupInput(e.target.value)}
                  placeholder="Edit message..."
                  className="flex-1 rounded-full border border-amber-200 bg-amber-50/50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" autoFocus />
                <button type="submit" disabled={!groupInput.trim()}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors">
                  <Check size={16} />
                </button>
              </form>
            ) : (
              <form onSubmit={e => { e.preventDefault(); handleGroupSend(); }} className="flex items-center gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors shrink-0" aria-label="Attach file">
                  <Paperclip size={18} className="text-gray-500" />
                </button>
                <input value={groupInput} onChange={e => setGroupInput(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white transition-colors" />
                {groupInput.trim() ? (
                  <button type="submit"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-30 transition-all">
                    <Send size={16} className="translate-x-[1px]" />
                  </button>
                ) : (
                  <button type="button" disabled
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white opacity-30">
                    <Mic size={16} />
                  </button>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Context menu — same as DM, handles group delete/edit too */}
        {contextMsg && (
          <div className="fixed inset-0 z-[60]" onPointerDown={() => setContextMsg(null)}>
            <div className="absolute bg-white rounded-2xl border border-gray-100 shadow-xl py-1.5 overflow-hidden w-44"
              style={{ top: Math.min(contextPos.y, window.innerHeight - 180), left: Math.min(contextPos.x, window.innerWidth - 180) }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => { setGroupReplyTo(groupMessages.find(m => m.id === contextMsg.id) ?? null); setContextMsg(null); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">
                <Reply size={14} /> Reply
              </button>
              {contextMsg.sender_id === user.id && (
                <button onClick={() => { const gm = groupMessages.find(m => m.id === contextMsg.id); if (gm) { setGroupEditMsg(gm); setGroupInput(gm.content); } setContextMsg(null); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">
                  <Pencil size={14} /> Edit
                </button>
              )}
              {(contextMsg.sender_id === user.id || isGAdmin) && (
                <button onClick={() => { handleGroupDelete(groupMessages.find(m => m.id === contextMsg.id)!); setContextMsg(null); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50">
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        )}

        {previewMedia && <MediaPreviewModal media={previewMedia} onClose={() => setPreviewMedia(null)} />}
      </>
    );
  }

    /* ════════════════════════════════════════════════════════ */
  /* ─── DM CHAT VIEW ───────────────────────────────────── */
  /* ════════════════════════════════════════════════════════ */

  if (inChat && activeConversation) {
    const partner = activeConversation.participant;

    return (
      <>
        {/* Hidden audio for calls */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={remoteAudioRef} autoPlay />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className={`fixed inset-0 z-40 flex flex-col bg-white md:static md:inset-auto md:z-auto md:h-[calc(100dvh-5rem)] md:rounded-2xl md:border md:border-gray-100 md:shadow-sm ${isClosing ? "chat-slide-out" : "chat-slide-in"}`}>
          {/* ══ Header (sticky top) ══ */}
          <div className="shrink-0 flex items-center gap-2 bg-white border-b border-gray-100 px-3 py-2.5 z-10">
            <button
              onClick={goBack}
              className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 transition-colors md:hidden"
              aria-label="Back"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <button
              onClick={goBack}
              className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 transition-colors hidden md:block"
              aria-label="Back"
            >
              <ArrowLeft size={18} className="text-gray-500" />
            </button>
            <Link
              href={`/${partner.username || ""}`}
              className="flex items-center gap-2.5 flex-1 min-w-0"
            >
              <Avatar name={partner.full_name} src={partner.avatar_base64} size={36} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">{partner.full_name}</p>
                {partnerTyping ? (
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    typing <TypingDots />
                  </p>
                ) : partner.username ? (
                  <p className="text-xs text-gray-400 truncate">@{partner.username}</p>
                ) : null}
              </div>
            </Link>
            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChatSearchOpen((v) => !v)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Search messages"
              >
                <Search size={18} className="text-gray-500" />
              </button>
              <button
                onClick={startCall}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Voice call"
                disabled={callState.active}
              >
                <Phone size={18} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* ══ Search bar (slides down) ══ */}
          {chatSearchOpen && (
            <div className="shrink-0 flex items-center gap-2 bg-gray-50 border-b border-gray-100 px-3 py-2">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                value={chatSearch}
                onChange={(e) => handleChatSearch(e.target.value)}
                placeholder="Search in conversation..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                autoFocus
              />
              {chatSearchResults.length > 0 && (
                <span className="text-xs text-gray-400 shrink-0">
                  {chatSearchIdx + 1}/{chatSearchResults.length}
                </span>
              )}
              {chatSearchResults.length > 1 && (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => navigateSearchResult(-1)} className="p-1 rounded hover:bg-gray-200">
                    <ArrowLeft size={14} className="text-gray-500 rotate-90" />
                  </button>
                  <button onClick={() => navigateSearchResult(1)} className="p-1 rounded hover:bg-gray-200">
                    <ArrowLeft size={14} className="text-gray-500 -rotate-90" />
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setChatSearchOpen(false);
                  setChatSearch("");
                  setChatSearchResults([]);
                }}
                className="p-1 rounded-full hover:bg-gray-200"
              >
                <X size={14} className="text-gray-500" />
              </button>
            </div>
          )}

          {/* ══ Call overlay (full-screen) ══ */}
          {callState.active && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-neutral-900 via-neutral-800 to-neutral-900 text-white">
              {/* Top section */}
              <div className="flex flex-col items-center pt-16">
                <Avatar name={partner.full_name} src={partner.avatar_base64} size={96} />
                <h2 className="mt-4 text-xl font-semibold">{partner.full_name}</h2>
                {partner.username && (
                  <p className="text-sm text-white/50 mt-0.5">@{partner.username}</p>
                )}
                <p className="mt-3 text-sm text-white/60">
                  {callState.status === "ringing"
                    ? callState.isCaller
                      ? "Calling..."
                      : "Incoming call..."
                    : "Connected"}
                </p>
                {callState.status === "active" && (
                  <p className="mt-1 text-lg font-mono text-white/80 tabular-nums">
                    {formatCallDuration(callDuration)}
                  </p>
                )}
                {callState.status === "ringing" && callState.isCaller && (
                  <div className="mt-6 flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-green-400 animate-pulse"
                        style={{ animationDelay: `${i * 0.3}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom controls */}
              <div className="pb-16 flex flex-col items-center gap-6">
                {/* Mute button (only when active) */}
                {callState.status === "active" && (
                  <button
                    onClick={toggleMute}
                    className={`w-14 h-14 rounded-full grid place-items-center transition-colors ${
                      isMuted ? "bg-red-500/80" : "bg-white/15 hover:bg-white/25"
                    }`}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                )}

                <div className="flex items-center gap-6">
                  {/* Accept button (incoming ringing) */}
                  {callState.status === "ringing" && !callState.isCaller && (
                    <button
                      onClick={answerIncomingCall}
                      className="w-16 h-16 rounded-full bg-green-500 grid place-items-center shadow-lg shadow-green-500/30 hover:bg-green-400 transition-colors animate-pulse"
                      aria-label="Accept call"
                    >
                      <Phone size={28} />
                    </button>
                  )}

                  {/* End call button */}
                  <button
                    onClick={endCurrentCall}
                    className="w-16 h-16 rounded-full bg-red-500 grid place-items-center shadow-lg shadow-red-500/30 hover:bg-red-400 transition-colors"
                    aria-label="End call"
                  >
                    <PhoneOff size={28} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ Messages area (scrollable) ══ */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-0.5"
            style={{ scrollbarWidth: "thin" }}
          >
            {chatMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                {!dmMsgsLoaded ? (
                  <div className="h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-gray-50 grid place-items-center mb-3">
                      <MessageCircle size={28} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">No messages yet</p>
                    <p className="text-xs text-gray-300 mt-1">Send a message to start the conversation</p>
                  </>
                )}
              </div>
            ) : (
              <>
                {chatMessages.map((m, idx) => {
                  const mine = m.sender_id === user.id;
                  const nextMsg = chatMessages[idx + 1];
                  const prevMsg = chatMessages[idx - 1];
                  const showAvatar = !mine && (!nextMsg || nextMsg.sender_id !== m.sender_id);
                  const isLastMine = mine && (!nextMsg || nextMsg.sender_id !== user.id);
                  const isSeen = mine && partnerLastRead !== null && m.id > 0 && m.id <= partnerLastRead;

                  const showTimeSep =
                    idx === 0 ||
                    (prevMsg &&
                      parseDate(m.created_at).getTime() - parseDate(prevMsg.created_at).getTime() > 1800000);

                  return (
                    <div key={m.id}>
                      {showTimeSep && (
                        <div className="flex justify-center py-3">
                          <span className="text-[10px] text-gray-400 bg-gray-50 px-3 py-0.5 rounded-full">
                            {formatDateSep(m.created_at)} · {formatTime(m.created_at)}
                          </span>
                        </div>
                      )}
                      <MessageBubble
                        msg={m}
                        mine={mine}
                        showAvatar={showAvatar}
                        isLastMine={isLastMine}
                        isSeen={isSeen}
                        partnerName={partner.full_name}
                        partnerAvatar={partner.avatar_base64}
                        userId={user.id}
                        allMessages={chatMessages}
                        onReply={setReplyTo}
                        onContextMenu={showContextMenu}
                        onScrollToMsg={scrollToMessage}
                        onPreview={setPreviewMedia}
                      />
                    </div>
                  );
                })}

                {/* Partner typing */}
                {partnerTyping && (
                  <div className="flex items-end gap-1.5 mb-0.5">
                    <div className="w-7 shrink-0">
                      <Avatar name={partner.full_name} src={partner.avatar_base64} size={28} />
                    </div>
                    <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
                      <TypingDots />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* ══ Scroll to bottom FAB ══ */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-24 right-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-all"
              aria-label="Scroll to bottom"
            >
              <ArrowDown size={16} className="text-gray-600" />
            </button>
          )}

          {/* ══ Reply banner ══ */}
          {replyTo && (
            <div className="shrink-0 flex items-center gap-2 border-t border-gray-100 px-4 py-2 bg-gray-50/80">
              <Reply size={13} className="text-gray-400 shrink-0" />
              <p className="flex-1 text-xs text-gray-500 truncate">
                {replyTo.content.slice(0, 60)}
              </p>
              <button
                onClick={() => setReplyTo(null)}
                className="p-0.5 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={13} className="text-gray-400" />
              </button>
            </div>
          )}

          {/* ══ Edit banner ══ */}
          {editingMsg && (
            <div className="shrink-0 flex items-center gap-2 border-t border-gray-100 px-4 py-2 bg-amber-50/80">
              <Pencil size={13} className="text-amber-600 shrink-0" />
              <p className="flex-1 text-xs text-amber-700 truncate">Editing message</p>
              <button
                onClick={() => { setEditingMsg(null); setEditText(""); }}
                className="p-0.5 rounded-full hover:bg-amber-100 transition-colors"
              >
                <X size={13} className="text-amber-500" />
              </button>
            </div>
          )}

          {/* ══ Input bar (sticky bottom) ══ */}
          <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)]">
            {editingMsg ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleEditMessage(); }}
                className="flex items-center gap-2"
              >
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Edit message..."
                  className="flex-1 rounded-full border border-amber-200 bg-amber-50/50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!editText.trim()}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
                >
                  <Check size={16} />
                </button>
              </form>
            ) : isRecording ? (
              /* ── Voice recording bar ── */
              <div className="flex items-center gap-2.5 h-[44px]">
                {/* Cancel */}
                <button
                  onClick={cancelVoiceRecording}
                  className="p-2 rounded-full hover:bg-red-50 transition-colors shrink-0"
                  aria-label="Cancel recording"
                >
                  <Trash2 size={18} className="text-red-400" />
                </button>

                {/* Recording indicator */}
                <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-full bg-red-50 border border-red-100">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-sm font-medium text-red-600 tabular-nums">
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                  </span>
                  {/* Animated bars */}
                  <div className="flex items-center gap-[3px] flex-1 justify-center">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-[2px] rounded-full bg-red-400/60"
                        style={{
                          height: `${8 + Math.sin(Date.now() / 200 + i * 0.8) * 6 + Math.random() * 4}px`,
                          animation: "pulse 0.6s ease-in-out infinite",
                          animationDelay: `${i * 0.05}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Send / Stop */}
                <button
                  onClick={stopVoiceRecording}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all active:scale-90 shadow-sm"
                  aria-label="Send voice note"
                >
                  <Send size={16} className="translate-x-[1px]" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors shrink-0 disabled:opacity-40"
                  aria-label="Attach file"
                  title="Share a file"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : (
                    <Paperclip size={18} className="text-gray-500" />
                  )}
                </button>
                <input
                  ref={inputRef}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                  placeholder="Message..."
                  className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white transition-colors"
                />
                {newMessage.trim() ? (
                  <button
                    type="submit"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition-all"
                  >
                    <Send size={16} className="translate-x-[1px]" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={uploading}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-30 transition-all active:scale-90"
                    aria-label="Record voice note"
                    title="Tap to record voice note"
                  >
                    <Mic size={16} />
                  </button>
                )}
              </form>
            )}
          </div>
        </div>

        {/* ══ Media preview modal ══ */}
        {previewMedia && (
          <MediaPreviewModal
            media={previewMedia}
            onClose={() => setPreviewMedia(null)}
          />
        )}

        {/* ══ Forward picker modal ══ */}
        {forwardMsg && (
          <ForwardPickerModal
            conversations={conversations}
            currentConversationId={activeConversationId!}
            onSelect={handleForward}
            onClose={() => setForwardMsg(null)}
          />
        )}

        {/* ══ Context menu overlay ══ */}
        {contextMsg && (
          <div
            className="fixed inset-0 z-[60]"
            onPointerDown={() => setContextMsg(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMsg(null); }}
          >
            <div
              className="absolute bg-white rounded-xl shadow-2xl border border-gray-200/80 py-1.5 min-w-[170px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              style={{ top: contextPos.y, left: contextPos.x }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setReplyTo(contextMsg); setContextMsg(null); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Reply size={15} className="text-gray-400" /> Reply
              </button>
              {!contextMsg.file_url && (
                <button
                  onClick={() => copyMessage(contextMsg)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Copy size={15} className="text-gray-400" /> Copy
                </button>
              )}
              <button
                onClick={() => startForward(contextMsg)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Share2 size={15} className="text-gray-400" /> Forward
              </button>
              {contextMsg.sender_id === user.id && (
                <>
                  <div className="mx-3 my-1 h-px bg-gray-100" />
                  {!contextMsg.file_url && (
                    <button
                      onClick={() => {
                        setEditingMsg(contextMsg);
                        setEditText(contextMsg.content);
                        setContextMsg(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Pencil size={15} className="text-gray-400" /> Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMessage(contextMsg)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} className="text-red-400" /> Delete
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  /* ════════════════════════════════════════════════════════ */
  /* ─── NEW REQUEST VIEW ──────────────────────────────── */
  /* ════════════════════════════════════════════════════════ */

  if (showNewRequest && requestTarget) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 animate-page">
        <div className="w-full max-w-sm">
          {/* Back */}
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8 group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" /> Back
          </button>

          {/* Card */}
          <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl shadow-black/5 border border-gray-100">
            {/* Decorative gradient header */}
            <div className="h-24 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-700" />

            {/* Avatar overlay */}
            <div className="flex flex-col items-center -mt-12 px-6 pb-6">
              <div className="rounded-full p-1 bg-white shadow-lg">
                <Avatar name={requestTarget.full_name} src={requestTarget.avatar_base64} size={80} />
              </div>

              <h2 className="mt-3 text-lg font-bold text-gray-900 tracking-tight">{requestTarget.full_name}</h2>
              {requestTarget.username && (
                <p className="text-sm text-gray-400 font-medium">@{requestTarget.username}</p>
              )}

              <div className="mt-4 w-full">
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100 mb-4">
                  <MessageCircle size={14} className="text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">
                    You haven&apos;t chatted before. Send a request to start messaging.
                  </p>
                </div>

                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Your message
                </label>
                <textarea
                  rows={3}
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  placeholder="Hey! I'd love to connect..."
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm outline-none focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-100 transition-all resize-none"
                  autoFocus
                />
                <p className="text-[10px] text-gray-400 mt-1.5 px-1">
                  They&apos;ll see this message when deciding to accept your request.
                </p>
              </div>

              <div className="mt-5 w-full flex items-center gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-2xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={sendRequest}
                  disabled={!requestText.trim() || requestSending}
                  className="flex-1 rounded-2xl bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40 transition-all active:scale-[0.98] shadow-lg shadow-neutral-900/20"
                >
                  {requestSending ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Send size={14} className="translate-x-[1px]" /> Send Request
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════ */
  /* ─── MESSAGE REQUESTS SUB-VIEW ─────────────────────── */
  /* ════════════════════════════════════════════════════════ */

  if (showRequestsView) {
    return (
      <div className="animate-page">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setShowRequestsView(false)}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Message Requests</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {incomingRequests.length} request{incomingRequests.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Incoming requests list */}
        <div className="space-y-2.5">
          {incomingRequests.map((r) => (
            <div
              key={`req-${r.id}`}
              className="group relative rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-neutral-900 to-neutral-600 rounded-l-2xl" />
              <div className="p-4 pl-5">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <Avatar name={r.from_user.full_name} src={r.from_user.avatar_base64} size={48} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-white grid place-items-center">
                      <MessageCircle size={8} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-900 truncate">{r.from_user.full_name}</p>
                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">{formatShort(r.created_at)}</span>
                    </div>
                    {r.from_user.username && (
                      <p className="text-xs text-gray-400 font-medium">@{r.from_user.username}</p>
                    )}
                    <div className="mt-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[13px] text-gray-600 line-clamp-2 leading-relaxed">
                        &ldquo;{r.context || "Wants to message you"}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 pl-[60px]">
                  <button
                    onClick={() => handleRequestDecision(r, false)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-[13px] font-medium text-gray-500 hover:border-red-200 hover:text-red-500 hover:bg-red-50/50 transition-all active:scale-[0.98]"
                  >
                    <X size={14} /> Decline
                  </button>
                  <button
                    onClick={() => handleRequestDecision(r, true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 py-2 text-[13px] font-semibold text-white hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-sm shadow-neutral-900/20"
                  >
                    <Check size={14} /> Accept
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sent pending */}
        {sentRequests.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 px-1 mb-2.5">
              <Send size={12} className="text-gray-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Pending Requests
              </p>
            </div>
            <div className="space-y-1.5">
              {sentRequests.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-gray-50/80 border border-gray-100 hover:bg-gray-100/80 transition-colors">
                  <div className="relative shrink-0">
                    <Avatar name={r.to_user.full_name} src={r.to_user.avatar_base64} size={42} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gray-300 border-2 border-white grid place-items-center">
                      <Send size={7} className="text-white translate-x-[0.5px]" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">{r.to_user.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <p className="text-xs text-gray-400 font-medium">Awaiting response</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">{formatShort(r.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════ */
  /* ─── CONVERSATION LIST VIEW ────────────────────────── */
  /* ════════════════════════════════════════════════════════ */

  return (
    <div className="animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {conversations.length + myGroups.length > 0
              ? `${conversations.length + myGroups.length} conversation${conversations.length + myGroups.length > 1 ? "s" : ""}`
              : "Your conversations"}
          </p>
        </div>
        <button onClick={() => setShowCreateGroup(true)}
          className="h-8 w-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
          title="New group chat">
          <Users size={15} className="text-neutral-600" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mt-3 mb-4">
        <Search
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-gray-400 focus:border-neutral-400 focus:bg-white transition-colors"
        />
      </div>

      {/* Message Requests row (Instagram-style) */}
      {(incomingRequests.length > 0 || sentRequests.length > 0) && (
        <button
          onClick={() => setShowRequestsView(true)}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-3 mb-1 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          {/* Show first requester's avatar or a generic icon */}
          {incomingRequests.length > 0 ? (
            <div className="relative">
              <Avatar name={incomingRequests[0].from_user.full_name} src={incomingRequests[0].from_user.avatar_base64} size={48} />
              <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-neutral-900 border-2 border-white grid place-items-center">
                <MessageCircle size={9} className="text-white" />
              </div>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 grid place-items-center shrink-0">
              <Send size={18} className="text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Message Requests</p>
            <p className="truncate text-xs text-gray-500 mt-0.5">
              {incomingRequests.length > 0
                ? `${incomingRequests[0].from_user.full_name}${incomingRequests.length > 1 ? ` +${incomingRequests.length - 1} more` : ""}`
                : `${sentRequests.length} pending`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {incomingRequests.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] font-semibold grid place-items-center">
                {incomingRequests.length}
              </span>
            )}
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </button>
      )}

      {/* Conversations */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visibleConversations.length === 0 && incomingRequests.length === 0 && sentRequests.length === 0 ? (
        <div className="text-center py-20 animate-in fade-in duration-150">
          <div className="w-16 h-16 rounded-full bg-gray-50 grid place-items-center mx-auto mb-3">
            <MessageCircle size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-400">No conversations yet</p>
          <p className="text-xs text-gray-300 mt-1">Visit a profile and tap Message to start</p>
        </div>
      ) : (
        <div className="space-y-0.5 stagger-children">
          {visibleConversations.map((c) => (
            <div key={c.id} className="relative overflow-hidden">
              {/* Delete button revealed behind */}
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  onClick={() => { setSwipedConvoId(null); setDeleteConfirm(c); }}
                  className="h-full px-5 bg-red-500 text-white text-sm font-semibold flex items-center gap-1.5"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
              {/* Swipeable content — real-time drag */}
              <div
                className="relative bg-white"
                style={{
                  transform: swipedConvoId === c.id ? "translateX(-100px)" : "translateX(0)",
                  transition: "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                }}
                onTouchStart={(e) => {
                  const el = e.currentTarget;
                  swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, id: c.id };
                  swipeDragRef.current = { el, startX: e.touches[0].clientX, locked: false };
                  el.style.transition = "none";
                }}
                onTouchMove={(e) => {
                  const drag = swipeDragRef.current;
                  const start = swipeStartRef.current;
                  if (!drag || !start || start.id !== c.id) return;
                  const dx = e.touches[0].clientX - start.x;
                  const dy = Math.abs(e.touches[0].clientY - start.y);
                  // If vertical scroll detected, abort swipe
                  if (!drag.locked && dy > 15) {
                    swipeDragRef.current = null;
                    swipeStartRef.current = null;
                    drag.el.style.transition = "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
                    drag.el.style.transform = swipedConvoId === c.id ? "translateX(-100px)" : "translateX(0)";
                    return;
                  }
                  if (Math.abs(dx) > 8) drag.locked = true;
                  if (!drag.locked) return;
                  // Already swiped open — allow dragging back
                  const base = swipedConvoId === c.id ? -100 : 0;
                  const offset = Math.max(-120, Math.min(0, base + dx));
                  drag.el.style.transform = `translateX(${offset}px)`;
                }}
                onTouchEnd={() => {
                  const drag = swipeDragRef.current;
                  const start = swipeStartRef.current;
                  if (drag) {
                    drag.el.style.transition = "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
                    if (start && drag.locked) {
                      const dx = drag.el.getBoundingClientRect().left - drag.el.parentElement!.getBoundingClientRect().left;
                      if (dx < -50) {
                        setSwipedConvoId(c.id);
                        drag.el.style.transform = "translateX(-100px)";
                      } else {
                        setSwipedConvoId(null);
                        drag.el.style.transform = "translateX(0)";
                      }
                    } else {
                      drag.el.style.transform = swipedConvoId === c.id ? "translateX(-100px)" : "translateX(0)";
                    }
                  }
                  swipeDragRef.current = null;
                  swipeStartRef.current = null;
                }}
              >
                <button
                  onClick={() => { if (swipedConvoId === c.id) { setSwipedConvoId(null); return; } openChat(c); }}
                  onContextMenu={(e) => { e.preventDefault(); setDeleteConfirm(c); }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <Avatar name={c.participant.full_name} src={c.participant.avatar_base64} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{c.participant.full_name}</p>
                      <span className="text-[11px] text-gray-400 shrink-0 ml-2">
                        {formatShort(c.last_message_at)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500 mt-0.5">
                      {c.partner_is_typing ? (
                        <span className="text-emerald-500 font-medium">typing...</span>
                      ) : (
                        sharePreview(c.last_message)
                      )}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Group chats — shown inline with DMs, same style */}
      {myGroups.map((g) => (
        <button key={`g-${g.id}`} onClick={() => openGroupChat(g.id)}
          className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left ${activeGroupId === g.id ? "bg-gray-50" : ""}`}>
          <Avatar name={g.name} src={g.avatar_base64} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">{g.name}</p>
              <span className="text-[11px] text-gray-400 shrink-0 ml-2">
                {g.last_message_at ? formatShort(g.last_message_at) : ""}
              </span>
            </div>
            <p className="truncate text-xs text-gray-500 mt-0.5">
              {sharePreview(g.last_message) || `${g.member_count} member${g.member_count !== 1 ? "s" : ""}`}
            </p>
          </div>
        </button>
      ))}

      {/* Create group modal */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(newG) => { setMyGroups(prev => [newG, ...prev]); setShowCreateGroup(false); openGroupChat(newG.id); }}
        />
      )}

      {/* Delete conversation confirmation modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[min(90vw,340px)] p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 grid place-items-center mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Delete Conversation</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Delete your entire conversation with <span className="font-medium text-gray-700">{deleteConfirm.participant.full_name}</span>? This will permanently remove all messages and shared media. To chat again, you&apos;ll need to send a new request.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2.5">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConversation}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors active:scale-[0.98] shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}