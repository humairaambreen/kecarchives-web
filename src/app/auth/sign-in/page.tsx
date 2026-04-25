"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Shield, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { auth as authApi } from "@/lib/api";
import Cookies from "js-cookie";

type Step = "credentials" | "admin-otp";

export default function SignInPage() {
  const router = useRouter();
  const { login, user, error, clearError } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const emailFromQuery = query.get("email") || "";
    if (emailFromQuery) {
      setIdentifier(emailFromQuery);
      setAlreadyRegistered(true);
    }
  }, []);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [adminPwError, setAdminPwError] = useState("");

  useEffect(() => {
    if (user && step === "credentials") router.push("/feed");
  }, [user, router, step]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password) return;
    setSubmitting(true);
    setAdminPwError("");

    try {
      const isEmailFormat = identifier.includes("@");
      const { is_admin_email } = isEmailFormat
        ? await authApi.checkAdmin(identifier)
        : { is_admin_email: false };
      if (is_admin_email) {
        try {
          await authApi.adminLogin(identifier, password);
          setStep("admin-otp");
        } catch {
          setAdminPwError("Invalid admin password.");
        }
        setSubmitting(false);
        return;
      }
    } catch {
      // not admin
    }

    try {
      await login(identifier, password);
      router.push("/feed");
    } catch (err) {
      const message = (err instanceof Error ? err.message : "").toLowerCase();
      // Only redirect to register if the account genuinely doesn't exist
      if (message.includes("not found") || message.includes("no account") || message.includes("does not exist")) {
        clearError();
        const query = new URLSearchParams({ email: identifier });
        router.push(`/auth/register?${query.toString()}`);
        return;
      }
      // Wrong password or any other error — show it directly, never redirect
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setSubmitting(true);
    setOtpError("");
    try {
      const tokens = await authApi.verifyAdminOtp(identifier, otp);
      Cookies.set("access_token", tokens.access_token, { sameSite: "lax", expires: 1 });
      Cookies.set("refresh_token", tokens.refresh_token, { sameSite: "lax", expires: 7 });
      window.location.href = "/dashboard/admin";
    } catch {
      setOtpError("Invalid OTP. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
        .auth-root { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.28s ease forwards; }
        .input-field {
          width: 100%;
          border-radius: 14px;
          border: 1px solid #e5e5e5;
          padding: 11px 14px;
          font-size: 13.5px;
          font-family: inherit;
          background: #fafafa;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          color: #171717;
        }
        .input-field:focus {
          border-color: #a3a3a3;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
        }
        .input-field::placeholder { color: #a3a3a3; }
        .otp-field {
          letter-spacing: 0.35em;
          text-align: center;
          font-size: 20px;
          font-weight: 500;
        }
      `}</style>

      <div className="auth-root min-h-dvh bg-white flex items-center justify-center px-5">
        <div className="w-full max-w-[360px] fade-up">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-neutral-400 mb-2">KEC Archives</p>
            <h1 className="text-[26px] font-semibold tracking-tight text-neutral-950 leading-tight">
              {step === "admin-otp" ? "Admin verification" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-neutral-400">
              {step === "admin-otp"
                ? `Enter the OTP sent to ${identifier}`
                : "Sign in to continue to your account"}
            </p>
          </div>

          {/* Error banners */}
          {alreadyRegistered && !error && !adminPwError && (
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-blue-700 flex items-start justify-between gap-3">
              <span>This email is already registered. Sign in below.</span>
              <button
                onClick={() => setAlreadyRegistered(false)}
                className="text-blue-400 hover:text-blue-600 transition-colors text-[11px] underline shrink-0 mt-px"
              >
                Dismiss
              </button>
            </div>
          )}
          {(error || adminPwError || otpError) && (
            <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600 flex items-start justify-between gap-3">
              <span>{error || adminPwError || otpError}</span>
              <button
                onClick={() => { clearError(); setAdminPwError(""); setOtpError(""); }}
                className="text-red-400 hover:text-red-600 transition-colors text-[11px] underline shrink-0 mt-px"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ── Step 1: Credentials ── */}
          {step === "credentials" && (
            <>
              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" data-lpignore="true" data-form-type="other">
                <input type="text" name="hidden_user" style={{ display: "none" }} tabIndex={-1} />
                <input type="password" name="hidden_pass" style={{ display: "none" }} tabIndex={-1} />

                <div>
                  <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">
                    Email or Username
                  </label>
                  <input
                    type="text"
                    name="kec_ident"
                    className="input-field"
                    placeholder="email@example.com or username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold text-neutral-500 tracking-wide uppercase">Password</label>
                    <Link href="/auth/forgot-password" className="text-[12px] text-neutral-400 hover:text-neutral-700 transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      name="kec_secret"
                      className="input-field"
                      style={showPw ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-neutral-900 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-40 mt-1"
                >
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <p className="mt-6 text-center text-[13px] text-neutral-400">
                Don&apos;t have an account?{" "}
                <Link href="/auth/register" className="font-semibold text-neutral-900 hover:underline underline-offset-2">
                  Register
                </Link>
              </p>
            </>
          )}

          {/* ── Step 2: Admin OTP ── */}
          {step === "admin-otp" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <Shield size={15} className="text-neutral-400 shrink-0" />
                <p className="text-[13px] text-neutral-500">Two-factor verification required for admin access.</p>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">OTP Code</label>
                  <input
                    type="text"
                    className="input-field otp-field"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || otp.length < 6}
                  className="w-full rounded-full bg-neutral-900 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-40"
                >
                  {submitting ? "Verifying…" : "Verify & access admin"}
                </button>
              </form>

              <button
                onClick={() => { setStep("credentials"); setOtp(""); setOtpError(""); }}
                className="flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <ArrowLeft size={13} /> Back to sign in
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}