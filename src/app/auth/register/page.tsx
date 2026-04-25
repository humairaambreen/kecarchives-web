"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { auth as authApi, ApiError } from "@/lib/api";

type Step = "form" | "otp";

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, error, clearError } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (user) router.push("/feed");
  }, [user, router]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const emailFromQuery = query.get("email") || "";
    // Never prefill password from URL — it's a security risk
    if (emailFromQuery) { setEmail(emailFromQuery); clearError(); }
  }, [clearError]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  useEffect(() => {
    if (!username || username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus("idle"); return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const { available } = await authApi.checkUsername(username);
        setUsernameStatus(available ? "available" : "taken");
      } catch { setUsernameStatus("idle"); }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const strength = password.length >= 12 ? "strong" : password.length >= 8 ? "medium" : password.length > 0 ? "weak" : "";
  const strengthColor = strength === "strong" ? "#10b981" : strength === "medium" ? "#f59e0b" : "#ef4444";
  const strengthW = strength === "strong" ? "100%" : strength === "medium" ? "66%" : strength === "weak" ? "33%" : "0%";

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (password !== confirm || usernameStatus === "taken") return;
    setSubmitting(true);
    setOtpError("");
    try {
      // Check if this email is already registered before wasting an OTP
      try {
        const { registered } = await authApi.checkEmail(email);
        if (registered) {
          const query = new URLSearchParams({ email });
          router.push(`/auth/sign-in?${query.toString()}`);
          return;
        }
      } catch (err) {
        // If checkEmail endpoint doesn't exist or fails, fall through
        // and let the register call handle the duplicate email error
        if (err instanceof ApiError && err.status !== 404) throw err;
      }
      await authApi.sendOtp(email, "verify");
      setStep("otp");
      setResendTimer(60);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally { setSubmitting(false); }
  }

  async function handleVerifyAndRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length < 6) return;
    setSubmitting(true);
    setOtpError("");
    try {
      await authApi.verifyOtp(email, otp);
      await register(fullName, username, email, password);
      router.push("/feed");
    } catch (err) {
      const message = (err instanceof Error ? err.message : "").toLowerCase();
      // If email is already registered, send them to sign-in instead
      if (message.includes("already") || message.includes("exists") || message.includes("registered")) {
        const query = new URLSearchParams({ email });
        router.push(`/auth/sign-in?${query.toString()}`);
        return;
      }
      setOtpError(err instanceof Error ? err.message : "Invalid OTP");
    } finally { setSubmitting(false); }
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
        .otp-field { letter-spacing: 0.35em; text-align: center; font-size: 20px; font-weight: 500; }
      `}</style>

      <div className="auth-root min-h-dvh bg-white flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[360px] fade-up">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-neutral-400 mb-2">KEC Archives</p>
            <h1 className="text-[26px] font-semibold tracking-tight text-neutral-950 leading-tight">
              {step === "form" ? "Create an account" : "Verify your email"}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-neutral-400">
              {step === "form"
                ? "Fill in your details to get started"
                : <>We sent a code to <strong className="text-neutral-700">{email}</strong></>}
            </p>
          </div>

          {/* Error banner */}
          {(error || otpError) && (
            <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600 flex items-start justify-between gap-3">
              <span>
                {error || otpError}
                {(error || "").toLowerCase().includes("already") && (
                  <span className="block mt-1.5 text-[12px]">
                    Already registered?{" "}
                    <Link href="/auth/sign-in" className="font-semibold text-red-700 underline underline-offset-2">Sign in</Link>
                  </span>
                )}
              </span>
              <button
                onClick={() => { clearError(); setOtpError(""); }}
                className="text-red-400 hover:text-red-600 transition-colors text-[11px] underline shrink-0 mt-px"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ── Step 1: Form ── */}
          {step === "form" && (
            <>
              <form onSubmit={handleSendOtp} className="space-y-4" autoComplete="off" data-lpignore="true" data-form-type="other">

                {/* Full name */}
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">Full Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">Username</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="input-field"
                      style={{ paddingRight: 40 }}
                      placeholder="your_username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      required
                      minLength={3}
                      maxLength={40}
                      autoComplete="off"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {usernameStatus === "checking" && <Loader2 size={14} className="text-neutral-400 animate-spin" />}
                      {usernameStatus === "available" && <Check size={14} className="text-emerald-500" />}
                      {usernameStatus === "taken" && <span className="text-[11px] font-semibold text-red-500">Taken</span>}
                    </div>
                  </div>
                  {username && username.length < 3 && (
                    <p className="mt-1.5 text-[12px] text-neutral-400">At least 3 characters required</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">Email</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">Password</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="input-field"
                      style={showPw ? { paddingRight: 40 } : { WebkitTextSecurity: "disc", paddingRight: 40 } as React.CSSProperties}
                      name="kec_secret"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
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
                  {strength && (
                    <div className="mt-2.5 flex items-center gap-2.5">
                      <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: strengthW, background: strengthColor }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold capitalize" style={{ color: strengthColor }}>
                        {strength}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">Confirm Password</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="input-field"
                      style={{ WebkitTextSecurity: "disc", paddingRight: 40 } as React.CSSProperties}
                      name="kec_confirm"
                      placeholder="Repeat your password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="off"
                    />
                    {confirm && password === confirm && (
                      <Check size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                    )}
                  </div>
                  {confirm && password !== confirm && (
                    <p className="mt-1.5 text-[12px] text-red-500">Passwords don&apos;t match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    submitting || !fullName || !username || username.length < 3 ||
                    usernameStatus === "taken" || !email || password.length < 8 || password !== confirm
                  }
                  className="w-full rounded-full bg-neutral-900 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-40 mt-1"
                >
                  {submitting ? "Sending code…" : "Continue"}
                </button>
              </form>

              <p className="mt-6 text-center text-[13px] text-neutral-400">
                Already have an account?{" "}
                <Link href="/auth/sign-in" className="font-semibold text-neutral-900 hover:underline underline-offset-2">
                  Sign in
                </Link>
              </p>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <div className="space-y-4">
              <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">Verification Code</label>
                  <input
                    type="text"
                    className="input-field otp-field"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    autoFocus
                  />
                  {/* Progress dots */}
                  <div className="flex justify-center gap-1.5 mt-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-1 w-5 rounded-full transition-all duration-200"
                        style={{ background: i < otp.length ? "#171717" : "#e5e5e5" }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || otp.length < 6}
                  className="w-full rounded-full bg-neutral-900 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-40"
                >
                  {submitting ? "Verifying…" : "Verify & create account"}
                </button>
              </form>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { setStep("form"); setOtp(""); setOtpError(""); }}
                  className="flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors"
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <button
                  onClick={() => handleSendOtp()}
                  disabled={resendTimer > 0}
                  className="text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors disabled:opacity-40"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}