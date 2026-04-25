"use client";

import Link from "next/link";
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, Bookmark, Play, FileText } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { posts as postsApi, type Post, type PostMedia } from "@/lib/api";
import { getLikeState, setLikeState } from "@/lib/feed-store";
import ShareOverlay from "@/components/share-overlay";

function timeAgo(iso: string) {
  // Append Z if no timezone info — prevents local-time misparse (e.g. IST +5:30 offset)
  const normalized = iso.endsWith("Z") || iso.includes("+") || iso.includes("-", 10) ? iso : iso + "Z";
  const d = new Date(normalized);
  const diff = Date.now() - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderContent(text: string): ReactNode[] {
  const parts = text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("#"))
      return <Link key={i} href={`/tag/${part.slice(1)}`} className="text-neutral-500 hover:text-neutral-800 transition-colors">{part}</Link>;
    if (part.startsWith("@"))
      return <Link key={i} href={`/${part.slice(1)}`} className="text-neutral-700 font-medium hover:underline">{part}</Link>;
    return <span key={i}>{part}</span>;
  });
}

function MediaPreview({ media, href }: { media: PostMedia[]; href: string }) {
  const images = media.filter((m) => m.file_type.startsWith("image/"));
  const videos = media.filter((m) => m.file_type.startsWith("video/"));
  const audios = media.filter((m) => m.file_type.startsWith("audio/"));
  const docs = media.filter(
    (m) =>
      !m.file_type.startsWith("image/") &&
      !m.file_type.startsWith("video/") &&
      !m.file_type.startsWith("audio/")
  );
  const n = images.length;

  return (
    <div className="mt-2.5 space-y-2">
      {n > 0 && (
        <Link
          href={href}
          className={`block rounded-2xl overflow-hidden ${
            n === 1 ? "" : "grid grid-cols-2 gap-[2px] bg-neutral-100"
          }`}
        >
          {images.slice(0, 4).map((img, idx) => (
            <div
              key={img.id}
              className={`relative overflow-hidden bg-neutral-100 ${
                n === 1
                  ? "aspect-[16/9] max-h-[260px]"
                  : n === 3 && idx === 0
                  ? "row-span-2"
                  : "aspect-square"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.file_url}
                alt={img.file_name}
                className="h-full w-full object-cover hover:scale-[1.02] transition-transform duration-300"
              />
              {idx === 3 && n > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-base font-medium">+{n - 4}</span>
                </div>
              )}
            </div>
          ))}
        </Link>
      )}

      {(videos.length > 0 || audios.length > 0 || docs.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {videos.length > 0 && (
            <Link href={href} className="flex items-center gap-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors px-3 py-1.5 text-[12px] text-neutral-500">
              <Play size={11} strokeWidth={1.5} /> {videos.length} video{videos.length > 1 ? "s" : ""}
            </Link>
          )}
          {audios.length > 0 && (
            <Link href={href} className="flex items-center gap-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors px-3 py-1.5 text-[12px] text-neutral-500">
              <Play size={11} strokeWidth={1.5} /> {audios.length} audio
            </Link>
          )}
          {docs.length > 0 && (
            <Link href={href} className="flex items-center gap-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors px-3 py-1.5 text-[12px] text-neutral-500">
              <FileText size={11} strokeWidth={1.5} /> {docs.length} file{docs.length > 1 ? "s" : ""}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function PostCard({ post, onDelete }: { post: Post; onDelete?: (id: number) => void }) {
  const { user } = useAuth();
  const router = useRouter();
  // Use persistent like state from store if available (survives tab switches/remounts)
  const storedLike = getLikeState(post.id);
  const [liked, setLiked] = useState<boolean>(storedLike !== undefined ? storedLike.liked : !!post.user_reacted);
  const [likeCount, setLikeCount] = useState<number>(storedLike !== undefined ? storedLike.count : post.reactions_count);
  const [copied, _setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(post.user_saved || false);
  const [showShare, setShowShare] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowMenu(false);
    }
    if (showMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  const effectiveRole = user?.batch_year ? "student" : user?.role;
  const canDelete =
    user &&
    (effectiveRole === "admin" ||
      effectiveRole === "faculty" ||
      post.author_id === user.id);

  function requireAuth() {
    if (!user) {
      router.push("/auth/sign-in");
      return true;
    }
    return false;
  }

  const likingRef = useRef(false);

  async function handleLike() {
    if (requireAuth()) return;
    if (likingRef.current) return;    // block concurrent taps
    likingRef.current = true;
    const prevL = liked, prevC = likeCount;
    // Optimistic update
    setLiked(!prevL);
    setLikeCount(prevL ? prevC - 1 : prevC + 1);
    try {
      const res = await postsApi.react(post.id, "like");
      setLiked(res.active);
      setLikeCount(res.count);
      // Persist like state so remounted cards don't reset to stale prop values
      setLikeState(post.id, res.active, res.count);
    } catch {
      setLiked(prevL);
      setLikeCount(prevC);
    } finally {
      likingRef.current = false;
    }
  }

  const postHref = `/${post.author_username || "post"}/${post.slug}`;

  const shareUrl = `${window.location.origin}${postHref}`;

  function handleShare() {
    setShowShare(true);
  }

  const authorHref = post.author_username ? `/${post.author_username}` : "#";

  return (
    <>
    <article className="flex gap-2.5">
      {/* Avatar — black */}
      <Link
        href={authorHref}
        className="shrink-0 mt-0.5 h-8 w-8 rounded-full bg-neutral-900 text-white text-[11px] font-medium grid place-items-center overflow-hidden"
      >
        {post.author_avatar_base64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.author_avatar_base64} alt={post.author_name} className="h-full w-full object-cover" />
        ) : (
          post.author_name[0]
        )}
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">

        {/* Author row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <Link
              href={authorHref}
              className="text-[13.5px] font-medium text-neutral-900 hover:underline underline-offset-2 truncate leading-none"
            >
              {post.author_name}
            </Link>
            <span className="text-[12px] text-neutral-400 shrink-0 leading-none">
              · {timeAgo(post.created_at)}
            </span>
          </div>

          {/* Menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-1 -mr-1 text-neutral-300 hover:text-neutral-600 transition-colors rounded-full"
            >
              <MoreHorizontal size={15} />
            </button>
            {showMenu && canDelete && (
              <div
                ref={menuRef}
                className="absolute right-0 top-7 z-50 w-[148px] rounded-xl border border-neutral-100 bg-white shadow-lg shadow-neutral-200/80 py-1 overflow-hidden"
              >
                <button
                  disabled={deleting}
                  onClick={async () => {
                    if (!window.confirm("Delete this post?")) return;
                    setDeleting(true);
                    try {
                      await postsApi.delete(post.id);
                      setShowMenu(false);
                      onDelete?.(post.id);
                    } catch {
                      /* */
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-red-500 hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 size={13} />
                  {deleting ? "Deleting…" : "Delete post"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <Link href={postHref} className="block mt-1">
          <h3 className="text-[14px] font-semibold leading-snug text-neutral-900">
            {post.title}
          </h3>
        </Link>

        {/* Body */}
        <div className="mt-0.5 text-[13.5px] leading-[1.55] text-neutral-500 line-clamp-3">
          {renderContent(post.content)}
        </div>

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <MediaPreview media={post.media} href={postHref} />
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/tag/${tag}`}
                className="text-[12px] text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-3 mt-2 -ml-1">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 transition-colors group ${
              liked ? "text-red-500" : "text-neutral-400 hover:text-red-400"
            }`}
          >
            <Heart
              size={15}
              strokeWidth={liked ? 0 : 1.5}
              fill={liked ? "currentColor" : "none"}
              className="transition-transform group-active:scale-125"
            />
            {likeCount > 0 && (
              <span className="text-[12px] tabular-nums">{likeCount}</span>
            )}
          </button>

          {/* Comment */}
          <Link
            href={user ? postHref : "/auth/sign-in"}
            className="flex items-center gap-1 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <MessageCircle size={15} strokeWidth={1.5} />
            {post.comments_count > 0 && (
              <span className="text-[12px] tabular-nums">{post.comments_count}</span>
            )}
          </Link>

          {/* Share */}
          <button
            onClick={handleShare}
            className={`transition-colors ${
              copied ? "text-neutral-700" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <Share2 size={15} strokeWidth={1.5} />
          </button>

          {/* Save */}
          {user && (
            <button
              onClick={async () => {
                const prev = saved;
                setSaved(!prev);
                try {
                  if (prev) await postsApi.unsave(post.id);
                  else await postsApi.save(post.id);
                } catch {
                  setSaved(prev);
                }
              }}
              className={`ml-auto transition-colors ${
                saved ? "text-neutral-800" : "text-neutral-400 hover:text-neutral-700"
              }`}
            >
              <Bookmark size={15} strokeWidth={1.5} fill={saved ? "currentColor" : "none"} />
            </button>
          )}
        </div>
      </div>
    </article>

    {showShare && (
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