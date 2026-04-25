"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Hash } from "lucide-react";
import { PostCard } from "@/components/post-card";
import { posts as postsApi, type Post } from "@/lib/api";

export default function TagClient({ tag }: { tag: string }) {
  const [tagPosts, setTagPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    postsApi
      .byTag(tag)
      .then(setTagPosts)
      .catch(() => setTagPosts([]))
      .finally(() => setLoading(false));
  }, [tag]);

  return (
    <div className="pb-24">
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Feed
      </Link>

      <div className="mt-4 flex items-center gap-2 mb-6">
        <Hash size={20} className="text-gray-400" />
        <h1 className="text-xl font-semibold tracking-tight">{decodeURIComponent(tag)}</h1>
        <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
          {tagPosts.length} {tagPosts.length === 1 ? "post" : "posts"}
        </span>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div ref={feedRef} className="space-y-5">
          {tagPosts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={(id) => setTagPosts((prev) => prev.filter((p) => p.id !== id))} />
          ))}
          {tagPosts.length === 0 && (
            <div className="py-16 text-center">
              <Hash size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No posts with this tag</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
