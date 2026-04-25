"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { PostCard } from "@/components/post-card";
import { posts as postsApi, type Post } from "@/lib/api";

const ArrowR = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

export function HomeFeedSection() {
  const { user, loading } = useAuth();
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      postsApi.feed().then(setFeedPosts).catch(() => setFeedPosts([]));
    }
  }, [loading, user]);

  if (loading || user) return null;

  return (
    <>
      <style>{`
        .feed-viewall { font-size:.82rem;color:var(--fg-muted);display:inline-flex;align-items:center;gap:5px;text-decoration:none;transition:color .13s; }
        .feed-viewall:hover { color:var(--fg); }
        .nudge-reg { border-radius:9999px;padding:10px 22px;font-size:.83rem;font-weight:600;background:var(--bg);color:var(--fg);text-decoration:none;transition:opacity .13s;white-space:nowrap; }
        .nudge-reg:hover { opacity:.82; }
        .nudge-si { border-radius:9999px;padding:10px 22px;font-size:.83rem;font-weight:500;border:1.5px solid rgba(255,255,255,.2);color:var(--bg);background:transparent;text-decoration:none;transition:border-color .13s;white-space:nowrap; }
        .nudge-si:hover { border-color:rgba(255,255,255,.55); }
        @media(max-width:600px){
          .nudge-inner { flex-direction:column!important; align-items:flex-start!important; }
          .nudge-btns { display:flex; gap:8px; width:100%; }
          .nudge-reg,.nudge-si { flex:1;text-align:center;justify-content:center;display:flex; }
        }
      `}</style>

      <section
        aria-labelledby="feed-heading"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          padding: "clamp(3rem,8vw,6.5rem) clamp(1.25rem,5vw,2.5rem)",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <p style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: ".5rem" }}>Live Feed</p>
              <h2 id="feed-heading" style={{ fontSize: "clamp(1.3rem,2.8vw,2rem)", fontWeight: 700, letterSpacing: "-.022em", color: "var(--fg)" }}>What&apos;s happening at KEC</h2>
            </div>
            <Link href="/feed" className="feed-viewall">View all <ArrowR /></Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {feedPosts.slice(0, 3).map((post) => (
              <PostCard key={post.id} post={post} onDelete={id => setFeedPosts(prev => prev.filter(p => p.id !== id))} />
            ))}
          </div>

          <div style={{ marginTop: "1.5rem", borderRadius: 18, padding: "clamp(1.5rem,4vw,2.5rem) clamp(1.5rem,4vw,2.8rem)", background: "var(--fg)" }}>
            <div className="nudge-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.25rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "clamp(.9rem,2.2vw,1.06rem)", fontWeight: 700, letterSpacing: "-.016em", color: "var(--bg)", marginBottom: ".3rem" }}>
                  Sign in to see your personalised batch feed.
                </p>
                <p style={{ fontSize: ".83rem", color: "rgba(255,255,255,.38)" }}>
                  Posts for your year, reactions, comments, faculty messaging.
                </p>
              </div>
              <div className="nudge-btns" style={{ display: "flex", gap: 9, flexShrink: 0 }}>
                <Link href="/auth/register" className="nudge-reg">Create account</Link>
                <Link href="/auth/sign-in" className="nudge-si">Log in</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}