"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Mail, Share2, Palette, LogOut, Camera, X, ImageIcon,
  Paintbrush, AtSign, MessageCircle, Plus, Trash2, AlertTriangle,
  BookOpen, Search, Check, Loader2,
} from "lucide-react";
import {
  auth, admin as adminApi, subjects as subjectsApi,
  type UserProfile, type UserSubject, type Subject,
} from "@/lib/api";
import { posts as postsApi, type Post } from "@/lib/api";
import { PostCard } from "@/components/post-card";
import ShareOverlay from "@/components/share-overlay";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const THEMES = [
  { id: "default", label: "Default" },
  { id: "slate",   label: "Slate"   },
  { id: "sepia",   label: "Sepia"   },
  { id: "dark",    label: "Dark"    },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];

const BANNER_W = 1400, BANNER_H = 440, AVATAR_SIZE = 400;

const BANNER_COLORS = [
  "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)",
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
];

function cropAndCompress(file: File, w: number, h: number, q: number): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const asp = w / h;
      let sw = img.width, sh = img.width / asp;
      if (sh > img.height) { sh = img.height; sw = img.height * asp; }
      const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return rej(new Error("no ctx"));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      res(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => rej(new Error("load failed"));
    img.src = url;
  });
}

function gradientToBase64(gradient: string, w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); if (!ctx) return "";
  const colors = gradient.match(/#[0-9a-fA-F]{6}/g) || ["#000", "#333"];
  const grd = ctx.createLinearGradient(0, 0, w, h);
  colors.forEach((col, i) => grd.addColorStop(i / Math.max(colors.length - 1, 1), col));
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

// ── Subject Management Modal ─────────────────────────────────────────────────

function SubjectModal({
  profileUser, currentUser, userSubjects, onClose, onChanged,
}: {
  profileUser: UserProfile;
  currentUser: UserProfile;
  userSubjects: UserSubject[];
  onClose: () => void;
  onChanged: (u: UserSubject[]) => void;
}) {
  const [all, setAll] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  const enrolledIds = new Set(userSubjects.map((s) => s.id));

  useEffect(() => {
    const fetch = currentUser.role === "admin" ? subjectsApi.listAll() : subjectsApi.my();
    fetch.then(setAll).catch(() => setAll([])).finally(() => setLoading(false));
  }, [currentUser.role]);

  const filtered = all.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())
  );

  async function toggle(subj: Subject) {
    setBusy(subj.id); setError("");
    try {
      if (enrolledIds.has(subj.id)) {
        await subjectsApi.removeMember(subj.id, profileUser.id);
        onChanged(userSubjects.filter((s) => s.id !== subj.id));
      } else {
        const isFacultyProfile = profileUser.role === "faculty" || profileUser.role === "admin";
        if (isFacultyProfile) {
          await subjectsApi.assignFaculty(subj.id, profileUser.id);
          onChanged([...userSubjects, { id: subj.id, name: subj.name, code: subj.code, description: subj.description ?? null, enrollment_role: "faculty" }]);
        } else {
          await subjectsApi.assignStudent(subj.id, profileUser.id);
          onChanged([...userSubjects, { id: subj.id, name: subj.name, code: subj.code, description: subj.description ?? null, enrollment_role: "student" }]);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85dvh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-[15px] font-semibold">Manage Subjects</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">{profileUser.full_name} · {profileUser.role}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X size={15} className="text-gray-500" />
          </button>
        </div>
        {/* Search */}
        <div className="px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
            <Search size={13} className="text-gray-400" />
            <input autoFocus type="text" placeholder="Search subjects…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-gray-400" />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-[13px] text-gray-400">{search ? "No subjects match" : "No subjects available"}</p>
          ) : filtered.map((subj) => {
            const enrolled = enrolledIds.has(subj.id);
            const isBusy = busy === subj.id;
            return (
              <button key={subj.id} onClick={() => toggle(subj)} disabled={isBusy}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left mb-0.5 disabled:opacity-50 ${enrolled ? "bg-black text-white hover:bg-gray-800" : "hover:bg-gray-50 text-gray-700"}`}>
                <div className={`h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0 ${enrolled ? "border-white bg-white" : "border-gray-300"}`}>
                  {enrolled && <Check size={10} className="text-black" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[13px] font-medium truncate ${enrolled ? "text-white" : "text-gray-900"}`}>{subj.name}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${enrolled ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{subj.code}</span>
                  </div>
                  {subj.description && (
                    <p className={`text-[11px] truncate mt-0.5 ${enrolled ? "text-white/60" : "text-gray-400"}`}>{subj.description}</p>
                  )}
                </div>
                {isBusy && <Loader2 size={13} className="animate-spin flex-shrink-0 opacity-60" />}
              </button>
            );
          })}
        </div>
        {error && <div className="px-5 pb-3"><p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p></div>}
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="w-full rounded-xl bg-gray-100 text-gray-700 py-2.5 text-[13px] font-medium hover:bg-gray-200 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Module-level profile cache — survives navigation within the SPA session ──
interface ProfileCacheEntry {
  profile: UserProfile;
  posts: Post[];
  subjects: UserSubject[];
}
const _profileCache = new Map<string, ProfileCacheEntry>();

// ── Main ─────────────────────────────────────────────────────────────────────

type OverlayTarget = "banner" | "avatar" | null;

export default function ProfileClient({ username }: { username: string }) {
  const { user: currentUser, logout } = useAuth();
  const router = useRouter();

  const cached = _profileCache.get(username);
  const [profile, setProfile]       = useState<UserProfile | null>(cached?.profile ?? null);
  const [loading, setLoading]       = useState(!cached);
  const [notFound, setNotFound]     = useState(false);
  const [copied, _setCopied]         = useState(false);
  const [showShare, setShowShare]   = useState(false);
  const [theme, setTheme]           = useState<ThemeId>("default");
  const [overlayTarget, setOverlayTarget] = useState<OverlayTarget>(null);
  const [saving, setSaving]         = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue]     = useState(cached?.profile.bio || "");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue]   = useState(cached?.profile.full_name || "");
  const [userPosts, setUserPosts]   = useState<Post[]>(cached?.posts ?? []);

  // Role picker
  const [showRolePicker, setShowRolePicker]   = useState(false);
  const [assigningRole, setAssigningRole]     = useState(false);
  const rolePickerRef = useRef<HTMLDivElement>(null);

  // Subjects
  const [userSubjects, setUserSubjects]         = useState<UserSubject[]>(cached?.subjects ?? []);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword]       = useState("");
  const [deleteError, setDeleteError]             = useState("");
  const [deleting, setDeleting]                   = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Close role picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (rolePickerRef.current && !rolePickerRef.current.contains(e.target as Node))
        setShowRolePicker(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load profile — show cached data immediately, then refresh in background
  useEffect(() => {
    const hasCached = _profileCache.has(username);
    if (!hasCached) { setLoading(true); setNotFound(false); }
    let cancelled = false;
    auth.profileByUsername(username)
      .then(async (p) => {
        if (cancelled) return;
        // Subjects are public — always fetch for everyone
        const [posts, subjects] = await Promise.all([
          postsApi.byUser(p.id).catch(() => [] as Post[]),
          subjectsApi.userSubjects(p.id).catch(() => [] as UserSubject[]),
        ]);
        if (cancelled) return;
        _profileCache.set(username, { profile: p, posts, subjects });
        setProfile(p);
        setBioValue(p.bio || "");
        setNameValue(p.full_name);
        setUserPosts(posts);
        setUserSubjects(subjects);
      })
      .catch(() => { if (!cancelled && !hasCached) { setProfile(null); setNotFound(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username, currentUser?.id, currentUser?.role]);

  useEffect(() => {
    const saved = (localStorage.getItem("kec-theme") as ThemeId | null) || "default";
    setTheme(saved);
  }, []);

  function applyTheme(next: ThemeId) {
    setTheme(next);
    localStorage.setItem("kec-theme", next);
    if (next === "default") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
  }


  function handleShare() {
    setShowShare(true);
  }

  const saveProfile = useCallback(async (updates: Partial<{ full_name: string; bio: string | null; avatar_base64: string | null; banner_base64: string | null }>) => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await auth.updateMe({
        full_name: updates.full_name ?? profile.full_name,
        bio: updates.bio !== undefined ? updates.bio : (profile.bio || null),
        avatar_base64: updates.avatar_base64 !== undefined ? updates.avatar_base64 : (profile.avatar_base64 || null),
        banner_base64: updates.banner_base64 !== undefined ? updates.banner_base64 : (profile.banner_base64 || null),
      });
      setProfile(updated);
      if (updates.bio !== undefined) setBioValue(updated.bio || "");
      if (updates.full_name) setNameValue(updated.full_name);
      // Keep cache in sync so the next visit reflects the edit immediately
      const entry = _profileCache.get(username);
      if (entry) _profileCache.set(username, { ...entry, profile: updated });
    } catch { /**/ } finally { setSaving(false); }
  }, [profile]);

  async function handleImageUpload(file: File, target: "banner" | "avatar") {
    try {
      if (target === "banner") await saveProfile({ banner_base64: await cropAndCompress(file, BANNER_W, BANNER_H, 0.75) });
      else await saveProfile({ avatar_base64: await cropAndCompress(file, AVATAR_SIZE, AVATAR_SIZE, 0.8) });
    } catch { /**/ }
    setOverlayTarget(null);
  }

  async function handleGradientBanner(gradient: string) {
    await saveProfile({ banner_base64: gradientToBase64(gradient, BANNER_W, BANNER_H) });
    setOverlayTarget(null);
  }

  if (loading) return <main className="grid place-items-center py-32"><div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" /></main>;
  if (notFound || !profile) return (
    <main className="text-center py-20">
      <p className="text-sm text-gray-500">User not found</p>
      <Link href="/feed" className="mt-3 inline-block text-sm font-medium text-black hover:underline">Back to Feed</Link>
    </main>
  );

  const isOwn          = currentUser?.id === profile.id;
  const isFacOrAdmin   = currentUser?.role === "faculty" || currentUser?.role === "admin";
  const canManageSubs  = isFacOrAdmin && !isOwn;
  const showSubjects   = true; // subjects are public — everyone can see them
  const subjectChip    = (r: string) => r === "faculty" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700";

  return (
    <>
      {/* ── Top bar — same style as post detail ── */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100 mb-5">
        <div className="flex items-center h-11 gap-2">
          {/* Back arrow — only when viewing someone else's profile */}
          {!isOwn ? (
            <button onClick={() => router.back()}
              className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors -ml-1 shrink-0">
              <ArrowLeft size={17} />
            </button>
          ) : (
            <div className="w-8 shrink-0" />
          )}
          <span className="flex-1 text-center text-[13px] font-medium text-neutral-400 truncate px-2">
            {profile.username ? `@${profile.username}` : profile.full_name}
          </span>
          <div className="w-8 shrink-0" />
        </div>
      </div>

      <main className="space-y-5 pb-24">
      <div className="rounded-xl border border-gray-200">
        {/* Banner */}
        <div className="relative group">
          <div className="overflow-hidden rounded-t-xl bg-gray-100" style={{ aspectRatio: "16/5" }}>
            {profile.banner_base64
              ? <img src={profile.banner_base64} alt="Banner" className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
              : <div className="h-full w-full bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900" />}
          </div>
          {isOwn && (
            <button onClick={() => setOverlayTarget("banner")} className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-800 shadow">
                <Camera size={13} /> Change Banner
              </span>
            </button>
          )}
        </div>

        <div className="p-6 pt-0">
          {/* Avatar + action buttons */}
          <div className="flex items-end justify-between -mt-10">
            <div className="relative group/avatar">
              <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-black shadow-md">
                {profile.avatar_base64
                  ? <img src={profile.avatar_base64} alt={profile.full_name} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  : <div className="grid h-full w-full place-items-center text-2xl font-semibold text-white">{profile.full_name[0]}</div>}
              </div>
              {isOwn && (
                <button onClick={() => setOverlayTarget("avatar")} className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover/avatar:bg-black/40 transition-colors">
                  <Camera size={14} className="text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isOwn && currentUser && (
                <Link href={`/messages/${encodeURIComponent(profile.username || String(profile.id))}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-[13px] font-medium text-gray-700 hover:border-gray-400 transition-colors">
                  <MessageCircle size={13} /> Message
                </Link>
              )}
              <button onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-[13px] font-medium text-gray-700 hover:border-gray-400 transition-colors">
                <Share2 size={13} /> {copied ? "Copied!" : "Share"}
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="mt-4">
            {isOwn && editingName ? (
              <div className="flex items-center gap-2">
                <input type="text" value={nameValue} onChange={(e) => setNameValue(e.target.value)} autoFocus maxLength={120}
                  className="text-xl font-semibold tracking-tight border-b border-gray-300 outline-none focus:border-black bg-transparent py-0.5"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameValue.trim().length >= 2) { saveProfile({ full_name: nameValue.trim() }); setEditingName(false); }
                    if (e.key === "Escape") { setNameValue(profile.full_name); setEditingName(false); }
                  }} />
                <button onClick={() => { if (nameValue.trim().length >= 2) { saveProfile({ full_name: nameValue.trim() }); setEditingName(false); } }} className="text-xs text-gray-500 hover:text-black">Save</button>
                <button onClick={() => { setNameValue(profile.full_name); setEditingName(false); }} className="text-xs text-gray-400 hover:text-black">Cancel</button>
              </div>
            ) : (
              <h1 className={`text-xl font-semibold tracking-tight ${isOwn ? "cursor-pointer hover:underline decoration-gray-300" : ""}`}
                onClick={() => isOwn && setEditingName(true)} title={isOwn ? "Click to edit" : undefined}>
                {profile.full_name}
              </h1>
            )}

            {profile.username && (
              <div className="flex items-center gap-1.5 mt-1">
                <AtSign size={13} className="text-gray-400" />
                <span className="text-sm text-gray-500">{profile.username}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Mail size={13} className="text-gray-400" />
              <span className="text-sm text-gray-500">{profile.email}</span>
            </div>

            {/* Role chips row + + button */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 capitalize">
                {profile.role}
              </span>
              {profile.batch_year && (
                <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                  Batch {profile.batch_year}
                </span>
              )}

              {/* Admin/Faculty + menu */}
              {!isOwn && currentUser && isFacOrAdmin && (
                <div className="relative" ref={rolePickerRef}>
                  <button
                    onClick={() => setShowRolePicker((v) => !v)}
                    className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-black transition-colors"
                    title="Manage roles &amp; subjects"
                  >
                    <Plus size={11} />
                  </button>

                  {showRolePicker && (
                    <div className="absolute left-0 top-7 z-50 min-w-[210px] rounded-xl border border-gray-200 bg-white shadow-xl py-1">

                      {/* ── Role section ── */}
                      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Assign Role</p>
                      {(["student", "faculty", "guest"] as const).map((r) => {
                        const hasRole = profile.role === r;
                        return (
                          <button key={r} disabled={assigningRole || hasRole}
                            onClick={async () => {
                              setAssigningRole(true);
                              try { await adminApi.updateRole(profile.id, r); setProfile({ ...profile, role: r }); }
                              catch { /**/ } finally { setAssigningRole(false); setShowRolePicker(false); }
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm capitalize transition-colors disabled:opacity-40 ${hasRole ? "text-black font-medium bg-gray-50" : "text-gray-700 hover:bg-gray-50"}`}>
                            <span>{r}</span>
                            {hasRole && <Check size={14} className="text-black" strokeWidth={2.5} />}
                          </button>
                        );
                      })}

                      {/* ── Batch year section ── */}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Batch Year</p>
                        <div className="px-4 py-2 flex items-center gap-2">
                          <input type="number" min={2000} max={2099} placeholder="e.g. 2025"
                            defaultValue={profile.batch_year ?? ""}
                            className="w-24 rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-black"
                            onKeyDown={async (e) => {
                              if (e.key !== "Enter") return;
                              const year = (e.target as HTMLInputElement).value ? parseInt((e.target as HTMLInputElement).value) : null;
                              setAssigningRole(true);
                              try { await adminApi.updateBatchYear(profile.id, year); setProfile({ ...profile, batch_year: year }); }
                              catch { /**/ } finally { setAssigningRole(false); setShowRolePicker(false); }
                            }} />
                          {profile.batch_year && (
                            <button className="text-xs text-red-500 hover:text-red-700"
                              onClick={async () => {
                                setAssigningRole(true);
                                try { await adminApi.updateBatchYear(profile.id, null); setProfile({ ...profile, batch_year: null }); }
                                catch { /**/ } finally { setAssigningRole(false); setShowRolePicker(false); }
                              }}>Remove</button>
                          )}
                        </div>
                      </div>

                      {/* ── Subject section ── */}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Subjects</p>
                        <button onClick={() => { setShowRolePicker(false); setShowSubjectModal(true); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <BookOpen size={13} className="text-gray-400" />
                          Manage subject enrollment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="mt-4">
            {isOwn && editingBio ? (
              <div className="space-y-2">
                <textarea value={bioValue} onChange={(e) => setBioValue(e.target.value)} autoFocus maxLength={500} rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black resize-none transition-colors"
                  placeholder="Write something about yourself…" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{bioValue.length}/500</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setBioValue(profile.bio || ""); setEditingBio(false); }} className="text-xs text-gray-400 hover:text-black">Cancel</button>
                    <button onClick={() => { saveProfile({ bio: bioValue.trim() || null }); setEditingBio(false); }} disabled={saving}
                      className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`text-sm ${profile.bio ? "text-gray-600" : "text-gray-400 italic"} ${isOwn ? "cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2" : ""}`}
                onClick={() => isOwn && setEditingBio(true)} title={isOwn ? "Click to edit bio" : undefined}>
                {profile.bio ? (
                  profile.bio.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                    /^https?:\/\//.test(part)
                      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>
                      : <span key={i}>{part}</span>
                  )
                ) : (isOwn ? "Add a bio…" : "No bio yet")}
              </div>
            )}
          </div>

          {/* ── Subjects ── */}
          {showSubjects && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <BookOpen size={13} className="text-gray-400" />
                  <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Subjects</span>
                </div>
                {canManageSubs && (
                  <button onClick={() => setShowSubjectModal(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-gray-400 hover:text-black transition-colors">
                    <Plus size={10} strokeWidth={2.5} /> Manage
                  </button>
                )}
              </div>
              {userSubjects.length === 0 ? (
                <p className="text-[12px] text-gray-400 italic">
                  {canManageSubs ? "No subjects assigned — click Manage or use the + button above." : "Not enrolled in any subjects."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {userSubjects.map((s) => (
                    <span key={s.id} title={s.description ?? undefined}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${subjectChip(s.enrollment_role)}`}>
                      <span className="font-mono text-[10px] opacity-70">{s.code}</span>
                      {s.name}
                      <span className="opacity-60 text-[10px]">· {s.enrollment_role}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Posts */}
      {userPosts.length > 0 && (
        <div className="rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold mb-3">Posts</h2>
          <div className="space-y-4">
            {userPosts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={(id) => setUserPosts((prev) => prev.filter((p) => p.id !== id))} />
            ))}
          </div>
        </div>
      )}

      {/* Own profile settings */}
      {isOwn && (
        <>
          <div className="rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Palette size={16} className="text-gray-500" />
              <h2 className="text-sm font-semibold">Theme</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {THEMES.map((item) => (
                <button key={item.id} type="button" onClick={() => applyTheme(item.id)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${theme === item.id ? "border-black bg-black text-white" : "border-gray-200 text-gray-700 hover:border-gray-400"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { logout(); router.push("/"); }}
            className="w-full rounded-xl border border-gray-200 p-4 flex items-center gap-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors">
            <LogOut size={16} /> Sign Out
          </button>
          <div className="rounded-xl border border-red-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-red-500" />
              <h2 className="text-sm font-semibold text-red-600">Danger Zone</h2>
            </div>
            <p className="text-xs text-gray-500 mb-3">Once deleted, all your data is permanently gone.</p>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={14} /> Delete My Account
              </button>
            ) : (
              <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/50 p-4">
                <p className="text-sm font-medium text-red-700">Type <span className="font-mono font-bold">delete my account</span> to confirm:</p>
                <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value.toLowerCase())}
                  className="w-full rounded-lg border border-red-200 bg-white py-2 px-3 text-sm outline-none focus:border-red-400" placeholder="delete my account" autoComplete="off" />
                <p className="text-sm font-medium text-red-700">Password:</p>
                <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full rounded-lg border border-red-200 bg-white py-2 px-3 text-sm outline-none focus:border-red-400" placeholder="Your password" autoComplete="current-password" />
                {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    disabled={deleteConfirmText !== "delete my account" || !deletePassword || deleting}
                    onClick={async () => {
                      setDeleting(true); setDeleteError("");
                      try { await auth.deleteMe(deletePassword); logout(); router.push("/auth/sign-in"); }
                      catch (e: unknown) { setDeleteError(e instanceof Error ? e.message : "Failed"); }
                      finally { setDeleting(false); }
                    }}
                    className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-red-700 transition-colors">
                    {deleting ? "Deleting…" : "I understand, delete my account"}
                  </button>
                  <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeletePassword(""); setDeleteError(""); }}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Banner/Avatar overlay */}
      {overlayTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setOverlayTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{overlayTarget === "banner" ? "Change Banner" : "Change Profile Photo"}</h3>
              <button onClick={() => setOverlayTarget(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100"><X size={16} className="text-gray-500" /></button>
            </div>
            <div className="space-y-2">
              <button onClick={() => { if (overlayTarget === "banner") bannerInputRef.current?.click(); else avatarInputRef.current?.click(); }}
                className="w-full flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <ImageIcon size={18} className="text-gray-400" /> Select from Gallery
              </button>
              {overlayTarget === "banner" && (
                <div>
                  <div className="flex items-center gap-2 px-1 py-2"><Paintbrush size={14} className="text-gray-400" /><span className="text-xs font-medium text-gray-500">Select a gradient</span></div>
                  <div className="grid grid-cols-4 gap-2">
                    {BANNER_COLORS.map((g, i) => (
                      <button key={i} onClick={() => handleGradientBanner(g)} disabled={saving}
                        className="h-12 rounded-lg border border-gray-200 overflow-hidden hover:ring-2 hover:ring-black hover:ring-offset-1 transition-all disabled:opacity-50"
                        style={{ background: g }} />
                    ))}
                  </div>
                </div>
              )}
              {((overlayTarget === "banner" && profile.banner_base64) || (overlayTarget === "avatar" && profile.avatar_base64)) && (
                <button onClick={async () => { if (overlayTarget === "banner") await saveProfile({ banner_base64: null }); else await saveProfile({ avatar_base64: null }); setOverlayTarget(null); }}
                  disabled={saving} className="w-full flex items-center gap-3 rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                  <X size={18} /> {overlayTarget === "banner" ? "Remove Banner" : "Remove Photo"}
                </button>
              )}
            </div>
            {saving && <div className="flex items-center justify-center gap-2 mt-4"><div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" /><span className="text-xs text-gray-500">Saving…</span></div>}
          </div>
        </div>
      )}

      {/* Subject modal */}
      {showSubjectModal && profile && currentUser && (
        <SubjectModal
          profileUser={profile}
          currentUser={currentUser}
          userSubjects={userSubjects}
          onClose={() => setShowSubjectModal(false)}
          onChanged={setUserSubjects}
        />
      )}

      {showShare && profile && (
        <ShareOverlay
          kind="profile"
          sharePayload={`@${profile.username || profile.id}`}
          preview={
            <div className="rounded-xl border border-neutral-200 p-3 flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-neutral-900 text-white text-[15px] font-semibold grid place-items-center overflow-hidden flex-shrink-0">
                {profile.avatar_base64
                  ? <img src={profile.avatar_base64} alt={profile.full_name} className="h-full w-full object-cover" />
                  : profile.full_name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-neutral-900 truncate">{profile.full_name}</p>
                <p className="text-[11px] text-neutral-400">@{profile.username} · <span className="capitalize">{profile.role}</span></p>
              </div>
            </div>
          }
          onClose={() => setShowShare(false)}
        />
      )}

      <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "banner"); e.target.value = ""; }} />
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "avatar"); e.target.value = ""; }} />
    </main>
    </>
  );
}
