"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Palette, UserCircle2, AtSign, Loader2, Check, X, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { auth as authApi } from "@/lib/api";

const THEMES = [
  { id: "default", label: "Default" },
  { id: "slate", label: "Slate" },
  { id: "sepia", label: "Sepia" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeId>("default");

  // Username state
  const [username, setUsername] = useState(user?.username || "");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "same">("idle");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState("");

  useEffect(() => {
    if (user?.username) setUsername(user.username);
  }, [user?.username]);

  // Check username availability with debounce
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    if (trimmed === user?.username) {
      setUsernameStatus("same");
      return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(trimmed);
        setUsernameStatus(res.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username, user?.username]);

  const saveUsername = useCallback(async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3 || usernameStatus === "taken") return;
    setUsernameSaving(true);
    setUsernameMsg("");
    try {
      await authApi.updateMe({
        full_name: user?.full_name || "",
        avatar_base64: user?.avatar_base64 ?? null,
        banner_base64: user?.banner_base64 ?? null,
        username: trimmed,
      });
      await refreshUser();
      setUsernameMsg("Username updated!");
      setUsernameStatus("same");
    } catch (err: unknown) {
      setUsernameMsg(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUsernameSaving(false);
    }
  }, [username, usernameStatus, user, refreshUser]);

  useEffect(() => {
    const saved = (localStorage.getItem("kec-theme") as ThemeId | null) || "default";
    setTheme(saved);
    if (saved === "default") {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function applyTheme(next: ThemeId) {
    setTheme(next);
    localStorage.setItem("kec-theme", next);
    if (next === "default") {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    document.documentElement.setAttribute("data-theme", next);
  }

  const canSaveUsername = usernameStatus === "available" && username.trim().length >= 3;

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDeleteAccount = deleteConfirmText === "delete my account" && deletePassword.length > 0;

  const handleDeleteAccount = useCallback(async () => {
    if (!canDeleteAccount) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await authApi.deleteMe(deletePassword);
      logout();
      router.push("/auth/sign-in");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  }, [canDeleteAccount, deletePassword, logout, router]);

  return (
    <main className="space-y-5">
      <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black transition-colors">
        <ArrowLeft size={14} />
        Back to Feed
      </Link>

      <section className="rounded-xl border border-gray-200 p-6">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Control your app appearance and profile settings.</p>

        {/* Username */}
        <div className="mt-6 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <AtSign size={16} className="text-gray-500" />
            <h2 className="text-sm font-semibold">Username</h2>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Your unique username for your profile URL and mentions.</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-9 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
                placeholder="your_username"
                maxLength={40}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && <Loader2 size={14} className="animate-spin text-gray-400" />}
                {usernameStatus === "available" && <Check size={14} className="text-green-500" />}
                {usernameStatus === "taken" && <X size={14} className="text-red-500" />}
              </div>
            </div>
            <button
              onClick={saveUsername}
              disabled={!canSaveUsername || usernameSaving}
              className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium disabled:opacity-40 transition-opacity"
            >
              {usernameSaving ? "Saving..." : "Save"}
            </button>
          </div>
          {usernameStatus === "taken" && <p className="mt-1.5 text-xs text-red-500">This username is already taken</p>}
          {usernameMsg && <p className="mt-1.5 text-xs text-green-600">{usernameMsg}</p>}
        </div>

        {/* Theme */}
        <div className="mt-4 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-gray-500" />
            <h2 className="text-sm font-semibold">Theme</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyTheme(item.id)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  theme === item.id ? "border-black bg-black text-white" : "border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Profile */}
        <div className="mt-4 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <UserCircle2 size={16} className="text-gray-500" />
            <h2 className="text-sm font-semibold">Profile</h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">Update your name, profile picture, and banner from your profile page.</p>
          <Link
            href={user?.username ? `/${user.username}` : "/feed"}
            className="mt-3 inline-flex rounded-full border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
          >
            Go to Profile
          </Link>
        </div>

        {/* Danger Zone */}
        <div className="mt-4 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold text-red-600">Danger Zone</h2>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Once you delete your account, there is no going back. All your posts, messages, media, and data will be permanently removed.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              Delete My Account
            </button>
          ) : (
            <div className="mt-3 space-y-3 rounded-lg border border-red-100 bg-red-50/50 p-4">
              <p className="text-sm font-medium text-red-700">
                To confirm, type <span className="font-mono font-bold">delete my account</span> below:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toLowerCase())}
                className="w-full rounded-lg border border-red-200 bg-white py-2 px-3 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
                placeholder="delete my account"
                autoComplete="off"
              />

              <p className="text-sm font-medium text-red-700">Confirm your password:</p>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full rounded-lg border border-red-200 bg-white py-2 px-3 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
                placeholder="Your password"
                autoComplete="current-password"
              />

              {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={!canDeleteAccount || deleting}
                  className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-red-700 transition-colors"
                >
                  {deleting ? "Deleting..." : "I understand, delete my account"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
