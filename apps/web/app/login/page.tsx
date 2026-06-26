"use client";

import { getProviders, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);

  useEffect(() => {
    getProviders()
      .then((providers) => setGoogleAuthEnabled(Boolean(providers?.google)))
      .catch(() => setGoogleAuthEnabled(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setNeedsVerification(false);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      if (res.error === "Email not verified") {
        setNeedsVerification(true);
        setError("Verify your email before signing in. You can resend the verification code below.");
      } else if (res.error === "Too many login attempts") {
        setError("Too many login attempts. Try again later.");
      } else {
        setError("Invalid email or password");
      }
      setIsLoading(false);
    } else {
      router.push("/projects");
    }
  };

  const handleResendVerification = async () => {
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

      setError("Verification code sent. Check your email.");
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
            <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
            <p className="text-sm text-[#cfe0ea]">Sign in to manage your security scans</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4 pt-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl space-y-3">
                {error}
                {needsVerification ? (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending || !email}
                    className="block text-[#00c9e8] hover:opacity-80 font-bold disabled:opacity-50"
                  >
                    {isResending ? "Sending..." : "Resend verification code"}
                  </button>
                ) : null}
              </div>
            )}
            
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
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-b from-[#21dcf8] to-[#0797b9] hover:opacity-90 text-white py-3 rounded-xl font-bold transition-all duration-200 shadow-[0_0_22px_rgba(0,207,234,0.34)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? "Signing in..." : "Sign In"}</span>
            </button>
          </form>

          {googleAuthEnabled ? (
          <div className="w-full space-y-4 pt-2">
              <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 px-4 text-xs text-slate-500 font-medium">OR</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              onClick={() => signIn("google", { callbackUrl: "/projects" })}
              className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-slate-50 text-zinc-900 px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-sm border border-slate-200 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
          ) : null}

          <p className="text-sm text-slate-400 pt-2">
            Don't have an account?{" "}
            <Link href="/register" className="text-[#00c9e8] hover:opacity-80 font-bold">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
