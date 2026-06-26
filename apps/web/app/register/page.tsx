"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

      // Automatically sign in after successful registration
      const signInResult = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (signInResult?.error) {
        throw new Error("Failed to auto-login after registration");
      }

      router.push("/projects");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-light-page min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px]" />

      <div className="relative z-10 w-full max-w-md p-8 bg-white/85 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-cyan-500">
              ScanVul AI
            </h1>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Create an account</h2>
            <p className="text-sm text-slate-500">Start securing your code today</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4 pt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">
                {error}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 ml-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 transition-all placeholder:text-slate-400"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand hover:opacity-90 text-white py-3 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-brand/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? "Creating account..." : "Sign Up"}</span>
            </button>
          </form>

          <p className="text-sm text-slate-500 pt-2">
            Already have an account?{" "}
            <Link href="/login" className="text-brand hover:opacity-80 font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
