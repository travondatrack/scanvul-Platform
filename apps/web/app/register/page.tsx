"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setRequiresVerification(Boolean(data.requiresVerification));
      setResendCooldown(60);
    } catch (err: any) {
      if (err.message === "Email already registered but not verified") {
        setRequiresVerification(true);
      }

      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not verify email");
      }

      const signInResult = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (signInResult?.error) {
        throw new Error("Email verified. Please sign in with your password.");
      }

      router.push("/projects");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not resend verification code");
      }

      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05090b] text-white relative overflow-hidden font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(0,201,232,0.12),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(0,112,143,0.16),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:80px_80px] opacity-35" />

      <div className="relative z-10 w-full max-w-md p-8 bg-[#0b1215]/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_14px_42px_rgba(0,0,0,0.16)]">
        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#073144] to-[#0a839b] rounded-xl flex items-center justify-center shadow-[0_0_18px_rgba(0,196,224,0.22)]">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
              ScanVul <span className="text-[#00c9e8]">AI</span>
            </h1>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {requiresVerification ? "Verify your email" : "Create an account"}
            </h2>
            <p className="text-sm text-[#cfe0ea]">
              {requiresVerification ? `Enter the 6-digit code sent to ${email}` : "Start securing your code today"}
            </p>
          </div>

          <form onSubmit={requiresVerification ? handleVerify : handleSubmit} className="w-full space-y-4 pt-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            {requiresVerification ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 ml-1">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-lg tracking-[0.35em] text-white focus:outline-none focus:border-[#00c9e8] focus:ring-1 focus:ring-[#00c9e8]/50 transition-all placeholder:text-slate-500"
                    required
                    minLength={6}
                    maxLength={6}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                  className="w-full text-sm text-[#00c9e8] hover:opacity-80 font-bold disabled:opacity-50"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : isResending ? "Sending..." : "Resend verification code"}
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 ml-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00c9e8] focus:ring-1 focus:ring-[#00c9e8]/50 transition-all placeholder:text-slate-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00c9e8] focus:ring-1 focus:ring-[#00c9e8]/50 transition-all placeholder:text-slate-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 ml-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00c9e8] focus:ring-1 focus:ring-[#00c9e8]/50 transition-all placeholder:text-slate-500"
                    required
                    minLength={8}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading || isVerifying}
              className="w-full bg-gradient-to-b from-[#21dcf8] to-[#0797b9] hover:opacity-90 text-white py-3 rounded-xl font-bold transition-all duration-200 shadow-[0_0_22px_rgba(0,207,234,0.34)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
            >
              {(isLoading || isVerifying) && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {requiresVerification
                  ? isVerifying ? "Verifying..." : "Verify Email"
                  : isLoading ? "Creating account..." : "Sign Up"}
              </span>
            </button>
          </form>

          <p className="text-sm text-slate-400 pt-2">
            Already have an account?{" "}
            <Link href="/login" className="text-[#00c9e8] hover:opacity-80 font-bold">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
