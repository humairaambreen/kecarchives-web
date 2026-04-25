"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Camera, Copy, RefreshCw, Shield, Trash2, UserMinus,
  UserPlus, Check, X, AlertTriangle, Users, LogOut,
} from "lucide-react";
import {
  groups as groupsApi, auth as authApi,
  type GroupOut, type GroupMember, type JoinRequest, type UserProfile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getGroupCache } from "@/lib/group-cache";

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} disabled={disabled}
      className={`relative inline-flex h-6 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40 ${on ? "bg-neutral-900" : "bg-neutral-200"}`}
      style={{ width: 44 }}>
      <span className="inline-block rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ width: 18, height: 18, transform: on ? "translateX(22px)" : "translateX(3px)" }} />
    </button>
  );
}

function Avatar({ name, b64, size = "md" }: { name: string; b64?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-8 w-8 text-[12px]" : size === "lg" ? "h-16 w-16 text-[22px]" : "h-10 w-10 text-[14px]";
  return (
    <div className={`${sz} rounded-full bg-neutral-900 text-white font-semibold grid place-items-center overflow-hidden shrink-0`}>
      {b64 ? <img src={b64} alt={name} className="h-full w-full object-cover" /> : name[0]?.toUpperCase()}
    </div>
  );
}

function cropSquare(file: File): Promise<string> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); const s = Math.min(img.width, img.height); const c = document.createElement("canvas"); c.width = c.height = 200; c.getContext("2d")!.drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, 200, 200); res(c.toDataURL("image/jpeg", 0.85)); };
    img.src = url;
  });
}

