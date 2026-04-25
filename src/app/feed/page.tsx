"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Rss, BookOpen } from "lucide-react";
import { PostCard } from "@/components/post-card";
import { posts as postsApi, subjects as subjectsApi, type Post, type Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  getFeedStore, setFeedActiveTab, setFeedBatchFilter,
  setCachedPosts, getCachedPosts, setFeedSubjects,
  clearFeedStore, evictPost,
} from "@/lib/feed-store";

function tabKey(tab: string, batchFilter?: number): string {
  return tab === "batch" ? `batch-${batchFilter ?? ""}` : tab;
}

function tabToSubjectId(key: string): number | undefined {
  if (!key.startsWith("subject-")) return undefined;
  const n = parseInt(key.slice(8), 10);
  return isNaN(n) ? undefined : n;
}

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const role      = user?.role;
  const batchYear = user?.batch_year;
  const prevUserId = useRef<number | null | undefined>(undefined);

  // Read initial state from global store (persists across navigation)
  const store = getFeedStore();
  const [activeTab, setActiveTabState]   = useState<string>(store.activeTab);
  const [batchFilter, setBatchFilterState] = useState<number | undefined>(store.batchFilter);
  const [batchInput, setBatchInput]      = useState(store.batchFilter ? String(store.batchFilter) : "");
  const [mySubjects, setMySubjectsState] = useState<Subject[]>(store.mySubjects);
  const [subjectsLoaded, setSubjectsLoaded] = useState(store.subjectsLoaded);

  // Separate loading states: postsLoading only affects the post list area
  // Start with spinner if there's no cached data (avoids "Nothing here yet" flash)
  const [postsLoading, setPostsLoading] = useState(() => getCachedPosts(store.activeTab) === undefined);
  const [feedPosts, setFeedPosts]       = useState<Post[]>(() => getCachedPosts(store.activeTab) ?? []);

  const canFilterAnyBatch = role === "faculty" || role === "admin";

  // Wrappers that keep global store in sync
  const setActiveTab = useCallback((tab: string) => {
    setFeedActiveTab(tab);
    setActiveTabState(tab);
  }, []);

  const setBatchFilter = useCallback((v: number | undefined) => {
    setFeedBatchFilter(v);
    setBatchFilterState(v);
  }, []);

  // Static tabs — always render default tabs immediately regardless of auth state
  const staticTabs = (() => {
    if (!user) return [
      { key: "all",    label: "For you" },
      { key: "public", label: "Public"  },
    ];
    switch (role) {
      case "admin": return [
        { key: "all",      label: "For you"  },
        { key: "public",   label: "Public"   },
        { key: "students", label: "Students" },
        { key: "batch",    label: "Batch"    },
        { key: "faculty",  label: "Faculty"  },
      ];
      case "faculty": return [
        { key: "all",      label: "For you"  },
        { key: "students", label: "Students" },
        { key: "batch",    label: "Batch"    },
        { key: "faculty",  label: "Faculty"  },
      ];
      case "student": return [
        { key: "all",      label: "For you"  },
        { key: "public",   label: "Public"   },
        { key: "students", label: "Students" },
        ...(batchYear ? [{ key: "batch", label: `Batch ${batchYear}` }] : []),
      ];
      default: return [
        { key: "all",    label: "For you" },
        { key: "public", label: "Public"  },
      ];
    }
  })();

  const subjectTabs = mySubjects.map((s) => ({
    key:   `subject-${s.id}`,
    label: s.name,
    code:  s.code,
  }));

  const allTabsReady = true;   // static tabs always render immediately

  // ── Fetch posts for a tab (uses cache) ──
  const fetchPosts = useCallback(async (tab: string, batchF?: number) => {
    const key = tabKey(tab, batchF);
    const cached = getCachedPosts(key);
    if (cached) {
      setFeedPosts(cached);
      return;
    }

    setPostsLoading(true);
    const subjectId = tabToSubjectId(tab);
    let promise: Promise<Post[]>;

    if (subjectId !== undefined) {
      promise = postsApi.feed(undefined, undefined, subjectId);
    } else if (tab === "all") {
      promise = postsApi.feed(undefined, undefined, undefined);
    } else if (tab === "batch") {
      const by = canFilterAnyBatch ? batchF : (batchYear ?? undefined);
      promise = postsApi.feed("batch", by, undefined);
    } else {
      promise = postsApi.feed(tab, undefined, undefined);
    }

    try {
      const data = await promise;
      // Only cache non-empty results — empty results might be auth timing or genuinely empty;
      // not caching them means the tab always retries on next visit.
      if (data.length > 0) setCachedPosts(key, data);
      setFeedPosts(data);
    } catch {
      setFeedPosts([]);
    } finally {
      setPostsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFilterAnyBatch, batchYear]);

  // ── On mount / user change: load subjects + initial posts in parallel ──
  useEffect(() => {
    if (authLoading) return;

    const uid = user?.id ?? null;

    // If user changed (login/logout), clear everything
    if (prevUserId.current !== undefined && prevUserId.current !== uid) {
      clearFeedStore();
      setMySubjectsState([]);
      setSubjectsLoaded(false);
      setFeedPosts([]);
      setActiveTabState("all");
      setBatchFilterState(undefined);
      setBatchInput("");
    }
    prevUserId.current = uid;

    // Load subjects (if not already cached). Guests skip → mark ready immediately.
    if (!store.subjectsLoaded) {
      if (user) {
        subjectsApi.my()
          .then((subs) => {
            setFeedSubjects(subs);
            setMySubjectsState(subs);
            setSubjectsLoaded(true);
          })
          .catch(() => {
            setFeedSubjects([]);
            setSubjectsLoaded(true);
          });
      } else {
        // Guest has no subjects — mark ready immediately so tabs show without waiting
        setFeedSubjects([]);
        setSubjectsLoaded(true);
      }
    }

    // Load posts for current tab if not cached
    const currentKey = tabKey(store.activeTab, store.batchFilter);
    if (!getCachedPosts(currentKey)) {
      fetchPosts(store.activeTab, store.batchFilter);
    } else {
      setFeedPosts(getCachedPosts(currentKey)!);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  // ── On tab / batch filter change (after mount) ──
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    fetchPosts(activeTab, batchFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, batchFilter]);

  const activeSubject = subjectTabs.find((s) => s.key === activeTab);

  return (
    <>
      <style>{`
        .feed-root { font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin-feed { to { transform: rotate(360deg); } }
        .feed-spinner { animation: spin-feed 0.7s linear infinite; }
      `}</style>

      <div className="feed-root max-w-[600px] mx-auto">

        {/* ── Header — always visible, tabs appear immediately once auth resolves ── */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-100">
          <div className="flex items-center justify-center h-9 sm:h-[46px]">
            <span className="text-[15px] sm:text-[17px] font-medium tracking-[0.14em] text-neutral-700 select-none uppercase">
              Archives
            </span>
          </div>

          {/* Static tabs appear as soon as auth resolves; subject tabs appear once loaded */}
          {allTabsReady && (
            <div className="flex items-center gap-1.5 px-3 pb-2.5 overflow-x-auto no-scrollbar">
              {staticTabs.map(({ key, label }) => (
                <button key={key}
                  onClick={() => { setActiveTab(key); if (key !== "batch") setBatchFilter(undefined); }}
                  className={`flex-shrink-0 px-3.5 py-[5px] rounded-full text-[12.5px] whitespace-nowrap transition-all ${
                    activeTab === key
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  }`}
                >{label}</button>
              ))}
              {subjectsLoaded && subjectTabs.length > 0 && (
                <>
                  <div className="h-4 w-px bg-neutral-200 flex-shrink-0 mx-0.5" />
                  {subjectTabs.map(({ key, label, code }) => (
                    <button key={key}
                      onClick={() => setActiveTab(key)}
                      title={`${label} · ${code}`}
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full text-[12.5px] whitespace-nowrap transition-all ${
                        activeTab === key
                          ? "bg-violet-700 text-white shadow-sm"
                          : "bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
                      }`}
                    >
                      <BookOpen size={10} className="flex-shrink-0 opacity-70" />
                      {label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Active subject banner */}
        {activeSubject && (
          <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
            <BookOpen size={12} className="text-violet-500 flex-shrink-0" />
            <span className="text-[13px] font-semibold text-violet-800">{activeSubject.label}</span>
            <span className="text-[11px] font-mono text-violet-400">{activeSubject.code}</span>
          </div>
        )}

        {/* Batch filter */}
        {activeTab === "batch" && canFilterAnyBatch && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100">
            <input type="text"
              className="w-[78px] rounded-xl bg-white border border-neutral-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-neutral-400 transition-colors"
              placeholder="2025" value={batchInput}
              onChange={(e) => setBatchInput(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4}
              onKeyDown={(e) => { if (e.key === "Enter" && batchInput.length === 4) setBatchFilter(parseInt(batchInput, 10)); }} />
            <button onClick={() => { if (batchInput.length === 4) setBatchFilter(parseInt(batchInput, 10)); }}
              disabled={batchInput.length !== 4}
              className="rounded-xl bg-neutral-900 px-3 py-1.5 text-[12.5px] text-white disabled:opacity-25 transition-opacity">Filter</button>
            {batchFilter && (
              <span className="text-[12px] text-neutral-400">
                {batchFilter} —{" "}
                <button onClick={() => { setBatchFilter(undefined); setBatchInput(""); }}
                  className="underline underline-offset-2 hover:text-neutral-600">clear</button>
              </span>
            )}
          </div>
        )}
        {activeTab === "batch" && !canFilterAnyBatch && batchYear && (
          <div className="px-4 py-2 border-b border-neutral-100 text-[12px] text-neutral-400">
            Batch {batchYear}
          </div>
        )}

        {/* ── Post list — spinner only here, never hides the header ── */}
        {postsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="feed-spinner h-[18px] w-[18px] rounded-full border-[1.5px] border-neutral-200 border-t-neutral-500" />
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-2">
            <Rss size={20} strokeWidth={1.4} className="text-neutral-300" />
            <p className="text-[14px] text-neutral-500">Nothing here yet</p>
            <p className="text-[12px] text-neutral-300">
              {activeSubject ? `No posts in ${activeSubject.label} yet` : "Check back later"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {feedPosts.map((post) => (
              <div key={post.id} className="px-4 py-3.5">
                <PostCard
                  post={post}
                  onDelete={(id) => {
                    evictPost(id);
                    setFeedPosts((prev) => prev.filter((p) => p.id !== id));
                  }}
                />
              </div>
            ))}
          </div>
        )}


      </div>
    </>
  );
}
