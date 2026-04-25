"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { auth, posts as postsApi, type UserProfile, type Post } from "@/lib/api";
import { getLikeState, setLikeState } from "@/lib/feed-store";
import { postCache, profileCache, parsePostUrl } from "@/lib/msg-share-cache";
import { useAuth } from "@/lib/auth-context";

// ── Shared Post Card ──────────────────────────────────────────────────────────

export function SharedPostCard({ url, mine }: { url: string; mine: boolean }) {
  const { user } = useAuth();
  const parsed   = parsePostUrl(url);
  const slug     = parsed?.slug ?? "";

  const [post,   setPost]   = useState<Post | null>(() => { const c = postCache.get(slug); return c && c !== "loading" && c !== "error" ? c as Post : null; });
  const [status, setStatus] = useState<"loading" | "ok" | "error">(() => { const c = postCache.get(slug); return !c ? "loading" : c === "error" ? "error" : c === "loading" ? "loading" : "ok"; });
  const [liked,  setLiked]  = useState(false);
  const [likes,  setLikes]  = useState(0);
  const [saved,  setSaved]  = useState(false);
  const liking = useRef(false);

  useEffect(() => {
    if (!slug) return;
    const cached = postCache.get(slug);
    if (cached && cached !== "loading") {
      if (cached !== "error") { const p = cached as Post; setPost(p); const s = getLikeState(p.id); setLiked(s ? s.liked : !!p.user_reacted); setLikes(s ? s.count : p.reactions_count); setSaved(!!(p as {user_saved?:boolean}).user_saved); setStatus("ok"); }
      else setStatus("error");
      return;
    }
    postCache.set(slug, "loading");
    postsApi.get(slug)
      .then(p => { postCache.set(slug, p as Post); setPost(p as Post); const s = getLikeState(p.id); setLiked(s ? s.liked : !!p.user_reacted); setLikes(s ? s.count : p.reactions_count); setSaved(!!(p as {user_saved?:boolean}).user_saved); setStatus("ok"); })
      .catch(() => { postCache.set(slug, "error"); setStatus("error"); });
  }, [slug]);

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user || !post || liking.current) return;
    liking.current = true;
    const pl = liked, pc = likes;
    setLiked(!pl); setLikes(pl ? pc-1 : pc+1);
    try { const r = await postsApi.react(post.id, "like"); setLiked(r.active); setLikes(r.count); setLikeState(post.id, r.active, r.count); postCache.set(slug, { ...post, user_reacted: r.active, reactions_count: r.count }); }
    catch { setLiked(pl); setLikes(pc); }
    finally { liking.current = false; }
  }

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user || !post) return;
    const prev = saved; setSaved(!prev);
    try { if (prev) await postsApi.unsave(post.id); else await postsApi.save(post.id); }
    catch { setSaved(prev); }
  }

  // Colors
  const bg    = mine ? "rgba(255,255,255,0.11)" : "#ffffff";
  const bdr   = mine ? "1px solid rgba(255,255,255,0.16)" : "1px solid #e8e8e8";
  const pri   = mine ? "#ffffff"                 : "#111111";
  const sec   = mine ? "rgba(255,255,255,0.5)"   : "#888888";
  const divC  = mine ? "rgba(255,255,255,0.1)"   : "#f0f0f0";
  const icoC  = mine ? "rgba(255,255,255,0.35)"  : "#d0d0d0";

  const postHref = post ? `/${post.author_username || "post"}/${post.slug}` : url;

  // Skeleton
  if (status === "loading" || !post) return (
    <div className="max-w-[268px] w-full rounded-2xl overflow-hidden my-1" style={{ background: bg, border: bdr }}>
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2.5" style={{ borderBottom: `1px solid ${divC}` }}>
        <div className="h-8 w-8 rounded-full flex-shrink-0" style={{ background: icoC }} />
        <div className="flex-1 space-y-1.5"><div className="h-3 rounded" style={{ background: icoC, width: "55%" }} /><div className="h-2.5 rounded" style={{ background: icoC, width: "35%" }} /></div>
      </div>
      <div className="px-3.5 py-3 space-y-2"><div className="h-3.5 rounded" style={{ background: icoC, width: "90%" }} /><div className="h-3.5 rounded" style={{ background: icoC, width: "70%" }} /></div>
    </div>
  );

  if (status === "error") return (
    <a href={url} className="block px-3 py-2 rounded-xl text-[12px] underline my-1" style={{ color: sec, border: bdr, background: bg }}>View post →</a>
  );

  return (
    <div className="max-w-[268px] w-full rounded-2xl overflow-hidden my-1" style={{ background: bg, border: bdr }}>
      {/* Author */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2.5" style={{ borderBottom: `1px solid ${divC}` }}>
        <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 grid place-items-center text-[12px] font-bold flex-shrink-0"
          style={{ background: mine ? "rgba(255,255,255,0.2)" : "#171717", color: "white" }}>
          {post.author_avatar_base64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={post.author_avatar_base64} alt={post.author_name} className="h-full w-full object-cover" />
            : post.author_name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold leading-tight truncate" style={{ color: pri }}>{post.author_name}</p>
          {post.author_username && <p className="text-[10.5px] leading-tight" style={{ color: sec }}>@{post.author_username}</p>}
        </div>
      </div>
      {/* Body */}
      <Link href={postHref} className="block px-3.5 py-3 active:opacity-70" style={{ textDecoration: "none" }}>
        <p className="text-[13.5px] font-semibold leading-snug line-clamp-2" style={{ color: pri }}>{post.title}</p>
        {post.content && <p className="text-[12px] leading-relaxed line-clamp-3 mt-1" style={{ color: sec }}>{post.content}</p>}
      </Link>
      {/* Actions */}
      <div className="flex items-center px-3.5 pb-3 pt-1 gap-3" style={{ borderTop: `1px solid ${divC}` }}>
        {/* Like — red when liked */}
        <button onClick={handleLike} className="flex items-center gap-1 active:opacity-60 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={liked ? "#ef4444" : "none"}
            stroke={liked ? "#ef4444" : icoC}
            strokeWidth={liked ? 0 : 1.8}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {likes > 0 && <span className="text-[12px]" style={{ color: liked ? "#ef4444" : sec }}>{likes}</span>}
        </button>
        {/* Comments */}
        <div className="flex items-center gap-1">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={icoC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {post.comments_count > 0 && <span className="text-[12px]" style={{ color: sec }}>{post.comments_count}</span>}
        </div>
        {/* Save */}
        <button onClick={handleSave} className="ml-auto active:opacity-60 transition-opacity">
          <svg width="13" height="13" viewBox="0 0 24 24"
            fill={saved ? (mine ? "white" : "#171717") : "none"}
            stroke={saved ? (mine ? "white" : "#171717") : icoC}
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Shared Profile Card ───────────────────────────────────────────────────────

export function SharedProfileCard({ username, mine }: { username: string; mine: boolean }) {
  const uname = username.replace(/^@/, "");
  const [profile, setProfile] = useState<UserProfile | null>(() => { const c = profileCache.get(uname); return c && c !== "loading" && c !== "error" ? c as UserProfile : null; });
  const [status,  setStatus]  = useState<"loading" | "ok" | "error">(() => { const c = profileCache.get(uname); return !c ? "loading" : c === "error" ? "error" : c === "loading" ? "loading" : "ok"; });

  useEffect(() => {
    if (!uname) return;
    const cached = profileCache.get(uname);
    if (cached && cached !== "loading") { if (cached !== "error") { setProfile(cached as UserProfile); setStatus("ok"); } else setStatus("error"); return; }
    profileCache.set(uname, "loading");
    auth.profileByUsername(uname)
      .then(p => { profileCache.set(uname, p); setProfile(p); setStatus("ok"); })
      .catch(() => { profileCache.set(uname, "error"); setStatus("error"); });
  }, [uname]);

  const profileUrl = `/${uname}`;

  if (status === "error") return (
    <div className="max-w-[250px] w-full px-3 py-2.5 rounded-xl text-[12px] my-1"
      style={{ background: mine ? "rgba(255,255,255,0.1)" : "#f5f5f5", border: mine ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e8e8e8" }}>
      <p style={{ color: mine ? "rgba(255,255,255,0.5)" : "#888" }}>Profile @{uname} not found</p>
    </div>
  );

  if (status === "loading" || !profile) return (
    <div className="max-w-[250px] w-full rounded-2xl overflow-hidden my-1" style={{ background: "#fff", border: "1px solid #e8e8e8" }}>
      <div className="h-[80px]" style={{ background: "#f0f0f0" }} />
      <div className="px-4 pb-4" style={{ marginTop: -28 }}>
        <div className="h-[54px] w-[54px] rounded-full mb-2.5" style={{ background: "#e0e0e0", border: "3px solid white" }} />
        <div className="space-y-2"><div className="h-4 rounded" style={{ background: "#e8e8e8", width: "60%" }} /><div className="h-3 rounded" style={{ background: "#e8e8e8", width: "40%" }} /></div>
      </div>
    </div>
  );

  const roleBg    = profile.role === "faculty" ? "#f3f0ff" : profile.role === "admin" ? "#fef3f2" : "#f0fdf4";
  const roleColor = profile.role === "faculty" ? "#7c3aed"  : profile.role === "admin" ? "#dc2626"  : "#15803d";

  return (
    // Entire card is a link — clicking anywhere opens profile
    <Link href={profileUrl} className="block max-w-[250px] w-full rounded-2xl overflow-hidden my-1 active:opacity-90 transition-opacity"
      style={{ background: "#ffffff", border: "1px solid #e8e8e8", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", textDecoration: "none" }}>
      {/* Banner */}
      <div className="relative h-[80px] overflow-hidden">
        {profile.banner_base64
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={profile.banner_base64} alt="" className="absolute inset-0 h-full w-full object-cover" />
          : <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#1a1a2e,#0f3460)" }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.25) 100%)" }} />
      </div>

      {/* Avatar — sits on top of banner using negative margin, z-index ensures it's above */}
      <div className="relative px-4 pb-4">
        <div className="relative z-10 h-[54px] w-[54px] rounded-full border-[3px] border-white overflow-hidden grid place-items-center bg-neutral-900 text-white text-[18px] font-bold shadow-lg"
          style={{ marginTop: -27 }}>
          {profile.avatar_base64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.avatar_base64} alt={profile.full_name} className="h-full w-full object-cover" />
            : profile.full_name[0]?.toUpperCase()}
        </div>

        <p className="text-[15px] font-bold text-neutral-900 leading-tight mt-2">{profile.full_name}</p>
        <p className="text-[12px] text-neutral-400 mt-0.5">@{uname}</p>
        {profile.bio && <p className="text-[12px] text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed">{profile.bio}</p>}

        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
            style={{ background: roleBg, color: roleColor }}>{profile.role}</span>
          {profile.batch_year && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600">
              Batch {profile.batch_year}
            </span>
          )}
        </div>

        {/* Message button — navigates to DM with this user */}
        <div
          onClick={(e) => { e.preventDefault(); window.location.href = `/messages/${uname}`; }}
          className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[13px] font-semibold cursor-pointer"
          style={{ background: "#171717", color: "#ffffff" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Message
        </div>
      </div>
    </Link>
  );
}
