"use client";

import Link from "next/link";
import { ArrowLeft, Code2, Home, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";

const stats = [
  { value: "3", accent: "Min", label: "Average Setup Time" },
  { value: "99", accent: "%", label: "Noise Reduction Target" },
  { value: "24", accent: "/7", label: "Security Scan Coverage" },
];

const steps = [
  {
    icon: Code2,
    title: "Connect repository",
    text: "Link your codebase and let ScanVul AI prepare SAST, secret, and dependency checks.",
  },
  {
    icon: ScanSearch,
    title: "Run AI triage",
    text: "Find risky issues, collapse duplicates, and prioritize vulnerabilities worth fixing first.",
  },
  {
    icon: ShieldCheck,
    title: "Ship fixes",
    text: "Review actionable remediation guidance and move from noisy alerts to cleaner releases.",
  },
];

export default function GetStartedPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-6 font-sans text-white sm:px-9 lg:px-12">
      <video
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
        src="https://res.cloudinary.com/df0aqbfwn/video/upload/v1782379801/Generate_same_image_as_shown_i_xlbhhv.mp4"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:80px_80px] opacity-35" />

      <Link
        href="/"
        aria-label="Back to home"
        className="absolute left-6 top-6 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur-md transition-colors hover:border-cyan-200/70 hover:text-cyan-100 sm:left-9 sm:top-7"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.3} />
        <Home className="absolute h-3.5 w-3.5 translate-x-2 translate-y-2 text-[#00c9e8]" strokeWidth={2.4} />
      </Link>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-48px)] max-w-[1240px] flex-col justify-center">
        <div className="mx-auto inline-flex h-10 items-center gap-2 rounded-full border border-cyan-200/45 bg-white/10 px-4 text-[15px] font-semibold leading-none text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md">
          <Sparkles className="h-4.5 w-4.5 fill-[#00c9ec] text-[#00c9ec]" strokeWidth={1.8} />
          <span>
            AI-Powered <span className="text-[#00c9e8]">Security Workflow</span>
          </span>
        </div>

        <h1 className="mx-auto mt-6 max-w-[860px] text-center text-[clamp(2.35rem,4.1vw,4.05rem)] font-black leading-[1.03] tracking-[-0.05em] drop-shadow-[0_4px_22px_rgba(0,0,0,0.28)]">
          Start scanning code with
          <span className="block bg-gradient-to-b from-[#17def8] via-[#02b7dc] to-[#00708f] bg-clip-text text-transparent">
            AI precision
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-[680px] text-center text-[clamp(1rem,1.28vw,1.18rem)] leading-[1.5] tracking-[-0.015em] text-[#e2edf4] drop-shadow-[0_2px_14px_rgba(0,0,0,0.24)]">
          Connect a project, launch your first scan, and turn security findings into prioritized fixes without the alert fatigue.
        </p>

        <div className="mt-8 grid w-full grid-cols-1 overflow-hidden rounded-[22px] border border-white/22 bg-white/10 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-md md:grid-cols-3">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="relative flex min-h-[108px] flex-col items-center justify-center px-5 py-5"
            >
              {index > 0 && <div className="absolute left-0 top-0 hidden h-full w-px bg-white/20 md:block" />}
              <div className="text-[clamp(2.4rem,3.55vw,3.65rem)] font-black leading-none tracking-[-0.05em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.18)]">
                {stat.value}
                <span className="bg-gradient-to-b from-[#17def8] to-[#00708f] bg-clip-text text-transparent">
                  {stat.accent}
                </span>
              </div>
              <p className="mt-3 text-[15px] leading-none text-[#e1ebf1]">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <article
                key={step.title}
                className="rounded-[20px] border border-white/16 bg-white/9 p-5 text-left shadow-[0_14px_42px_rgba(0,0,0,0.12)] backdrop-blur-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#07556b]/80 text-[#12d6f3] shadow-[0_0_18px_rgba(0,201,232,0.2)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-[20px] font-extrabold tracking-[-0.03em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)]">{step.title}</h2>
                <p className="mt-2.5 text-[15px] leading-6 text-[#e0eaf0]">{step.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
