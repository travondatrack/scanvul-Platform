"use client";

import Link from "next/link";
import { ArrowRight, Code2, ScanSearch, Shield, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const stats = [
  { value: "3", accent: "Min", label: "Setup" },
  { value: "99", accent: "%", label: "Less Noise" },
  { value: "24", accent: "/7", label: "Coverage" },
];

const steps = [
  {
    icon: Code2,
    title: "Connect repo",
    text: "Link your codebase and start scanning.",
  },
  {
    icon: ScanSearch,
    title: "AI triage",
    text: "Prioritize real risks, not noisy alerts.",
  },
  {
    icon: ShieldCheck,
    title: "Ship fixes",
    text: "Apply clear fixes and release faster.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden font-sans text-white">
      <div className="relative flex min-h-screen flex-col">
        <video
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          src="https://res.cloudinary.com/df0aqbfwn/video/upload/v1782530592/newwww_mejlsj.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(2,8,12,0.72)_0%,rgba(2,8,12,0.45)_34%,rgba(2,8,12,0.1)_68%,rgba(2,8,12,0.18)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-44 bg-gradient-to-b from-transparent to-[#05090b]" />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:80px_80px] opacity-25" />

        <nav className="relative z-10">
          <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-6 sm:px-9 lg:px-12">
            <Link href="/" className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#073144] to-[#0a839b] shadow-[0_0_18px_rgba(0,196,224,0.22)]">
                <Shield className="h-6 w-6 text-white" strokeWidth={2.35} />
              </span>
              <span className="text-[24px] font-extrabold leading-none tracking-[-0.03em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
                ScanVul <span className="text-[#00c9e8]">AI</span>
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="hidden text-[18px] font-bold leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-colors hover:text-cyan-200 sm:block"
              >
                Sign In
              </Link>
              <Link
                href="#get-started"
                className={buttonVariants({ variant: "brandHero", size: "lg" })}
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 items-center px-6 pb-24 pt-4 sm:px-9 lg:px-12">
          <div className="w-full max-w-[650px]">
            <h1 className="max-w-[650px] text-[clamp(2.75rem,4.2vw,4.25rem)] font-black leading-[1.03] tracking-[-0.05em] text-white drop-shadow-[0_4px_22px_rgba(0,0,0,0.35)]">
              Secure your code with
              <span className="block bg-gradient-to-b from-[#07cdec] via-[#02b7dc] to-[#006d8d] bg-clip-text text-transparent">
                AI Precision.
              </span>
            </h1>

            <p className="mt-5 max-w-[580px] text-[clamp(1rem,1.32vw,1.2rem)] font-normal leading-[1.6] tracking-[-0.015em] text-[#d6e4ed] drop-shadow-[0_2px_14px_rgba(0,0,0,0.28)]">
              ScanVul AI combines traditional SAST, secret detection, and dependency
              scanning with an intelligent AI triage engine to eliminate false positives
              and provide actionable fixes.
            </p>

            <Link
              href="#get-started"
              className={buttonVariants({ variant: "brandHero", size: "lg", className: "mt-8 h-14 min-w-[210px] gap-3 text-[19px]" })}
            >
              <span>Start Free Trial</span>
              <ArrowRight className="h-6 w-6" strokeWidth={2.4} />
            </Link>
          </div>
          

        </main>
      </div>

      <section
        id="get-started"
        className="relative bg-[#05090b] px-6 py-24 sm:px-9 lg:px-12"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(0,201,232,0.12),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(0,112,143,0.16),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:80px_80px] opacity-35" />

        <div className="relative z-10 mx-auto max-w-[1240px]">
          <div className="max-w-[660px]">
            <div>
              <h2 className="max-w-[660px] text-[clamp(2.35rem,4vw,4rem)] font-black leading-[1.04] tracking-[-0.05em]">
                Scan, triage,
                <span className="block bg-gradient-to-b from-[#17def8] via-[#02b7dc] to-[#00708f] bg-clip-text text-transparent">
                  fix faster.
                </span>
              </h2>
            </div>
          </div>

          <div className="mt-12 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="relative rounded-[20px] border border-white/12 bg-white/[0.045] px-6 py-6 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-md"
              >
                <div className="text-[clamp(2.35rem,3.4vw,3.45rem)] font-black leading-none tracking-[-0.05em]">
                  {stat.value}
                  <span className="bg-gradient-to-b from-[#17def8] to-[#00708f] bg-clip-text text-transparent">
                    {stat.accent}
                  </span>
                </div>
                <p className="mt-3 text-[15px] leading-none text-[#cfe0ea]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className="rounded-[20px] border border-white/12 bg-[#0b1215]/80 p-6 text-left shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-md"
                >
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#07556b]/80 text-[#12d6f3] shadow-[0_0_18px_rgba(0,201,232,0.18)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[21px] font-extrabold tracking-[-0.03em] text-white">{step.title}</h3>
                  <p className="mt-3 text-[15px] leading-6 text-[#cfe0ea]">{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
