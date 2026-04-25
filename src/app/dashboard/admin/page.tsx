"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Users as UsersIcon, Search, ChevronRight,
  Ban, Trash2, GraduationCap, UserCog, UserX,
  FileText, Activity, Eye, EyeOff, BookOpen,
  Plus, RefreshCw, X, UserPlus, AlertCircle,
} from "lucide-react";
import {
  admin as adminApi, subjects as subjectsApi, auth as authApi,
  type AdminUser, type AdminStats, type Subject, type SubjectEnrollment,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Tab = "overview" | "users" | "subjects";

const ROLE_PILL: Record<string, string> = {
  student: "bg-emerald-50 text-emerald-700 border-emerald-200",
  faculty: "bg-violet-50  text-violet-700  border-violet-200",
  guest:   "bg-amber-50   text-amber-700   border-amber-200",
  admin:   "bg-neutral-100 text-neutral-700 border-neutral-200",
};

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4">
      <div className={`h-8 w-8 rounded-xl grid place-items-center text-white mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-[22px] font-semibold text-neutral-950 tracking-tight">{value}</p>
      <p className="text-[11px] text-neutral-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  // Users
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingUser, setUpdatingUser] = useState<number | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [batchDrafts, setBatchDrafts] = useState<Record<number, string>>({});

  // Subjects
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [subjectMembers, setSubjectMembers] = useState<SubjectEnrollment[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Create subject form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectDesc, setNewSubjectDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // Assign faculty
  const [facultySearch, setFacultySearch] = useState("");
  const [facultyResults, setFacultyResults] = useState<AdminUser[]>([]);
  const [facultySearching, setFacultySearching] = useState(false);
  const [assigningFacultyId, setAssigningFacultyId] = useState<number | null>(null);
  const [assignMsg, setAssignMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [s, u] = await Promise.all([adminApi.stats(), adminApi.users()]);
      setStats(s); setAllUsers(u);
    } catch { /* */ } finally { setLoadingData(false); }
  }, []);

  const loadSubjects = useCallback(async () => {
    setSubjectsLoading(true);
    try {
      const data = await subjectsApi.listAll();
      setAllSubjects(data);
    } catch { /* */ } finally { setSubjectsLoading(false); }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === "admin") loadAll();
  }, [authLoading, user, loadAll]);

  useEffect(() => {
    if (tab === "subjects" && allSubjects.length === 0) loadSubjects();
  }, [tab, allSubjects.length, loadSubjects]);

  // Load members when subject selected
  useEffect(() => {
    if (!selectedSubject) return;
    setMembersLoading(true);
    setSubjectMembers([]);
    subjectsApi.members(selectedSubject.id)
      .then(setSubjectMembers)
      .catch(() => setSubjectMembers([]))
      .finally(() => setMembersLoading(false));
  }, [selectedSubject]);

  // Faculty search debounce
  useEffect(() => {
    if (!facultySearch.trim()) { setFacultyResults([]); return; }
    const t = setTimeout(async () => {
      setFacultySearching(true);
      try {
        const res = await authApi.searchUsers(facultySearch);
        setFacultyResults(res.filter((u) => u.role === "faculty" || u.role === "admin") as AdminUser[]);
      } catch { setFacultyResults([]); }
      setFacultySearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [facultySearch]);

  async function updateRole(userId: number, newRole: string) {
    setUpdatingUser(userId);
    try {
      await adminApi.updateRole(userId, newRole);
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as AdminUser["role"] } : u));
    } catch { /* */ } finally { setUpdatingUser(null); }
  }

  async function toggleBan(userId: number, banned: boolean) {
    setUpdatingUser(userId);
    try {
      await adminApi.banUser(userId, !banned);
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_banned: !banned } : u));
    } catch { /* */ } finally { setUpdatingUser(null); }
  }

  async function deleteUser(userId: number) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setUpdatingUser(userId);
    try {
      await adminApi.deleteUser(userId);
      setAllUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch { /* */ } finally { setUpdatingUser(null); }
  }

  async function updateBatchYear(userId: number, batchYear: number | null) {
    setUpdatingUser(userId);
    try {
      await adminApi.updateBatchYear(userId, batchYear);
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, batch_year: batchYear } : u));
    } catch { /* */ } finally { setUpdatingUser(null); }
  }

  async function createSubject() {
    if (!newSubjectName.trim() || !newSubjectCode.trim()) return;
    setCreating(true); setCreateErr("");
    try {
      const created = await subjectsApi.create(
        newSubjectName.trim(),
        newSubjectCode.trim().toUpperCase(),
        newSubjectDesc.trim() || undefined,
      );
      setAllSubjects((prev) => [created, ...prev]);
      setNewSubjectName(""); setNewSubjectCode(""); setNewSubjectDesc("");
      setShowCreateForm(false);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create subject.");
    }
    setCreating(false);
  }

  async function deleteSubject(subjectId: number) {
    if (!confirm("Delete this subject and all its enrollments? This cannot be undone.")) return;
    try {
      await subjectsApi.delete(subjectId);
      setAllSubjects((prev) => prev.filter((s) => s.id !== subjectId));
      if (selectedSubject?.id === subjectId) setSelectedSubject(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete subject.");
    }
  }

  async function assignFaculty(userId: number) {
    if (!selectedSubject) return;
    setAssigningFacultyId(userId);
    setAssignMsg(null);
    try {
      await subjectsApi.assignFaculty(selectedSubject.id, userId);
      setAssignMsg({ type: "ok", text: "Faculty assigned successfully." });
      const updated = await subjectsApi.members(selectedSubject.id);
      setSubjectMembers(updated);
      const refreshed = await subjectsApi.listAll();
      setAllSubjects(refreshed);
      const r = refreshed.find((s) => s.id === selectedSubject.id);
      if (r) setSelectedSubject(r);
      setFacultySearch(""); setFacultyResults([]);
    } catch (err) {
      setAssignMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to assign faculty." });
    }
    setAssigningFacultyId(null);
  }

  async function removeMember(userId: number) {
    if (!selectedSubject || !confirm("Remove this member?")) return;
    try {
      await subjectsApi.removeMember(selectedSubject.id, userId);
      setSubjectMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
  }

  const filtered = allUsers.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-4 w-4 border-[1.5px] border-neutral-200 border-t-neutral-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Shield size={28} className="text-neutral-200" />
        <p className="text-[13px] text-neutral-400">Admin access required</p>
        <button onClick={() => router.push("/auth/sign-in")} className="mt-1 text-[13px] font-semibold text-neutral-900 hover:underline underline-offset-2">
          Sign in as admin
        </button>
      </div>
    );
  }

  const subjectFaculty = subjectMembers.filter((m) => m.role === "faculty");
  const subjectStudents = subjectMembers.filter((m) => m.role === "student");

  return (
    <>
      <style>{`
        .admin-root { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.22s ease forwards; }
        .field-input {
          width: 100%;
          border-radius: 14px;
          border: 1px solid #e5e5e5;
          padding: 10px 14px;
          font-size: 13px;
          font-family: inherit;
          background: #fafafa;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          color: #171717;
        }
        .field-input:focus {
          border-color: #a3a3a3;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
        }
        .field-input::placeholder { color: #a3a3a3; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="admin-root pb-28 fade-up">

        <div className="mb-6">
          <h1 className="text-[24px] font-semibold tracking-tight text-neutral-950 leading-tight">Admin Dashboard</h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">Manage your platform</p>
        </div>

        <div className="h-px bg-neutral-100 mb-5" />

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto no-scrollbar">
          {([
            { key: "overview"  as Tab, label: "Overview",  icon: <Activity size={13} /> },
            { key: "users"     as Tab, label: "Users",     icon: <UsersIcon size={13} /> },
            { key: "subjects"  as Tab, label: "Subjects",  icon: <BookOpen size={13} /> },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium transition-all ${
                tab === t.key
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab === "overview" && (
          <div className="space-y-4">
            {loadingData ? (
              <div className="grid place-items-center py-20">
                <div className="h-4 w-4 border-[1.5px] border-neutral-200 border-t-neutral-700 rounded-full animate-spin" />
              </div>
            ) : stats && (
              <>
                <div className="rounded-2xl border border-neutral-100 bg-white p-5">
                  <p className="text-[11px] font-semibold tracking-widest uppercase text-neutral-400 mb-1">Total Users</p>
                  <p className="text-[46px] font-semibold tracking-tight text-neutral-950 leading-none">{stats.total_users}</p>
                  {stats.total_users > 0 && (
                    <div className="mt-4">
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-100 gap-px">
                        <div className="bg-emerald-500 transition-all duration-500 rounded-l-full" style={{ width: `${(stats.students / stats.total_users) * 100}%` }} />
                        <div className="bg-violet-500 transition-all duration-500" style={{ width: `${(stats.faculty / stats.total_users) * 100}%` }} />
                        <div className="bg-amber-500 transition-all duration-500 rounded-r-full" style={{ width: `${(stats.guests / stats.total_users) * 100}%` }} />
                      </div>
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {[
                          { label: "Students", count: stats.students, dot: "bg-emerald-500" },
                          { label: "Faculty",  count: stats.faculty,  dot: "bg-violet-500" },
                          { label: "Guests",   count: stats.guests,   dot: "bg-amber-500" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-1.5">
                            <div className={`h-2 w-2 rounded-full ${item.dot}`} />
                            <span className="text-[12px] text-neutral-400">{item.label} <strong className="text-neutral-800 font-semibold">{item.count}</strong></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Students"   value={stats.students}   icon={<GraduationCap size={15} />} color="bg-emerald-500" />
                  <StatCard label="Faculty"    value={stats.faculty}    icon={<UserCog size={15} />}       color="bg-violet-500" />
                  <StatCard label="Guests"     value={stats.guests}     icon={<UsersIcon size={15} />}     color="bg-amber-500" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Posts"      value={stats.total_posts} icon={<FileText size={15} />}     color="bg-sky-500" />
                  <StatCard label="Subjects"   value={allSubjects.length} icon={<BookOpen size={15} />}    color="bg-indigo-500" />
                  <StatCard label="Banned"     value={stats.banned}      icon={<UserX size={15} />}        color={stats.banned > 0 ? "bg-red-500" : "bg-neutral-300"} />
                </div>

                <button onClick={() => setTab("users")}
                  className="flex w-full items-center justify-between rounded-2xl border border-neutral-100 bg-white px-5 py-4 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-neutral-900 text-white grid place-items-center"><UsersIcon size={16} /></div>
                    <div className="text-left">
                      <p className="text-[13.5px] font-semibold text-neutral-900">Manage Users</p>
                      <p className="text-[12px] text-neutral-400">{allUsers.length} users registered</p>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-neutral-300" />
                </button>
                <button onClick={() => setTab("subjects")}
                  className="flex w-full items-center justify-between rounded-2xl border border-neutral-100 bg-white px-5 py-4 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white grid place-items-center"><BookOpen size={16} /></div>
                    <div className="text-left">
                      <p className="text-[13.5px] font-semibold text-neutral-900">Manage Subjects</p>
                      <p className="text-[12px] text-neutral-400">{allSubjects.length} subjects created</p>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-neutral-300" />
                </button>
              </>
            )}
          </div>
        )}

        {/* ══ USERS ══ */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input type="text" className="field-input" style={{ paddingLeft: 36 }}
                placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {[{ key: "all", label: "All" }, { key: "student", label: "Students" }, { key: "faculty", label: "Faculty" }, { key: "guest", label: "Guests" }].map((r) => (
                <button key={r.key} onClick={() => setRoleFilter(r.key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                    roleFilter === r.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                  }`}>{r.label}</button>
              ))}
            </div>
            <p className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase px-0.5">{filtered.length} {filtered.length === 1 ? "User" : "Users"}</p>

            {loadingData ? (
              <div className="grid place-items-center py-16">
                <div className="h-4 w-4 border-[1.5px] border-neutral-200 border-t-neutral-700 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((u) => {
                  const isExpanded = expandedUser === u.id;
                  const busy = updatingUser === u.id;
                  return (
                    <div key={u.id} className={`rounded-2xl border transition-all ${u.is_banned ? "border-red-100 bg-red-50/40" : "border-neutral-100 bg-white"}`}>
                      <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpandedUser(isExpanded ? null : u.id)}>
                        <div className="relative h-9 w-9 shrink-0 rounded-full bg-neutral-900 text-white grid place-items-center text-[12px] font-semibold overflow-hidden">
                          {u.avatar_base64
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={u.avatar_base64} alt="" className="h-full w-full object-cover" />
                            : u.full_name[0].toUpperCase()}
                          {u.is_banned && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-white grid place-items-center">
                              <Ban size={7} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-semibold text-neutral-900 truncate leading-tight">{u.full_name}</p>
                          <p className="text-[12px] text-neutral-400 truncate mt-0.5">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold capitalize ${ROLE_PILL[u.role] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{u.role}</span>
                          <ChevronRight size={13} className={`text-neutral-300 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-neutral-100 px-4 pb-4 pt-4 space-y-4">
                          <div>
                            <p className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase mb-2">Role</p>
                            <div className="flex gap-1.5">
                              {["guest", "student", "faculty"].map((r) => (
                                <button key={r} onClick={() => updateRole(u.id, r)} disabled={busy || u.role === r}
                                  className={`flex-1 rounded-full py-2 text-[12px] font-medium transition-all disabled:opacity-40 ${
                                    u.role === r ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                  }`}>{r.charAt(0).toUpperCase() + r.slice(1)}</button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase mb-2">Batch Year</p>
                            <div className="flex gap-2">
                              <input type="text" inputMode="numeric" placeholder="e.g. 2025" className="field-input flex-1"
                                value={batchDrafts[u.id] ?? (u.batch_year?.toString() ?? "")}
                                onChange={(e) => { const clean = e.target.value.replace(/\D/g, ""); setBatchDrafts((prev) => ({ ...prev, [u.id]: clean })); }}
                                onKeyDown={(e) => { if (e.key !== "Enter") return; const val = (batchDrafts[u.id] ?? "").trim(); const num = val ? parseInt(val, 10) : null; updateBatchYear(u.id, Number.isNaN(num as number) ? null : num); }}
                                disabled={busy} />
                              <button onClick={() => { const val = (batchDrafts[u.id] ?? "").trim(); const num = val ? parseInt(val, 10) : null; updateBatchYear(u.id, Number.isNaN(num as number) ? null : num); }}
                                disabled={busy}
                                className="rounded-full bg-neutral-900 px-5 text-[12.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-40">Save</button>
                            </div>
                          </div>

                          <div className="h-px bg-neutral-100" />
                          <div className="flex gap-2">
                            <button onClick={() => toggleBan(u.id, u.is_banned)} disabled={busy}
                              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-semibold transition-all disabled:opacity-40 border ${
                                u.is_banned ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                              }`}>
                              {u.is_banned ? <><EyeOff size={13} /> Unban</> : <><Eye size={13} /> Ban</>}
                            </button>
                            <button onClick={() => deleteUser(u.id)} disabled={busy}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 py-2.5 text-[12px] font-semibold text-red-600 hover:bg-red-100 transition-all disabled:opacity-40">
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="py-20 flex flex-col items-center gap-2">
                    <Search size={24} className="text-neutral-200" />
                    <p className="text-[13px] font-medium text-neutral-400 mt-1">No users found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ SUBJECTS ══ */}
        {tab === "subjects" && (
          <div className="space-y-4">

            {/* Header + Create */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase">{allSubjects.length} Subjects</p>
              <button onClick={() => { setShowCreateForm((v) => !v); setCreateErr(""); }}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-neutral-700 transition-colors">
                {showCreateForm ? <X size={12} /> : <Plus size={12} />}
                {showCreateForm ? "Cancel" : "New Subject"}
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                <p className="text-[12px] font-semibold text-neutral-600 uppercase tracking-wide">Create New Subject</p>
                <div className="grid grid-cols-2 gap-2">
                  <input className="field-input" placeholder="Subject name" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} />
                  <input className="field-input" placeholder="Code (e.g. CS301)" value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_\-]/g, ""))} />
                </div>
                <input className="field-input" placeholder="Description (optional)" value={newSubjectDesc} onChange={(e) => setNewSubjectDesc(e.target.value)} />
                {createErr && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-[12px] text-red-600">
                    <AlertCircle size={12} /> {createErr}
                  </div>
                )}
                <button onClick={createSubject} disabled={creating || !newSubjectName.trim() || !newSubjectCode.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2 text-[12.5px] font-medium text-white hover:bg-neutral-700 disabled:opacity-40 transition-colors">
                  {creating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  {creating ? "Creating…" : "Create Subject"}
                </button>
              </div>
            )}

            {subjectsLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl border bg-gray-50 animate-pulse" />)}</div>
            ) : allSubjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                <BookOpen size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">No subjects yet</p>
                <p className="text-xs text-gray-400 mt-1">Click &ldquo;New Subject&rdquo; to create the first one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {allSubjects.map((sub) => (
                  <div key={sub.id} className={`rounded-2xl border transition-all ${selectedSubject?.id === sub.id ? "border-neutral-900 shadow-sm" : "border-neutral-100 bg-white"}`}>
                    <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                      onClick={() => { setSelectedSubject(selectedSubject?.id === sub.id ? null : sub); setAssignMsg(null); setFacultySearch(""); setFacultyResults([]); }}>
                      <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white grid place-items-center text-[11px] font-bold shrink-0">
                        {sub.code.slice(0, 3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-neutral-900 truncate">{sub.name}</p>
                        <p className="text-[11.5px] text-neutral-400">{sub.code} · {sub.faculty_count} faculty · {sub.member_count - sub.faculty_count} students</p>
                      </div>
                      <ChevronRight size={13} className={`text-neutral-300 transition-transform ${selectedSubject?.id === sub.id ? "rotate-90" : ""}`} />
                    </button>

                    {selectedSubject?.id === sub.id && (
                      <div className="border-t border-neutral-100 p-4 space-y-4">

                        {/* Assign faculty */}
                        <div>
                          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Assign Faculty</p>
                          <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" className="field-input" style={{ paddingLeft: 28 }}
                              placeholder="Search faculty by name…" value={facultySearch}
                              onChange={(e) => setFacultySearch(e.target.value)} />
                            {facultySearching && <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                          </div>
                          {facultyResults.length > 0 && (
                            <div className="mt-1.5 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                              {facultyResults.slice(0, 5).map((u) => {
                                const alreadyIn = subjectMembers.some((m) => m.user_id === u.id);
                                return (
                                  <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 border-gray-50">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[12.5px] font-medium text-gray-900 truncate">{u.full_name}</p>
                                      <p className="text-[11px] text-gray-400">{u.email} · <span className="capitalize">{u.role}</span></p>
                                    </div>
                                    {alreadyIn ? (
                                      <span className="text-[11px] text-green-600 font-medium shrink-0">Assigned</span>
                                    ) : (
                                      <button onClick={() => assignFaculty(u.id)} disabled={assigningFacultyId === u.id}
                                        className="inline-flex items-center gap-1 rounded-full bg-indigo-600 text-white px-3 py-1 text-[11.5px] font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0">
                                        {assigningFacultyId === u.id ? <RefreshCw size={10} className="animate-spin" /> : <UserPlus size={11} />}
                                        Assign
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {assignMsg && (
                            <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] ${
                              assignMsg.type === "ok" ? "bg-green-50 border border-green-100 text-green-700" : "bg-red-50 border border-red-100 text-red-600"
                            }`}><AlertCircle size={12} />{assignMsg.text}</div>
                          )}
                        </div>

                        {/* Members list */}
                        {membersLoading ? (
                          <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-10 rounded-lg bg-gray-50 animate-pulse" />)}</div>
                        ) : (
                          <>
                            {subjectFaculty.length > 0 && (
                              <div>
                                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Faculty ({subjectFaculty.length})</p>
                                <div className="space-y-1.5">
                                  {subjectFaculty.map((m) => (
                                    <div key={m.id} className="flex items-center gap-3 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5">
                                      <div className="h-7 w-7 rounded-full bg-violet-200 grid place-items-center text-[10px] font-bold text-violet-700 shrink-0">{m.full_name[0]}</div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[12.5px] font-medium text-gray-900 truncate">{m.full_name}</p>
                                        <p className="text-[11px] text-violet-500">Faculty</p>
                                      </div>
                                      <button onClick={() => removeMember(m.user_id)} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors px-2 py-1 shrink-0">Remove</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {subjectStudents.length > 0 && (
                              <div>
                                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Students ({subjectStudents.length})</p>
                                <div className="space-y-1.5">
                                  {subjectStudents.map((m) => (
                                    <div key={m.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                                      <div className="h-7 w-7 rounded-full bg-gray-200 grid place-items-center text-[10px] font-semibold text-gray-600 shrink-0">{m.full_name[0]}</div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[12.5px] font-medium text-gray-900 truncate">{m.full_name}</p>
                                        {m.username && <p className="text-[11px] text-gray-400">@{m.username}</p>}
                                      </div>
                                      <button onClick={() => removeMember(m.user_id)} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors px-2 py-1 shrink-0">Remove</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {subjectMembers.length === 0 && (
                              <p className="text-[12px] text-gray-400 py-1">No members enrolled yet.</p>
                            )}
                          </>
                        )}

                        {/* Danger: delete subject */}
                        <div className="h-px bg-neutral-100" />
                        <button onClick={() => deleteSubject(sub.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-100 transition-colors">
                          <Trash2 size={12} /> Delete Subject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
