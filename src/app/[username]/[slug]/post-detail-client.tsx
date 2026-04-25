"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Heart, Send, Share2, Clock,
  MoreHorizontal, Trash2, X, ChevronLeft, ChevronRight,
  Play, FileText, Download, Bookmark,
  Globe, Users, GraduationCap, Lock, Eye,
} from "lucide-react";
import { auth, posts as postsApi, type PostDetail, type Comment, type UserProfile, type PostMedia } from "@/lib/api";
import ShareOverlay from "@/components/share-overlay";
import { useAuth } from "@/lib/auth-context";

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function normalizeIso(iso: string) {
  return iso.endsWith("Z") || iso.includes("+") || iso.includes("-", 10) ? iso : iso + "Z";
}

function timeAgo(iso: string) {
  const d = new Date(normalizeIso(iso));
  const diff = Date.now() - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function formatFullDate(iso: string) {
  const d = new Date(normalizeIso(iso));
  return (
    d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

const VIS_META: Record<string, { icon: typeof Globe; label: string }> = {
  public:         { icon: Globe,         label: "Public"        },
  students_only:  { icon: GraduationCap, label: "Students Only" },
  batch_only:     { icon: Users,         label: "Batch Only"    },
  faculties_only: { icon: Lock,          label: "Faculty Only"  },
  subject_only:   { icon: Lock,          label: "Subject Only"  },
};

function renderContent(text: string) {
  const parts = text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("#"))
      return <Link key={i} href={`/tag/${part.slice(1)}`} className="text-neutral-500 hover:text-neutral-900 underline underline-offset-2 decoration-neutral-300 transition-colors">{part}</Link>;
    if (part.startsWith("@"))
      return <Link key={i} href={`/${part.slice(1)}`} className="font-medium text-neutral-800 hover:underline underline-offset-2">{part}</Link>;
    return <span key={i}>{part}</span>;
  });
}

