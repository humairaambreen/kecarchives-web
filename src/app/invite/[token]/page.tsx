"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { groups as groupsApi, type GroupInviteInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [info, setInfo]     = useState<GroupInviteInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [joining, setJoining] = useState(false);
  const [result, setResult]   = useState<"joined" | "pending" | null>(null);

  useEffect(() => {
    groupsApi.getByInvite(token)
      .then(d => { setInfo(d); setStatus("ok"); })
      .catch(() => setStatus("error"));
  }, [token]);

  async function handleJoin() {
    if (!user) { router.push(`/auth/sign-in?next=/invite/${token}`); return; }
    setJoining(true);
    try {
      const res = await groupsApi.joinViaInvite(token);
      if (res.status === "already_member") { router.replace(`/groups/${res.group_id}`); return; }
      setResult(res.status === "pending_approval" ? "pending" : "joined");
      if (res.status !== "pending_approval") {
        setTimeout(() => router.replace(`/groups/${res.group_id}`), 1500);
      }
    } catch { /**/ } finally { setJoining(false); }
  }

  if (authLoading || status === "loading") return (
    <div className="min-h-dvh flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-neutral-400" />
    </div>
  );

  if (status === "error") return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-3">
      <XCircle size={40} className="text-red-400" />
      <p className="text-[17px] font-semibold">Invalid invite link</p>
      <p className="text-[13px] text-neutral-500">This link may have expired or been disabled.</p>
      <Link href="/feed" className="mt-2 text-[13px] font-medium text-neutral-900 underline">Back to feed</Link>
    </div>
  );

  if (!info) return null;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm">
        {/* Group avatar */}
        <div className="flex justify-center mb-5">
          <div className="h-20 w-20 rounded-full bg-neutral-900 text-white text-[28px] font-bold grid place-items-center overflow-hidden shadow-xl">
            {info.avatar_base64
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={info.avatar_base64} alt={info.name} className="h-full w-full object-cover" />
              : info.name[0]?.toUpperCase()}
          </div>
        </div>

        {/* Invite message */}
        {user && (
          <p className="text-center text-[13px] text-neutral-500 mb-1">
            You&apos;ve been invited to join
          </p>
        )}
        <h1 className="text-[22px] font-bold text-center text-neutral-900 mb-1">{info.name}</h1>
        {info.description && (
          <p className="text-[13px] text-neutral-500 text-center mb-3">{info.description}</p>
        )}
        <div className="flex items-center justify-center gap-1.5 text-[12px] text-neutral-400 mb-8">
          <Users size={13} />
          {info.member_count} member{info.member_count !== 1 ? "s" : ""}
        </div>

        {/* Result states */}
        {result === "pending" ? (
          <div className="text-center space-y-3">
            <Loader2 size={28} className="animate-spin text-amber-500 mx-auto" />
            <p className="text-[15px] font-semibold text-neutral-900">Request sent!</p>
            <p className="text-[13px] text-neutral-500">
              A group admin will review your request. You&apos;ll be able to join once approved.
            </p>
            <Link href="/messages" className="block mt-4 text-[13px] font-medium text-neutral-900 underline">
              Go to messages
            </Link>
          </div>
        ) : result === "joined" ? (
          <div className="text-center space-y-3">
            <CheckCircle size={36} className="text-green-500 mx-auto" />
            <p className="text-[15px] font-semibold">Joining group…</p>
          </div>
        ) : info.already_member ? (
          <div className="space-y-3">
            <Link href={`/groups/${info.id}`}
              className="block w-full py-3.5 rounded-2xl bg-neutral-900 text-white text-[14px] font-semibold text-center">
              Open group
            </Link>
          </div>
        ) : info.pending_approval ? (
          <div className="text-center space-y-3">
            <p className="text-[14px] text-neutral-600">Your join request is pending admin approval.</p>
            <Link href="/messages" className="text-[13px] font-medium text-neutral-900 underline">
              Go to messages
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {!user ? (
              <>
                <Link href={`/auth/sign-in?next=/invite/${token}`}
                  className="block w-full py-3.5 rounded-2xl bg-neutral-900 text-white text-[14px] font-semibold text-center">
                  Sign in to join
                </Link>
                <Link href={`/auth/register`}
                  className="block w-full py-3.5 rounded-2xl border border-neutral-200 text-neutral-700 text-[14px] font-semibold text-center">
                  Create account
                </Link>
              </>
            ) : (
              <button onClick={handleJoin} disabled={joining}
                className="w-full py-3.5 rounded-2xl bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {joining ? <><Loader2 size={16} className="animate-spin" /> Joining…</> : "Join group"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
