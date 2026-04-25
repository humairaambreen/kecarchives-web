"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search as SearchIcon, FileText, Bookmark } from "lucide-react";
import { auth, posts as postsApi, type UserProfile, type Post } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "users" | "posts" | "saved">("all");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [postResults, setPostResults] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (activeTab === "saved" && user) {
      setLoadingSaved(true);
      postsApi.savedList().then(setSavedPosts).catch(() => setSavedPosts([])).finally(() => setLoadingSaved(false));
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (!query.trim()) { setUsers([]); setPostResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const [userResults, feedResults] = await Promise.all([
          auth.searchUsers(query).catch(() => []),
          postsApi.search(query).catch(() => []),
        ]);
        setUsers(userResults);
        setPostResults(feedResults);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredUsers = activeTab === "posts" ? [] : users;
  const filteredPosts = activeTab === "users" ? [] : postResults;
  const hasResults = filteredUsers.length > 0 || filteredPosts.length > 0;
  const tabs = ["all", "users", "posts", ...(user ? ["saved"] : [])] as const;

  return (
    <>
      <style>{`
        .search-root { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.22s ease forwards; }
        .search-input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #e5e5e5;
          padding: 11px 14px 11px 42px;
          font-size: 13.5px;
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

      <div className="search-root fade-up">

        {/* Search input */}
        <div className="relative mb-5">
          <SearchIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search users, posts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-[1.5px] border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all capitalize flex items-center gap-1.5 ${
                activeTab === tab
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
              }`}
            >
              {tab === "saved" && <Bookmark size={11} />}
              {tab}
            </button>
          ))}
        </div>

        {/* ── Saved tab ── */}
        {activeTab === "saved" && (
          <>
            {loadingSaved ? (
              <div className="grid place-items-center py-20">
                <div className="h-4 w-4 border-[1.5px] border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
              </div>
            ) : savedPosts.length === 0 ? (
              <EmptyState icon={<Bookmark size={24} />} title="No saved posts" sub="Bookmark posts to find them here" />
            ) : (
              <Section label="Saved Posts">
                {savedPosts.map((p) => (
                  <PostRow key={p.id} post={p} saved />
                ))}
              </Section>
            )}
          </>
        )}

        {/* ── Search results ── */}
        {activeTab !== "saved" && (
          <>
            {filteredUsers.length > 0 && (
              <Section label="Users">
                {filteredUsers.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </Section>
            )}

            {filteredPosts.length > 0 && (
              <Section label="Posts" className={filteredUsers.length > 0 ? "mt-6" : ""}>
                {filteredPosts.map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </Section>
            )}

            {query.trim() && !hasResults && !searching && (
              <EmptyState icon={<SearchIcon size={24} />} title="No results found" sub="Try a different search term" />
            )}

            {!query.trim() && (
              <EmptyState icon={<SearchIcon size={24} />} title="Search for users and posts" />
            )}
          </>
        )}

      </div>
    </>
  );
}

/* ── Sub-components ── */

function Section({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase mb-2 px-1">{label}</p>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function UserRow({ user: u }: { user: UserProfile }) {
  return (
    <Link
      href={u.username ? `/${u.username}` : `/profile/${u.id}`}
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-neutral-50 transition-colors group"
    >
      <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-900 text-white grid place-items-center text-[12px] font-semibold shrink-0">
        {u.avatar_base64
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={u.avatar_base64} alt="" className="h-full w-full object-cover" />
          : u.full_name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-neutral-900 truncate leading-tight">{u.full_name}</p>
        <p className="text-[12px] text-neutral-400 truncate mt-0.5">{u.username ? `@${u.username}` : u.email}</p>
      </div>
      <span className="rounded-full bg-neutral-100 border border-neutral-200 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500 capitalize shrink-0">
        {u.role}
      </span>
    </Link>
  );
}

function PostRow({ post: p, saved }: { post: Post; saved?: boolean }) {
  return (
    <Link
      href={`/${p.author_username || "post"}/${p.slug}`}
      className="flex items-start gap-3 rounded-2xl px-3 py-2.5 hover:bg-neutral-50 transition-colors group"
    >
      <div className="mt-0.5 h-7 w-7 rounded-xl bg-neutral-100 border border-neutral-200 grid place-items-center shrink-0">
        {saved
          ? <Bookmark size={13} className="text-neutral-700" fill="currentColor" />
          : <FileText size={13} className="text-neutral-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-neutral-900 truncate leading-tight">{p.title}</p>
        <p className="text-[12px] text-neutral-400 truncate mt-0.5">{p.content.slice(0, 100)}</p>
        <p className="text-[11px] text-neutral-300 mt-1">{p.author_name}</p>
      </div>
    </Link>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="py-20 flex flex-col items-center gap-2">
      <div className="text-neutral-200">{icon}</div>
      <p className="text-[13px] text-neutral-400 font-medium mt-1">{title}</p>
      {sub && <p className="text-[12px] text-neutral-300">{sub}</p>}
    </div>
  );
}