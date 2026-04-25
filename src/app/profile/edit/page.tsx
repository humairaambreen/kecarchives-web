"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Crop } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors";

// Fixed sizes: banner 1400x440 (≈16:5), avatar 400x400 (1:1)
const BANNER_W = 1400;
const BANNER_H = 440;
const AVATAR_SIZE = 400;

function cropAndCompress(
  file: File,
  targetW: number,
  targetH: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const aspect = targetW / targetH;
      let sw = img.width;
      let sh = img.width / aspect;
      if (sh > img.height) {
        sh = img.height;
        sw = img.height * aspect;
      }
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas unavailable")); return; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not load image")); };
    img.src = objectUrl;
  });
}

export default function EditProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [bannerBase64, setBannerBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setAvatarBase64(user.avatar_base64 || null);
      setBannerBase64(user.banner_base64 || null);
    }
  }, [user]);

  async function handleAvatarChange(file: File | null) {
    if (!file) return;
    try {
      const compressed = await cropAndCompress(file, AVATAR_SIZE, AVATAR_SIZE, 0.8);
      setAvatarBase64(compressed);
    } catch {
      setError("Failed to process avatar image");
    }
  }

  async function handleBannerChange(file: File | null) {
    if (!file) return;
    try {
      const compressed = await cropAndCompress(file, BANNER_W, BANNER_H, 0.75);
      setBannerBase64(compressed);
    } catch {
      setError("Failed to process banner image");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await auth.updateMe({
        full_name: fullName.trim(),
        avatar_base64: avatarBase64,
        banner_base64: bannerBase64,
      });
      setSuccess(true);
      setTimeout(() => router.push(`/profile/${user?.id}`), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <main className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500">Sign in to edit your profile</p>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <Link href={`/profile/${user.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black transition-colors">
        <ArrowLeft size={14} />
        Back to Profile
      </Link>

      <div className="rounded-xl border border-gray-200 p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-6">Edit Profile</h1>

        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          {/* Banner */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
              Banner Image
              <span className="ml-1.5 text-[11px] text-gray-400 font-normal">Auto-cropped to 16:5</span>
            </label>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100" style={{ aspectRatio: "16/5" }}>
              {bannerBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerBase64} alt="Banner preview" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900" />
              )}
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400 transition-colors">
              <Crop size={14} />
              Upload & Crop Banner
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBannerChange(e.target.files?.[0] || null)} />
            </label>
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
              Profile Picture
              <span className="ml-1.5 text-[11px] text-gray-400 font-normal">Auto-cropped to square</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-gray-200 bg-black flex-shrink-0">
                {avatarBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarBase64} alt="Avatar preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-lg font-semibold text-white">{fullName[0] || "?"}</div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{fullName || "Your Name"}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400 transition-colors">
              <Crop size={14} />
              Upload & Crop Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)} />
            </label>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              className={inputCls}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              minLength={2}
              maxLength={120}
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" className={inputCls + " bg-gray-50 text-gray-500 cursor-not-allowed"} value={user.email} disabled />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>

          {/* Role (read-only) */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Role</label>
            <div className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 capitalize inline-block">
              {user.role}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Profile updated!</p>}

          <button
            type="submit"
            disabled={saving || !fullName.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