/* ─────────────────────────────────────────────
   Avatar
───────────────────────────────────────────── */
function Avatar({ name, b64, href, size = "md" }: {
  name: string; b64?: string | null; href?: string; size?: "xs" | "sm" | "md" | "lg";
}) {
  const sz = size === "xs" ? "h-6 w-6 text-[9px]" : size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-10 w-10 text-[14px]" : "h-9 w-9 text-[12px]";
  const inner = (
    <div className={`${sz} rounded-full bg-neutral-900 text-white font-medium grid place-items-center overflow-hidden shrink-0 select-none`}>
      {b64 ? <img src={b64} alt={name} className="h-full w-full object-cover" /> : name[0]?.toUpperCase()}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}


/* ─────────────────────────────────────────────
   Lightbox — portal, covers everything
───────────────────────────────────────────── */
function Lightbox({ images, idx, onClose, onChange }: {
  images: PostMedia[];
  idx: number;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft"  && idx > 0)                   onChange(idx - 1);
      if (e.key === "ArrowRight" && idx < images.length - 1)   onChange(idx + 1);
    }
    window.addEventListener("keydown", onKey);
    // Prevent page scroll while open
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [idx, images.length, onClose, onChange]);

  const hasThumbs = images.length > 1;
  const thumbH   = hasThumbs ? 68 : 0;
  const topBarH  = 48;

  const overlay = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column",
        background: "#0e0e0e",
      }}
    >
      {/* ── top bar ── */}
      <div style={{
        height: topBarH, flexShrink: 0,
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        background: "#181818",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {images[idx].file_name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {hasThumbs && (
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              {idx + 1} / {images.length}
            </span>
          )}
          {/* ── Download button ── */}
          <a
            href={images[idx].file_url}
            download={images[idx].file_name}
            title="Download image"
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 4,
              color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center",
              textDecoration: "none", transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          >
            <Download size={18} />
          </a>
          {/* ── Close button ── */}
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── main image area ── */}
      <div style={{
        flex: 1, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        padding: "0 56px",
      }}>
        {/* Prev arrow */}
        {idx > 0 && (
          <button
            onClick={() => onChange(idx - 1)}
            style={{
              position: "absolute", left: 0, top: 0, width: 52, height: "100%",
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.35)",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "none"; }}
          >
            <ChevronLeft size={30} />
          </button>
        )}

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={idx}
          src={images[idx].file_url}
          alt={images[idx].file_name}
          draggable={false}
          style={{
            maxWidth: "100%",
            maxHeight: `calc(100vh - ${topBarH}px - ${thumbH}px - 24px)`,
            objectFit: "contain",
            userSelect: "none",
            display: "block",
            borderRadius: 6,
          }}
        />

        {/* Next arrow */}
        {idx < images.length - 1 && (
          <button
            onClick={() => onChange(idx + 1)}
            style={{
              position: "absolute", right: 0, top: 0, width: 52, height: "100%",
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.35)",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "none"; }}
          >
            <ChevronRight size={30} />
          </button>
        )}
      </div>

      {/* ── thumbnail strip ── */}
      {hasThumbs && (
        <div style={{
          height: thumbH, flexShrink: 0,
          background: "#181818",
          borderTop: "1px solid #2a2a2a",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, padding: "0 16px", overflowX: "auto",
        }}>
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => onChange(i)}
              style={{
                flexShrink: 0,
                width: 48, height: 48,
                borderRadius: 6,
                overflow: "hidden",
                border: i === idx ? "2px solid #fff" : "2px solid transparent",
                opacity: i === idx ? 1 : 0.4,
                cursor: "pointer",
                padding: 0,
                transition: "opacity 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { if (i !== idx) e.currentTarget.style.opacity = "0.7"; }}
              onMouseLeave={e => { if (i !== idx) e.currentTarget.style.opacity = "0.4"; }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.file_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}

/* ─────────────────────────────────────────────
   Media Gallery
───────────────────────────────────────────── */
function MediaGallery({ media }: { media: PostMedia[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const images = media.filter((m) => m.file_type.startsWith("image/"));
  const videos = media.filter((m) => m.file_type.startsWith("video/"));
  const audios = media.filter((m) => m.file_type.startsWith("audio/"));
  const docs   = media.filter((m) =>
    !m.file_type.startsWith("image/") && !m.file_type.startsWith("video/") && !m.file_type.startsWith("audio/")
  );
  const n = images.length;

  return (
    <>
      {n > 0 && (
        <div className={`mt-5 rounded-2xl overflow-hidden ${n > 1 ? "grid grid-cols-2 gap-px bg-neutral-200" : ""}`}>
          {images.slice(0, 4).map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setLightboxIdx(idx)}
              className={`relative overflow-hidden bg-neutral-100 group cursor-zoom-in ${
                n === 1 ? "aspect-[16/10] w-full" :
                n === 3 && idx === 0 ? "row-span-2" : "aspect-square"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.file_url} alt={img.file_name} className="h-full w-full object-cover group-hover:brightness-90 transition-all duration-200" />
              {idx === 3 && n > 4 && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <span className="text-white text-xl font-semibold">+{n - 4}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {videos.map((v) => (
        <div key={v.id} className="mt-4 rounded-2xl overflow-hidden bg-neutral-950">
          <video src={v.file_url} controls className="w-full max-h-[480px]" preload="metadata">
            <track kind="captions" />
          </video>
        </div>
      ))}

      {audios.map((a) => (
        <div key={a.id} className="mt-3 flex items-center gap-3 rounded-2xl bg-neutral-50 border border-neutral-200 p-4">
          <div className="h-9 w-9 rounded-full bg-neutral-900 text-white grid place-items-center shrink-0">
            <Play size={14} fill="currentColor" strokeWidth={0} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-neutral-800 truncate">{a.file_name}</p>
            <audio src={a.file_url} controls className="w-full mt-1.5 h-7" preload="metadata" />
          </div>
        </div>
      ))}

      {docs.map((d) => (
        <a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex items-center gap-3 rounded-2xl bg-neutral-50 border border-neutral-200 p-4 hover:bg-neutral-100 transition-colors group"
        >
          <div className="h-9 w-9 rounded-xl bg-neutral-200 text-neutral-600 grid place-items-center shrink-0">
            <FileText size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-neutral-800 truncate">{d.file_name}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{(d.file_size / 1024).toFixed(0)} KB</p>
          </div>
          <Download size={14} className="text-neutral-400 group-hover:text-neutral-700 transition-colors shrink-0" />
        </a>
      ))}

      {lightboxIdx !== null && (
        <Lightbox
          images={images}
          idx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onChange={setLightboxIdx}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   Comment Node — proper Reddit elbow threading
   
   Structure per comment:
   [avatar]  name  time
   [  |  ]  comment body
   [  |  ]  Reply
   [  |__]  [child avatar]  name
            child body
            Reply
───────────────────────────────────────────── */
function CommentNode({
  comment, allComments, depth, onReply, currentUser,
}: {
  comment: Comment; allComments: Comment[]; depth: number;
  onReply: (c: Comment) => void; currentUser: UserProfile | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const children = allComments.filter((c) => c.reply_to_comment_id === comment.id);
  const hasChildren = children.length > 0;
  const cHref = comment.author_username ? `/${comment.author_username}` : "#";

  // Avatar column width (px) — must match the w- value below
  const AVATAR_W = 24; // h-6 w-6

  return (
    <div className="relative">
      {/* ── Comment row ── */}
      <div className="flex gap-3 pt-3">

        {/* Left col: avatar + vertical line down to children */}
        <div className="flex flex-col items-center shrink-0" style={{ width: AVATAR_W }}>
          <Avatar name={comment.author_name} b64={comment.author_avatar_base64} href={cHref} size="xs" />
          {/* Vertical line — runs from below avatar to the elbow of the last child */}
          {hasChildren && !collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="mt-1.5 flex-1 w-px bg-neutral-250 hover:bg-neutral-400 transition-colors cursor-pointer rounded-full min-h-[8px]"
              style={{ backgroundColor: "#d4d4d4" }}
              title="Collapse"
            />
          )}
        </div>

        {/* Right col: content */}
        <div className="flex-1 min-w-0 pb-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={cHref} className="text-[13px] font-semibold text-neutral-900 hover:underline underline-offset-2 leading-none">
              {comment.author_name}
            </Link>
            {comment.author_username && (
              <span className="text-[11px] text-neutral-400 hidden sm:block leading-none">@{comment.author_username}</span>
            )}
            <span className="text-[11px] text-neutral-400 leading-none">{timeAgo(comment.created_at)}</span>
            {hasChildren && collapsed && (
              <button onClick={() => setCollapsed(false)}
                className="ml-auto text-[11px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors">
                +{children.length} {children.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          {!collapsed && (
            <>
              <p className="mt-1 text-[13.5px] text-neutral-600 leading-relaxed whitespace-pre-wrap break-words">
                {renderContent(comment.content)}
              </p>
              {currentUser && (
                <button onClick={() => onReply(comment)}
                  className="mt-1.5 text-[12px] font-medium text-neutral-400 hover:text-neutral-800 transition-colors">
                  Reply
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Children with elbow connectors ── */}
      {!collapsed && hasChildren && (
        <div>
          {children.map((child, i) => {
            const isLast = i === children.length - 1;
            return (
              <div key={child.id} className="relative flex">
                {/*
                  Left gutter: draws the elbow shape
                  - Vertical line on the left (full height if not last, half if last)
                  - Horizontal stub going right to connect to child avatar
                */}
                <div
                  className="shrink-0 relative"
                  style={{ width: AVATAR_W, marginLeft: 0 }}
                >
                  {/* Vertical part of elbow */}
                  <div
                    className="absolute left-1/2 top-0 -translate-x-1/2"
                    style={{
                      width: 1,
                      backgroundColor: "#d4d4d4",
                      // If last child: only goes halfway down, otherwise full height
                      height: isLast ? "calc(50% + 3px)" : "100%",
                    }}
                  />
                  {/* Horizontal part of elbow — at the midpoint of the avatar */}
                  <div
                    className="absolute"
                    style={{
                      left: "calc(50%)",
                      top: "calc(12px + 9px)", // top-padding(12px) + half avatar height(9px for h-6)
                      width: 10,
                      height: 1,
                      backgroundColor: "#d4d4d4",
                    }}
                  />
                </div>

                {/* Child comment — indented by a gap equal to the horizontal stub */}
                <div className="flex-1 min-w-0" style={{ paddingLeft: 10 }}>
                  <CommentNode
                    comment={child}
                    allComments={allComments}
                    depth={depth + 1}
                    onReply={onReply}
                    currentUser={currentUser}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export default function PostDetailClient({ slug }: { slug: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [copied, _setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<UserProfile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentFocused, setCommentFocused] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const likingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    postsApi.get(slug)
      .then((data) => {
        if (cancelled) return;
        const d = { ...data, comments: Array.isArray(data.comments) ? data.comments : [] } as PostDetail;
        setPost(d);
        setLiked(!!data.user_reacted);
        setLikeCount(data.reactions_count);
        setSaved(!!(data as Record<string, unknown>).user_saved);
      })
      .catch(() => { if (!cancelled) setPost(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    if (showMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  const handleReply = useCallback((c: Comment) => {
    setReplyTo(c);
    setNewComment("");
    requestAnimationFrame(() => commentInputRef.current?.focus());
  }, []);

  async function handleLike() {
    if (!user) { router.push("/auth/sign-in"); return; }
    if (!post) return;
    if (likingRef.current) return;
    likingRef.current = true;
    const pl = liked, pc = likeCount;
    setLiked(!pl); setLikeCount(pl ? pc - 1 : pc + 1);
    try {
      const r = await postsApi.react(post.id, "like");
      setLiked(r.active);
      setLikeCount(r.count);
    } catch {
      setLiked(pl);
      setLikeCount(pc);
    } finally {
      likingRef.current = false;
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !post) return;
    setSubmitting(true);
    try {
      const created = await postsApi.comment(post.id, newComment, replyTo?.id ?? null) as Comment;
      setPost((prev) => prev
        ? { ...prev, comments: [...(prev.comments || []), created], comments_count: prev.comments_count + 1 }
        : prev);
    } catch { /**/ }
    setNewComment(""); setReplyTo(null); setShowSuggestions(false); setSubmitting(false);
  }

  function updateMentionSuggestions(value: string, caretPos: number) {
    const before = value.slice(0, caretPos);
    const match = before.match(/(^|\s)@([a-zA-Z0-9_]*)$/);
    if (!match) { setShowSuggestions(false); return; }
    auth.searchUsers(match[2] || "")
      .then((users) => { setMentionSuggestions(users.filter((u) => !!u.username).slice(0, 6)); setShowSuggestions(true); })
      .catch(() => setShowSuggestions(false));
  }

  function applyMention(username: string) {
    const input = commentInputRef.current;
    if (!input) return;
    const caret = input.selectionStart ?? newComment.length;
    const before = newComment.slice(0, caret);
    const after = newComment.slice(caret);
    const replaced = before.replace(/(^|\s)@([a-zA-Z0-9_]*)$/, `$1@${username}`);
    setNewComment(`${replaced} ${after}`);
    setShowSuggestions(false);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(replaced.length + 1, replaced.length + 1); });
  }

  const shareUrl = post ? `${window.location.origin}/${post.author_username || "post"}/${post.slug}` : "";

  function handleShare() {
    if (!post) return;
    setShowShare(true);
  }

  const effectiveRole = user?.batch_year ? "student" : user?.role;
  const canDelete = user && post && (effectiveRole === "admin" || effectiveRole === "faculty" || post.author_id === user.id);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white">
        <div className="h-5 w-5 border-[1.5px] border-neutral-200 border-t-neutral-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 px-6 bg-white">
        <Eye size={26} className="text-neutral-300" />
        <p className="text-[15px] font-semibold text-neutral-800">Post not found</p>
        <p className="text-[13px] text-neutral-400 text-center">It may have been deleted or you don&apos;t have access.</p>
        <Link href="/feed" className="mt-3 rounded-full bg-neutral-900 px-5 py-2 text-[13px] font-medium text-white hover:bg-neutral-700 transition-colors">
          Back to feed
        </Link>
      </div>
    );
  }

  const visMeta = VIS_META[post.visibility] || VIS_META.public;
  const VisIcon = visMeta.icon;
  const authorHref = post.author_username ? `/${post.author_username}` : "#";
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const topLevelComments = comments.filter((c) => !c.reply_to_comment_id);
  const media = post.media || [];

  return (
    <>
      <style>{`
        .detail-root { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.22s ease forwards; }
      `}</style>

      <div className="detail-root min-h-dvh bg-white">

        {/* ── Nav (signed-in only) ── */}
        {user && (
          <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-neutral-100">
            <div className="mx-auto max-w-[640px] flex items-center h-11 px-4 gap-2">
              <button onClick={() => router.back()}
                className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors -ml-1 shrink-0">
                <ArrowLeft size={17} />
              </button>
              <span className="flex-1 text-center text-[13px] font-medium text-neutral-400 truncate px-2">
                {post.author_username ? `@${post.author_username}` : post.author_name}
              </span>
              {canDelete ? (
                <div className="relative shrink-0">
                  <button onClick={() => setShowMenu(v => !v)}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 transition-colors">
                    <MoreHorizontal size={17} />
                  </button>
                  {showMenu && (
                    <div ref={menuRef} className="absolute right-0 top-10 z-50 w-[160px] rounded-2xl border border-neutral-100 bg-white shadow-xl py-1.5 overflow-hidden">
                      <button disabled={deleting}
                        onClick={async () => {
                          if (!window.confirm("Delete this post?")) return;
                          setDeleting(true);
                          try { await postsApi.delete(post.id); router.push("/feed"); }
                          catch { /**/ } finally { setDeleting(false); }
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-500 hover:bg-neutral-50 transition-colors disabled:opacity-40">
                        <Trash2 size={13} /> {deleting ? "Deleting…" : "Delete post"}
                      </button>
                    </div>
                  )}
                </div>
              ) : <div className="w-8 shrink-0" />}
            </div>
          </header>
        )}

        <main className="mx-auto max-w-[640px] px-4 sm:px-6 fade-up">

          {/* ── Author ── */}
          <div className="flex items-center gap-3 pt-6">
            <Avatar name={post.author_name} b64={post.author_avatar_base64} href={authorHref} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={authorHref} className="text-[14px] font-semibold text-neutral-900 hover:underline underline-offset-2 truncate">
                  {post.author_name}
                </Link>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10.5px] font-medium text-neutral-500">
                  <VisIcon size={9} /> {visMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-neutral-400 flex-wrap">
                {post.author_username && (
                  <Link href={authorHref} className="hover:text-neutral-700 transition-colors">@{post.author_username}</Link>
                )}
                <span className="text-neutral-300">·</span>
                <span className="capitalize">{post.author_role}</span>
                <span className="text-neutral-300">·</span>
                <span>{timeAgo(post.created_at)}</span>
              </div>
            </div>
          </div>

          {/* ── Title ── */}
          <h1 className="mt-5 text-[22px] sm:text-[26px] font-semibold leading-tight tracking-tight text-neutral-950">
            {post.title}
          </h1>

          {/* ── Body ── */}
          <div className="mt-3.5 text-[15px] leading-[1.75] text-neutral-600 whitespace-pre-wrap break-words">
            {renderContent(post.content)}
          </div>

          {/* ── Media ── */}
          {media.length > 0 && <MediaGallery media={media} />}

          {/* ── Tags ── */}
          {post.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Link key={tag} href={`/tag/${tag}`}
                  className="rounded-full bg-neutral-100 border border-neutral-200 px-3 py-1 text-[12px] text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 transition-colors">
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* ── Date ── */}
          <div className="mt-5 flex items-center gap-1.5 text-[12px] text-neutral-400">
            <Clock size={12} strokeWidth={1.5} />
            <span>{formatFullDate(post.created_at)}</span>
          </div>

          {/* ── Stats ── */}
          {(likeCount > 0 || comments.length > 0) && (
            <div className="mt-4 flex items-center gap-4 text-[13px] text-neutral-400 border-t border-neutral-100 pt-3.5">
              {likeCount > 0 && <span><strong className="font-semibold text-neutral-800">{likeCount}</strong> {likeCount === 1 ? "like" : "likes"}</span>}
              {comments.length > 0 && <span><strong className="font-semibold text-neutral-800">{comments.length}</strong> {comments.length === 1 ? "comment" : "comments"}</span>}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center gap-1 mt-3 py-1.5 border-y border-neutral-100 -mx-1">
            <button onClick={handleLike}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] transition-all ${liked ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"}`}>
              <Heart size={15} strokeWidth={liked ? 0 : 1.7} fill={liked ? "currentColor" : "none"} />
              <span>{liked ? "Liked" : "Like"}</span>
            </button>
            {!user && (
              <Link href="/auth/sign-in"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-all">
                <Send size={15} strokeWidth={1.7} />
                <span>Comment</span>
              </Link>
            )}
            <button onClick={handleShare}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] transition-all ${copied ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"}`}>
              <Share2 size={15} strokeWidth={1.7} />
              <span>{copied ? "Copied!" : "Share"}</span>
            </button>
            {user && (
              <button
                onClick={async () => {
                  const prev = saved; setSaved(!prev);
                  try { if (prev) await postsApi.unsave(post.id); else await postsApi.save(post.id); }
                  catch { setSaved(prev); }
                }}
                className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] transition-all ${saved ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"}`}>
                <Bookmark size={15} strokeWidth={1.7} fill={saved ? "currentColor" : "none"} />
                <span>{saved ? "Saved" : "Save"}</span>
              </button>
            )}
          </div>

          {/* ── Comment input ── */}
          <div className="mt-4">
            {user ? (
              <>
                {replyTo && (
                  <div className="mb-3 flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 px-3.5 py-2.5 text-[12.5px] text-neutral-600">
                    <span>Replying to <strong className="font-semibold text-neutral-900">@{replyTo.author_username || replyTo.author_name}</strong></span>
                    <button type="button" onClick={() => { setReplyTo(null); setNewComment(""); }} className="text-neutral-400 hover:text-neutral-700 transition-colors ml-2">
                      <X size={13} />
                    </button>
                  </div>
                )}
                <form onSubmit={handleComment}>
                  <div className="relative">
                    <textarea
                      ref={commentInputRef}
                      value={newComment}
                      onChange={(e) => { setNewComment(e.target.value); updateMentionSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
                      onClick={(e) => updateMentionSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                      onFocus={() => setCommentFocused(true)}
                      onBlur={() => { setCommentFocused(false); setTimeout(() => setShowSuggestions(false), 120); }}
                      placeholder={replyTo ? `Reply to @${replyTo.author_username || replyTo.author_name}…` : "Add a comment…"}
                      rows={commentFocused || newComment ? 3 : 1}
                      className={`w-full rounded-2xl border px-4 py-3 text-[13.5px] bg-neutral-50 outline-none resize-none transition-all leading-relaxed ${
                        commentFocused ? "border-neutral-300 bg-white ring-1 ring-neutral-200 shadow-sm" : "border-neutral-200"
                      }`}
                    />
                    {(commentFocused || newComment) && (
                      <div className="flex justify-end gap-2 mt-2">
                        {newComment && (
                          <button type="button" onClick={() => { setNewComment(""); setReplyTo(null); }}
                            className="px-3.5 py-1.5 rounded-full text-[12px] text-neutral-500 hover:bg-neutral-100 transition-colors">
                            Cancel
                          </button>
                        )}
                        <button type="submit" disabled={!newComment.trim() || submitting}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-700 transition-colors disabled:opacity-30">
                          <Send size={12} />
                          {submitting ? "Posting…" : "Post"}
                        </button>
                      </div>
                    )}
                    {showSuggestions && mentionSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-neutral-100 bg-white shadow-xl overflow-hidden">
                        {mentionSuggestions.map((u) => (
                          <button key={u.id} type="button"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => applyMention(u.username || "")}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left">
                            <span className="text-[13px] font-semibold text-neutral-900">@{u.username}</span>
                            <span className="text-[12px] text-neutral-400">{u.full_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </form>
              </>
            ) : (
              <div className="py-5 text-center border-b border-neutral-100">
                <p className="text-[13px] text-neutral-400">
                  <Link href="/auth/sign-in" className="font-semibold text-neutral-900 hover:underline underline-offset-2">Sign in</Link>
                  {" "}to join the conversation
                </p>
              </div>
            )}
          </div>

          {/* ── Comments ── */}
          <section className="mt-2 pb-28">
            <div className="flex items-center gap-3 py-4">
              <span className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase">
                {comments.length > 0 ? `${comments.length} ${comments.length === 1 ? "Comment" : "Comments"}` : "Comments"}
              </span>
              <div className="flex-1 h-px bg-neutral-100" />
            </div>

            {topLevelComments.length > 0 ? (
              <div>
                {topLevelComments.map((c) => (
                  <CommentNode key={c.id} comment={c} allComments={comments} depth={0} onReply={handleReply} currentUser={user} />
                ))}
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center gap-2">
                <p className="text-[13px] text-neutral-400">No comments yet</p>
                {user && <p className="text-[12px] text-neutral-300">Be the first to comment</p>}
              </div>
            )}
          </section>
        </main>
      </div>

      {showShare && post && (
        <ShareOverlay
          kind="post"
          sharePayload={shareUrl}
          preview={
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-neutral-100">
                <div className="h-7 w-7 rounded-full bg-neutral-900 text-white text-[11px] font-bold grid place-items-center overflow-hidden flex-shrink-0">
                  {post.author_avatar_base64
                    ? <img src={post.author_avatar_base64} alt={post.author_name} className="h-full w-full object-cover" />
                    : post.author_name[0]}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-neutral-900">{post.author_name}</p>
                  {post.author_username && <p className="text-[10px] text-neutral-400">@{post.author_username}</p>}
                </div>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[13px] font-semibold text-neutral-900 line-clamp-2">{post.title}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#d4d4d4" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  {likeCount}
                </span>
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {post.comments_count}
                </span>
              </div>
              </div>
            </div>
          }
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}