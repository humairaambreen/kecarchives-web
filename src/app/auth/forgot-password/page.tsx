"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { auth } from "@/lib/api";

type Step = "email" | "otp" | "new-password" | "done";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await auth.forgotPassword(email);
      setStep("otp");
      setResendTimer(60);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally { setSubmitting(false); }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    setSubmitting(true);
    setError("");
    try {
      await auth.resetPassword(email, otp, newPassword);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP or something went wrong.");
    } finally { setSubmitting(false); }
  }

  const stepLabels: Record<Step, string> = {
    email: "Reset your password",
    otp: "Check your email",
    "new-password": "Set new password",
    done: "All done",
  };

  const stepSubs: Partial<Record<Step, React.ReactNode>> = {
    email: "Enter your email and we'll send you a verification code",
    otp: <span>We sent a 6-digit code to <strong className="text-neutral-700">{email}</strong></span>,
    "new-password": "Choose a strong new password for your account",
  };

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

      <div className="auth-root min-h-dvh bg-white flex items-center justify-center px-5">
        <div className="w-full max-w-[360px] fade-up">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-neutral-400 mb-2">KEC Archives</p>
            <h1 className="text-[26px] font-semibold tracking-tight text-neutral-950 leading-tight">
              {stepLabels[step]}
            </h1>
            {stepSubs[step] && (
              <p className="mt-1.5 text-[13.5px] text-neutral-400">{stepSubs[step]}</p>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600 flex items-start justify-between gap-3">
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 transition-colors text-[11px] underline shrink-0 mt-px">
                Dismiss
              </button>
            </div>
          )}

          {/* ── Step 1: Email ── */}
          {step === "email" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full rounded-full bg-neutral-900 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-40"
              >
                {submitting ? "Sending…" : "Send code"}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <div className="space-y-4">
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
                onClick={() => { if (otp.length === 6) setStep("new-password"); }}
                disabled={otp.length < 6}
                className="w-full rounded-full bg-neutral-900 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-40"
              >
                Continue
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { setStep("email"); setOtp(""); setError(""); }}
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

          {/* ── Step 3: New password ── */}
          {step === "new-password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">New Password</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input-field"
                    style={showPw ? { paddingRight: 40 } : { WebkitTextSecurity: "disc", paddingRight: 40 } as React.CSSProperties}
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="off"
                    autoFocus
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

              <div>
                <label className="block text-[12px] font-semibold text-neutral-500 mb-2 tracking-wide uppercase">Confirm Password</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input-field"
                    style={{ WebkitTextSecurity: "disc", paddingRight: 40 } as React.CSSProperties}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="off"
                  />
                  {confirmPassword && newPassword === confirmPassword && (
                    <Check size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1.5 text-[12px] text-red-500">Passwords don&apos;t match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || newPassword.length < 8 || newPassword !== confirmPassword}
                className="w-full rounded-full bg-neutral-900 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-40"
              >
                {submitting ? "Resetting…" : "Reset password"}
              </button>

              <button
                type="button"
                onClick={() => setStep("otp")}
                className="flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <ArrowLeft size={13} /> Back to code
              </button>
            </form>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <div className="text-center py-4 space-y-5">
              <div className="mx-auto h-14 w-14 rounded-full bg-neutral-50 border border-neutral-100 grid place-items-center">
                <Check size={22} className="text-emerald-500" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-neutral-900">Password updated</p>
                <p className="mt-1 text-[13.5px] text-neutral-400">You can now sign in with your new password.</p>
              </div>
              <Link
                href="/auth/sign-in"
                className="inline-block rounded-full bg-neutral-900 px-7 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors"
              >
                Sign in
              </Link>
            </div>
          )}

          {/* Back to sign in */}
          {step !== "done" && (
            <div className="mt-7 text-center">
              <Link
                href="/auth/sign-in"
                className="inline-flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <ArrowLeft size={13} /> Back to sign in
              </Link>
            </div>
          )}

        </div>
      </div>
    </>
  );
}