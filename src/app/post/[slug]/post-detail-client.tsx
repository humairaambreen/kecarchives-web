"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AtSign, Heart, MessageCircle, Share2, Bookmark, ArrowLeft, Send, Clock, Globe, CheckCheck } from "lucide-react";
import { auth, posts as postsApi, type PostDetail, type Comment, type UserProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const mins = Math.floor((now - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors";

export default function PostDetailClient({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<UserProfile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      // Force a soft rerender so relative timestamps stay fresh.
      setPost((prev) => (prev ? { ...prev } : prev));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    postsApi.get(slug)
      .then((data) => {
        setPost({ ...data, comments: Array.isArray(data.comments) ? data.comments : [] });
        if (data.user_reacted) setLiked(true);
        if ((data as Record<string, unknown>).user_saved) setSaved(true);
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !post) return;
    setSubmitting(true);
    try {
      const created = await postsApi.comment(post.id, newComment, replyTo?.id ?? null) as Comment;
      setPost((prev) => {
        if (!prev) return prev;
        const prevComments = Array.isArray(prev.comments) ? prev.comments : [];
        return {
          ...prev,
          comments: [...prevComments, created],
          comments_count: prev.comments_count + 1,
        };
      });
    } catch {
      /* */
    }
    setNewComment("");
    setReplyTo(null);
    setShowSuggestions(false);
    setSubmitting(false);
  }

  function updateMentionSuggestions(value: string, caretPos: number) {
    const before = value.slice(0, caretPos);
    const match = before.match(/(^|\s)@([a-zA-Z0-9_]*)$/);
    if (!match) {
      setShowSuggestions(false);
      setMentionSuggestions([]);
      return;
    }
    const q = (match[2] || "").toLowerCase();
    auth.searchUsers(q)
      .then((users) => {
        setMentionSuggestions(users.filter((u) => !!u.username).slice(0, 6));
        setShowSuggestions(true);
      })
      .catch(() => {
        setMentionSuggestions([]);
        setShowSuggestions(false);
      });
  }

  function applyMention(username: string) {
    const input = commentInputRef.current;
    if (!input) return;
    const caret = input.selectionStart ?? newComment.length;
    const before = newComment.slice(0, caret);
    const after = newComment.slice(caret);
    const replaced = before.replace(/(^|\s)@([a-zA-Z0-9_]*)$/, `$1@${username}`);
    const next = `${replaced} ${after}`;
    setNewComment(next);
    setShowSuggestions(false);
    requestAnimationFrame(() => {
      input.focus();
      const pos = replaced.length + 1;
      input.setSelectionRange(pos, pos);
    });
  }

  async function handleLike() {
    if (!post) return;
    setLiked(!liked);
    try {
      await postsApi.react(post.id, "like");
    } catch {
      setLiked((prev) => !prev);
    }
  }

  if (loading) {
    return (
      <main className="grid place-items-center py-32 max-w-3xl mx-auto">
        <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!post) return null;

  return (
    <main ref={containerRef} className="space-y-5 max-w-3xl mx-auto">
      <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black transition-colors">
        <ArrowLeft size={14} />
        Back to Feed
      </Link>

      {/* Article */}
      <article className="rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-black text-white text-sm font-semibold">
            {post.author_avatar_base64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.author_avatar_base64} alt={`${post.author_name} avatar`} className="h-full w-full rounded-full object-cover" />
            ) : (
              post.author_name[0]
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{post.author_name}</p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="capitalize">{post.author_role}</span>
              <span>·</span>
              <Clock size={11} />
              <span>{timeAgo(post.created_at)}</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Globe size={13} className="text-gray-400" />
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 capitalize">{post.visibility}</span>
          </div>
        </div>

        <h1 className="text-xl font-semibold tracking-tight">{post.title}</h1>
        <p className="mt-3 text-sm leading-7 text-gray-600">{post.content}</p>

        {post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">{tag}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-1">
          <button onClick={handleLike} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${liked ? "text-red-500" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}>
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
            {post.reactions_count + (liked ? 1 : 0)}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gray-500 hover:text-black hover:bg-gray-100 transition-colors">
            <MessageCircle size={16} />
            {post.comments_count}
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/post/${post.slug}`;
              if (navigator.share) {
                navigator.share({ title: post.title, url }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${copied ? "text-green-600" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}
          >
            {copied ? <CheckCheck size={16} /> : <Share2 size={16} />}
            {copied ? "Copied!" : "Share"}
          </button>
          <button
            onClick={async () => {
              if (!user) return;
              const prev = saved;
              setSaved(!prev);
              try {
                if (prev) await postsApi.unsave(post.id);
                else await postsApi.save(post.id);
              } catch { setSaved(prev); }
            }}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm ml-auto transition-colors ${!user ? "hidden" : saved ? "text-black" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}
          >
            <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </article>

      {/* Comments */}
      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold mb-4">Comments ({Array.isArray(post.comments) ? post.comments.length : 0})</h2>

        <div className="space-y-4">
          {(Array.isArray(post.comments) ? post.comments : []).map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black text-white text-[10px] font-semibold">
                {c.author_avatar_base64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.author_avatar_base64} alt={`${c.author_name} avatar`} className="h-full w-full rounded-full object-cover" />
                ) : (
                  c.author_name[0]
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{c.author_name}</p>
                  {c.author_username && <p className="text-xs text-gray-400">@{c.author_username}</p>}
                  <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                </div>
                {c.reply_to_comment_id && (() => {
                  const parentComment = (Array.isArray(post.comments) ? post.comments : []).find((pc) => pc.id === c.reply_to_comment_id);
                  return (
                    <p className="text-xs text-blue-500 mt-0.5">
                      @{parentComment?.author_username || parentComment?.author_name || "user"}
                    </p>
                  );
                })()}
                <p className="text-sm text-gray-600 mt-1">{c.content}</p>
                {user && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(c);
                      setNewComment((prev) => {
                        const mention = c.author_username ? `@${c.author_username} ` : "";
                        return prev.startsWith(mention) ? prev : `${mention}${prev}`;
                      });
                      requestAnimationFrame(() => commentInputRef.current?.focus());
                    }}
                    className="mt-1 text-xs text-gray-400 hover:text-black"
                  >
                    Reply
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {user ? (
          <form onSubmit={handleComment} className="mt-5 pt-4 border-t border-gray-100">
            {replyTo && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
                <span>Replying to {replyTo.author_name}</span>
                <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-black">Cancel</button>
              </div>
            )}
            <div className="relative flex gap-2">
              <input
                ref={commentInputRef}
                type="text"
                className={inputCls + " flex-1"}
                placeholder="Write a comment... Use @username"
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  updateMentionSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onClick={(e) => updateMentionSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              />
              <button type="submit" disabled={!newComment.trim() || submitting} className="inline-flex items-center rounded-full bg-black px-3 py-2 text-white hover:bg-gray-800 transition-colors disabled:opacity-50">
                <Send size={14} />
              </button>

              {showSuggestions && mentionSuggestions.length > 0 && (
                <div className="absolute left-0 right-12 top-full z-20 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                  {mentionSuggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => applyMention(u.username || "")}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <AtSign size={13} className="text-gray-400" />
                      <span className="font-medium">{u.username}</span>
                      <span className="text-xs text-gray-400">{u.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              <Link href="/auth/sign-in" className="font-medium text-black hover:underline">Sign in</Link> to leave a comment
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