export default function GroupSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const groupId = parseInt(id, 10);
  const { user } = useAuth();
  const router = useRouter();

  // Hydrate instantly from cache (populated by messages page on navigation)
  const cached = getGroupCache(groupId);

  const [group,      setGroup]      = useState<GroupOut | null>(cached?.group ?? null);
  const [members,    setMembers]    = useState<GroupMember[]>(cached?.members ?? []);
  const [requests,   setRequests]   = useState<JoinRequest[]>([]);
  const [editName,   setEditName]   = useState(cached?.group.name ?? "");
  const [editDesc,   setEditDesc]   = useState(cached?.group.description ?? "");
  const [savingInfo, setSavingInfo] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [addSearch,  setAddSearch]  = useState("");
  const [searchRes,  setSearchRes]  = useState<UserProfile[]>([]);
  const [busy,       setBusy]       = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showLeave,  setShowLeave]  = useState(false);
  const [isClosing,  setIsClosing]  = useState(false);
  const avatarRef   = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin   = group?.my_role === "admin";
  const inviteUrl = group ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${group.invite_token}` : "";

  // Animated back navigation
  function goBack() {
    setIsClosing(true);
    setTimeout(() => router.back(), 200);
  }

  useEffect(() => {
    Promise.all([groupsApi.get(groupId), groupsApi.members(groupId)])
      .then(([g, mems]) => {
        setGroup(g); setMembers(mems);
        setEditName(g.name); setEditDesc(g.description ?? "");
        if (g.my_role === "admin") groupsApi.joinRequests(groupId).then(setRequests).catch(()=>{});
      })
      .catch(() => router.replace("/messages"));
  }, [groupId, router]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (addSearch.trim().length < 2) { setSearchRes([]); return; }
    searchTimer.current = setTimeout(() => { authApi.searchUsers(addSearch).then(r => setSearchRes(r.filter(u => !members.some(m => m.user_id === u.id) && u.id !== user?.id))).catch(()=>{}); }, 250);
  }, [addSearch, members, user?.id]);

  async function saveInfo() {
    if (!group || !editName.trim()) return;
    setSavingInfo(true);
    try { const u = await groupsApi.update(groupId, { name: editName.trim(), description: editDesc.trim() || undefined }); setGroup(u); }
    catch { /**/ } finally { setSavingInfo(false); }
  }

  async function toggle(field: "invite_enabled" | "auto_approve") {
    if (!group) return;
    const updated = await groupsApi.update(groupId, { [field]: !group[field] });
    setGroup(updated);
  }

  async function resetLink() { const u = await groupsApi.resetInvite(groupId); setGroup(u); }
  function copyInvite() { navigator.clipboard?.writeText(inviteUrl).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }); }

  async function addMember(userId: number) { setBusy(userId); try { await groupsApi.addMember(groupId, userId); setMembers(await groupsApi.members(groupId)); setAddSearch(""); setSearchRes([]); } catch{/**/ } finally { setBusy(null); } }
  async function removeMember(uid: number) { setBusy(uid); try { await groupsApi.removeMember(groupId, uid); setMembers(p => p.filter(m => m.user_id !== uid)); } catch{/**/ } finally { setBusy(null); } }
  async function toggleAdmin(m: GroupMember) { setBusy(m.user_id); try { await groupsApi.updateMemberRole(groupId, m.user_id, m.role === "admin" ? "member" : "admin"); setMembers(p => p.map(x => x.user_id === m.user_id ? { ...x, role: x.role === "admin" ? "member" : "admin" } : x)); } catch{/**/ } finally { setBusy(null); } }
  async function respondReq(req: JoinRequest, action: "approve" | "reject") { setBusy(req.id); try { await groupsApi.respondToRequest(groupId, req.id, action); setRequests(p => p.filter(r => r.id !== req.id)); if (action === "approve") setMembers(await groupsApi.members(groupId)); } catch{/**/ } finally { setBusy(null); } }

  // Show spinner only if no cached data yet
  if (!group) return <div className="fixed inset-0 flex items-center justify-center bg-white"><div className="h-5 w-5 border-2 border-neutral-200 border-t-neutral-700 rounded-full animate-spin" /></div>;

  return (
    <div className={`fixed inset-0 z-40 flex flex-col bg-white md:static md:inset-auto md:min-h-dvh md:mx-auto md:max-w-2xl ${isClosing ? "sheet-slide-out" : "sheet-slide-in"}`}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 bg-white border-b border-gray-100 px-3 py-2.5 z-10">
        <button onClick={goBack} className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">{group.name}</p>
          <p className="text-xs text-gray-400">Group Settings</p>
        </div>
        {isAdmin && (
          <button onClick={saveInfo} disabled={savingInfo || !editName.trim()}
            className="text-[13px] font-medium text-neutral-900 disabled:opacity-30 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors shrink-0">
            {savingInfo ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="relative">
              <Avatar name={group.name} b64={group.avatar_base64} size="lg" />
              {isAdmin && (
                <button onClick={() => avatarRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-md">
                  <Camera size={13} />
                </button>
              )}
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) cropSquare(f).then(b64 => groupsApi.updateAvatar(groupId, b64).then(setGroup)); e.target.value = ""; }} />

            {isAdmin ? (
              <div className="w-full space-y-2">
                <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={80} placeholder="Group name"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-[14px] font-semibold outline-none focus:border-neutral-900 transition-colors" />
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} maxLength={200} placeholder="Add a description…"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-[13px] text-neutral-600 outline-none focus:border-neutral-900 transition-colors" />
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[17px] font-bold">{group.name}</p>
                {group.description && <p className="text-[13px] text-neutral-500 mt-0.5">{group.description}</p>}
              </div>
            )}
          </div>

          {/* Invite settings */}
          {isAdmin && (
            <div className="rounded-2xl border border-neutral-200 overflow-hidden">
              <p className="px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest border-b border-neutral-100">Invite & Access</p>

              <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-50">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-[14px] font-medium">Invite link</p>
                  <p className="text-[12px] text-neutral-400 mt-0.5">Allow members to join via a shareable link</p>
                </div>
                <Toggle on={group.invite_enabled} onChange={() => toggle("invite_enabled")} />
              </div>

              <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-50">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-[14px] font-medium">Auto-approve members</p>
                  <p className="text-[12px] text-neutral-400 mt-0.5">People join instantly — no admin approval needed</p>
                </div>
                <Toggle on={group.auto_approve} onChange={() => toggle("auto_approve")} disabled={!group.invite_enabled} />
              </div>

              {group.invite_enabled && (
                <div className="px-4 py-3 space-y-2.5">
                  <p className="text-[11px] text-neutral-500 font-mono bg-neutral-50 rounded-xl px-3 py-2 break-all border border-neutral-100">{inviteUrl}</p>
                  <div className="flex gap-2">
                    <button onClick={copyInvite}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12.5px] font-medium transition-colors ${linkCopied ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>
                      {linkCopied ? <Check size={13} /> : <Copy size={13} />} {linkCopied ? "Copied!" : "Copy link"}
                    </button>
                    <button onClick={resetLink}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12.5px] font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors">
                      <RefreshCw size={13} /> Reset link
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Join requests */}
          {isAdmin && requests.length > 0 && (
            <div className="rounded-2xl border border-amber-200 overflow-hidden">
              <p className="px-4 py-3 text-[13px] font-semibold text-amber-700 border-b border-amber-100 flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-amber-500 text-white text-[11px] font-bold grid place-items-center">{requests.length}</span>
                Join request{requests.length !== 1 ? "s" : ""}
              </p>
              {requests.map(req => (
                <div key={req.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-amber-50">
                  <Avatar name={req.full_name} b64={req.avatar_base64} size="sm" />
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{req.full_name}</p>{req.username && <p className="text-[11px] text-neutral-400">@{req.username}</p>}</div>
                  <button onClick={() => respondReq(req, "approve")} disabled={busy === req.id} className="h-8 w-8 rounded-full bg-neutral-900 text-white flex items-center justify-center disabled:opacity-40"><Check size={14} /></button>
                  <button onClick={() => respondReq(req, "reject")} disabled={busy === req.id} className="h-8 w-8 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center disabled:opacity-40"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Members */}
          <div className="rounded-2xl border border-neutral-200 overflow-hidden">
            <p className="px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest border-b border-neutral-100 flex items-center gap-2">
              <Users size={12} /> {members.length} Member{members.length !== 1 ? "s" : ""}
            </p>
            {isAdmin && (
              <div className="px-4 py-3 border-b border-neutral-100">
                <div className="flex items-center gap-2 rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2.5">
                  <UserPlus size={13} className="text-neutral-400" />
                  <input type="text" placeholder="Add people by name…" value={addSearch} onChange={e => setAddSearch(e.target.value)} className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400" />
                  {addSearch && <button onClick={() => { setAddSearch(""); setSearchRes([]); }}><X size={13} className="text-neutral-400" /></button>}
                </div>
                {searchRes.length > 0 && (
                  <div className="mt-1.5 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
                    {searchRes.slice(0, 5).map(u => (
                      <button key={u.id} onClick={() => addMember(u.id)} disabled={busy === u.id} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 text-left disabled:opacity-50 transition-colors">
                        <Avatar name={u.full_name} b64={u.avatar_base64} size="sm" />
                        <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{u.full_name}</p>{u.username && <p className="text-[11px] text-neutral-400">@{u.username}</p>}</div>
                        {busy === u.id ? <div className="h-4 w-4 border-2 border-neutral-300 border-t-neutral-700 rounded-full animate-spin" /> : <UserPlus size={14} className="text-neutral-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-neutral-50">
                <Avatar name={m.full_name} b64={m.avatar_base64} size="sm" />
                <div className="flex-1 min-w-0"><p className="text-[13.5px] font-medium truncate">{m.full_name}</p>{m.username && <p className="text-[11px] text-neutral-400">@{m.username}</p>}</div>
                {m.role === "admin" && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">Admin</span>}
                {isAdmin && m.user_id !== user?.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleAdmin(m)} disabled={busy === m.user_id} title={m.role === "admin" ? "Remove admin" : "Make admin"}
                      className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${m.role === "admin" ? "text-violet-600 bg-violet-50 hover:bg-violet-100" : "text-neutral-400 hover:bg-neutral-100"}`}>
                      <Shield size={14} />
                    </button>
                    <button onClick={() => removeMember(m.user_id)} disabled={busy === m.user_id}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40">
                      <UserMinus size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Danger zone */}
          <div className="space-y-2 pb-8">
            <button onClick={() => setShowLeave(true)}
              className="w-full py-3 rounded-2xl border border-red-200 text-red-500 text-[13.5px] font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
              <LogOut size={14} /> Leave group
            </button>
            {isAdmin && (
              <button onClick={() => setShowDelete(true)}
                className="w-full py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-[13.5px] font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                <Trash2 size={14} /> Delete group
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leave confirm */}
      {showLeave && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4" onClick={() => setShowLeave(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <LogOut size={24} className="text-red-500 mx-auto mb-3" />
            <p className="text-[15px] font-semibold text-center mb-1">Leave &quot;{group.name}&quot;?</p>
            <p className="text-[12px] text-neutral-500 text-center mb-4">You can rejoin later if the group has an invite link.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowLeave(false)} className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 text-[13px] font-medium">Cancel</button>
              <button
                onClick={() => groupsApi.removeMember(groupId, user!.id).then(() => router.replace("/messages"))}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[13px] font-medium"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4" onClick={() => setShowDelete(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <AlertTriangle size={24} className="text-red-500 mx-auto mb-3" />
            <p className="text-[15px] font-semibold text-center mb-1">Delete &quot;{group.name}&quot;?</p>
            <p className="text-[12px] text-neutral-500 text-center mb-4">All messages and members will be permanently removed.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDelete(false)} className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 text-[13px] font-medium">Cancel</button>
              <button onClick={() => groupsApi.delete(groupId).then(() => router.replace("/messages"))} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
