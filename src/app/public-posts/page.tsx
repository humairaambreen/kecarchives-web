"use client";

import { useState, useEffect, useRef } from "react";
import { Globe, Search } from "lucide-react";
import { PostCard } from "@/components/post-card";
import { posts as postsApi, type Post } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors";

export default function PublicPostsPage() {
  const [publicPosts, setPublicPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    postsApi.feed("public").then(setPublicPosts).catch(() => setPublicPosts([])).finally(() => setLoading(false));
  }, []);

  const filtered = publicPosts.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main ref={containerRef} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Public Posts</h1>
          <p className="text-sm text-gray-500 mt-1">Open academic updates visible to everyone</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className={inputCls}
            style={{ paddingLeft: 32, width: 220 }}
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} onDelete={(id) => setPublicPosts((prev) => prev.filter((p) => p.id !== id))} />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Globe size={32} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-500">No posts found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
