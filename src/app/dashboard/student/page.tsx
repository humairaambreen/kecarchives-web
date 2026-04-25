"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen, Newspaper, MessageSquare, Search,
  ArrowRight, Sparkles, ChevronRight, Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { subjects as subjectsApi, posts as postsApi, type Subject, type Post } from "@/lib/api";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("Hello");
  const [mySubjects, setMySubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  useEffect(() => {
    if (!user) return;
    subjectsApi.my()
      .then(setMySubjects)
      .catch(() => setMySubjects([]))
      .finally(() => setSubjectsLoading(false));

    postsApi.feed(undefined, user.batch_year ?? undefined)
      .then((data) => setRecentPosts(data.slice(0, 5)))
      .catch(() => setRecentPosts([]))
      .finally(() => setPostsLoading(false));
  }, [user]);

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center py-20">
        <BookOpen size={32} className="text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Sign in to view your dashboard</p>
      </main>
    );
  }

  const firstName = user.full_name.split(" ")[0];

  return (
    <main className="space-y-5 pb-24 animate-fade">

      {/* Welcome banner */}
      <div className="rounded-2xl bg-black p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-yellow-400" />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Student Dashboard</span>
        </div>
        <h1 className="text-xl font-bold">{greeting}, {firstName}</h1>
        {user.batch_year && (
          <p className="text-sm text-gray-400 mt-1">Batch of {user.batch_year}</p>
        )}
      </div>

      {/* My Subjects */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">My Subjects</h2>
          {mySubjects.length > 0 && (
            <Link href="/feed?filter=subject" className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5 transition-colors">
              View posts <ChevronRight size={12} />
            </Link>
          )}
        </div>

        {subjectsLoading ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shrink-0 w-40 h-20 rounded-xl border bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : mySubjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <BookOpen size={20} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No subjects enrolled yet. Your faculty will add you.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {mySubjects.map((sub) => (
              <Link
                key={sub.id}
                href={`/feed?filter=subject&subject_id=${sub.id}`}
                className="shrink-0 w-44 rounded-xl border bg-white p-3.5 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white text-[10px] font-bold mb-2 shrink-0">
                  {sub.code.slice(0, 3)}
                </div>
                <p className="text-[12.5px] font-semibold text-gray-900 leading-tight line-clamp-1">{sub.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{sub.code}</p>
                <div className="flex items-center gap-1 mt-2 text-[10.5px] text-gray-400">
                  <Users size={10} />
                  <span>{sub.member_count} members</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent posts for my subjects */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Updates</h2>
          <Link href="/feed" className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5 transition-colors">
            All posts <ChevronRight size={12} />
          </Link>
        </div>

        {postsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl border bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <Newspaper size={20} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No posts yet. Check back later.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                href={`/${post.author_username || "post"}/${post.slug}`}
                className="flex items-start gap-3 rounded-xl border p-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gray-100 grid place-items-center overflow-hidden shrink-0">
                  {post.author_avatar_base64
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={post.author_avatar_base64} alt="" className="h-full w-full object-cover" />
                    : <span className="text-[11px] font-semibold text-gray-500">{post.author_name[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-900 line-clamp-1">{post.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{post.author_name}
                    {post.subject_name && <span className="ml-1 text-blue-500">· {post.subject_name}</span>}
                  </p>
                </div>
                <ChevronRight size={13} className="text-gray-300 shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/feed" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-gray-50 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 shrink-0">
              <Newspaper size={18} />
            </div>
            <div>
              <p className="text-sm font-medium">Feed</p>
              <p className="text-[10.5px] text-gray-400">All posts</p>
            </div>
          </Link>
          <Link href="/messages" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-gray-50 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600 shrink-0">
              <MessageSquare size={18} />
            </div>
            <div>
              <p className="text-sm font-medium">Messages</p>
              <p className="text-[10.5px] text-gray-400">Conversations</p>
            </div>
          </Link>
          <Link href="/search" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-gray-50 transition-colors col-span-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600 shrink-0">
              <Search size={18} />
            </div>
            <div>
              <p className="text-sm font-medium">Explore</p>
              <p className="text-[10.5px] text-gray-400">Find people and posts</p>
            </div>
            <ArrowRight size={15} className="text-gray-300 ml-auto" />
          </Link>
        </div>
      </section>

    </main>
  );
}
