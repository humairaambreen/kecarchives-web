"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap, Newspaper, Plus, BookOpen, Users,
  MessageSquare, ArrowRight, ChevronRight, UserPlus,
  RefreshCw, AlertCircle, Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  subjects as subjectsApi,
  auth as authApi,
  posts as postsApi,
  type Subject,
  type SubjectEnrollment,
  type AdminUser,
  type Post,
} from "@/lib/api";

export default function FacultyDashboardPage() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("Hello");

  // Subjects state
  const [mySubjects, setMySubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [members, setMembers] = useState<SubjectEnrollment[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Assign student state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignMsg, setAssignMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Recent posts
  const [myPosts, setMyPosts] = useState<Post[]>([]);
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
      .then((data) => { setMySubjects(data); if (data.length > 0) setSelectedSubject(data[0]); })
      .catch(() => setMySubjects([]))
      .finally(() => setSubjectsLoading(false));

    postsApi.byUser(user.id)
      .then((data) => setMyPosts(data.slice(0, 5)))
      .catch(() => setMyPosts([]))
      .finally(() => setPostsLoading(false));
  }, [user]);

  // Load members when subject changes
  useEffect(() => {
    if (!selectedSubject) return;
    setMembersLoading(true);
    setMembers([]);
    subjectsApi.members(selectedSubject.id)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [selectedSubject]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await authApi.searchUsers(searchQuery);
        setSearchResults(res.filter((u) => u.role === "student" || u.role === "guest") as AdminUser[]);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  async function assignStudent(userId: number) {
    if (!selectedSubject) return;
    setAssigningId(userId);
    setAssignMsg(null);
    try {
      await subjectsApi.assignStudent(selectedSubject.id, userId);
      setAssignMsg({ type: "ok", text: "Student enrolled successfully." });
      // Refresh members
      const updated = await subjectsApi.members(selectedSubject.id);
      setMembers(updated);
      // Refresh subject counts
      const updatedSubjects = await subjectsApi.my();
      setMySubjects(updatedSubjects);
      const refreshed = updatedSubjects.find((s) => s.id === selectedSubject.id);
      if (refreshed) setSelectedSubject(refreshed);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      setAssignMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to assign student." });
    }
    setAssigningId(null);
  }

  async function removeMember(userId: number) {
    if (!selectedSubject) return;
    if (!confirm("Remove this member from the subject?")) return;
    try {
      await subjectsApi.removeMember(selectedSubject.id, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member.");
    }
  }

  if (!user || (user.role !== "faculty" && user.role !== "admin")) {
    return (
      <main className="flex flex-col items-center justify-center py-20">
        <GraduationCap size={32} className="text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Faculty access required</p>
      </main>
    );
  }

  const firstName = user.full_name.split(" ")[0];
  const students = members.filter((m) => m.role === "student");
  const faculty = members.filter((m) => m.role === "faculty");

  return (
    <main className="space-y-5 pb-24">

      {/* Welcome banner */}
      <div className="rounded-2xl bg-black p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap size={16} className="text-blue-400" />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Faculty Dashboard</span>
        </div>
        <h1 className="text-xl font-bold">{greeting}, {firstName}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {mySubjects.length > 0
            ? `Teaching ${mySubjects.length} subject${mySubjects.length > 1 ? "s" : ""}`
            : "Manage your posts and connect with students"}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/create-post" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-gray-50 transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 shrink-0">
            <Plus size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">New Post</p>
            <p className="text-[10.5px] text-gray-400">Publish update</p>
          </div>
        </Link>
        <Link href="/feed" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-gray-50 transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600 shrink-0">
            <Newspaper size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">View Feed</p>
            <p className="text-[10.5px] text-gray-400">All posts</p>
          </div>
        </Link>
      </div>

      {/* My Subjects */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">My Subjects</h2>
        </div>

        {subjectsLoading ? (
          <div className="h-24 rounded-xl border bg-gray-50 animate-pulse" />
        ) : mySubjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <BookOpen size={20} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">No subjects assigned yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Your admin will assign you to subjects.</p>
          </div>
        ) : (
          <>
            {/* Subject tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mb-4">
              {mySubjects.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => { setSelectedSubject(sub); setAssignMsg(null); setSearchQuery(""); setSearchResults([]); }}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors border ${
                    selectedSubject?.id === sub.id
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>

            {selectedSubject && (
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                {/* Subject header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-900">{selectedSubject.name}</p>
                    <p className="text-[11px] text-gray-400">{selectedSubject.code}
                      {selectedSubject.description && ` · ${selectedSubject.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11.5px] text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
                    <Users size={11} />
                    <span>{students.length} students</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Assign student */}
                  <div>
                    <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Add Student</p>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        className="w-full rounded-xl border border-gray-200 pl-8 pr-4 py-2.5 text-[13px] bg-gray-50 outline-none focus:border-gray-400 focus:bg-white transition-colors"
                        placeholder="Search student by name or email…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searching && <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                    </div>

                    {searchResults.length > 0 && (
                      <div className="mt-1.5 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                        {searchResults.slice(0, 6).map((u) => {
                          const alreadyIn = members.some((m) => m.user_id === u.id);
                          return (
                            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 border-gray-50">
                              <div className="h-7 w-7 rounded-full bg-gray-100 grid place-items-center overflow-hidden shrink-0">
                                {u.avatar_base64
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={u.avatar_base64} alt="" className="h-full w-full object-cover" />
                                  : <span className="text-[10px] font-semibold text-gray-500">{u.full_name[0]}</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12.5px] font-medium text-gray-900 truncate">{u.full_name}</p>
                                <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                              </div>
                              {alreadyIn ? (
                                <span className="text-[11px] text-green-600 font-medium shrink-0">Enrolled</span>
                              ) : (
                                <button
                                  onClick={() => assignStudent(u.id)}
                                  disabled={assigningId === u.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-black text-white px-3 py-1 text-[11.5px] font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0"
                                >
                                  {assigningId === u.id
                                    ? <RefreshCw size={10} className="animate-spin" />
                                    : <UserPlus size={11} />}
                                  Enroll
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {assignMsg && (
                      <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] ${
                        assignMsg.type === "ok"
                          ? "bg-green-50 border border-green-100 text-green-700"
                          : "bg-red-50 border border-red-100 text-red-600"
                      }`}>
                        <AlertCircle size={12} />
                        {assignMsg.text}
                      </div>
                    )}
                  </div>

                  {/* Members list */}
                  <div>
                    <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Enrolled Students ({students.length})
                    </p>
                    {membersLoading ? (
                      <div className="space-y-2">
                        {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-gray-50 animate-pulse" />)}
                      </div>
                    ) : students.length === 0 ? (
                      <p className="text-[12px] text-gray-400 py-2">No students enrolled yet. Use the search above to add students.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {students.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                            <div className="h-7 w-7 rounded-full bg-gray-200 grid place-items-center text-[10px] font-semibold text-gray-600 shrink-0">
                              {m.full_name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-medium text-gray-900 truncate">{m.full_name}</p>
                              {m.username && <p className="text-[11px] text-gray-400">@{m.username}</p>}
                            </div>
                            <button
                              onClick={() => removeMember(m.user_id)}
                              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors shrink-0 px-2 py-1"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {faculty.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Faculty ({faculty.length})
                        </p>
                        <div className="space-y-1.5">
                          {faculty.map((m) => (
                            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                              <div className="h-7 w-7 rounded-full bg-blue-200 grid place-items-center text-[10px] font-semibold text-blue-700 shrink-0">
                                {m.full_name[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12.5px] font-medium text-gray-900 truncate">{m.full_name}</p>
                                <p className="text-[11px] text-blue-500">Faculty</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Post to subject shortcut */}
                  <Link
                    href={`/create-post?visibility=subject_only&subject_id=${selectedSubject.id}`}
                    className="flex items-center justify-between rounded-xl border border-dashed border-gray-200 px-4 py-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Plus size={14} className="text-gray-400" />
                      <span className="text-[12.5px] font-medium text-gray-700">Post to {selectedSubject.name}</span>
                    </div>
                    <ChevronRight size={13} className="text-gray-300" />
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* My recent posts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">My Recent Posts</h2>
          <Link href="/feed" className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5 transition-colors">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {postsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl border bg-gray-50 animate-pulse" />)}
          </div>
        ) : myPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <Newspaper size={20} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No posts yet. Create your first post!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myPosts.map((post) => (
              <Link
                key={post.id}
                href={`/${post.author_username || "post"}/${post.slug}`}
                className="flex items-center gap-3 rounded-xl border p-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-900 line-clamp-1">{post.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                    <span className="capitalize">{post.visibility.replace("_", " ")}</span>
                    {post.subject_name && <><span>·</span><span className="text-blue-500">{post.subject_name}</span></>}
                    <span>·</span>
                    <span>{post.reactions_count} 👍</span>
                    <span>{post.comments_count} 💬</span>
                  </p>
                </div>
                <ChevronRight size={13} className="text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* More nav */}
      <div className="grid grid-cols-1 gap-3">
        <Link href="/messages" className="flex items-center justify-between rounded-xl border p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600 shrink-0">
              <MessageSquare size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">Messages</p>
              <p className="text-xs text-gray-500">View your conversations</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
      </div>

    </main>
  );
}
