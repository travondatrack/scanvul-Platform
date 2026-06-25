"use client";

import {
  Archive,
  CheckCircle2,
  Code2,
  GitBranch,
  Languages,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  completeUpload,
  createScan,
  initUpload,
  listScans,
  uploadArchive,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type SourceType = "repo_url" | "archive" | "paste";

type ScanListItem = {
  id: string;
  status: string;
  riskLevel: string;
  riskPercent: number;
};

const SOURCE_OPTIONS: Array<{
  value: SourceType;
  label: string;
  icon: typeof GitBranch;
}> = [
  { value: "repo_url", label: "Repository", icon: GitBranch },
  { value: "archive", label: "Archive", icon: Archive },
  { value: "paste", label: "Paste", icon: Code2 },
];

const riskTone: Record<string, string> = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Unknown: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusTone: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700",
  running: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

function formatScanId(id: string) {
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

function normalizePasteInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Paste input is empty");
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) || Array.isArray(parsed.files)) {
      return JSON.stringify(parsed);
    }
  } catch {
    return JSON.stringify([
      {
        path: "pasted.txt",
        content: value,
      },
    ]);
  }

  throw new Error("Paste input must be plain text, a file array, or { files: [] }");
}

export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();

  const [sourceType, setSourceType] = useState<SourceType>("repo_url");
  const [sourceValue, setSourceValue] = useState("");
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [recentScans, setRecentScans] = useState<ScanListItem[]>([]);

  useEffect(() => {
    listScans(8)
      .then((data) => setRecentScans(data.items))
      .catch(() => setRecentScans([]));
  }, []);

  const stats = useMemo(() => {
    const completed = recentScans.filter((scan) => scan.status === "completed").length;
    const active = recentScans.filter((scan) =>
      ["queued", "running"].includes(scan.status),
    ).length;
    const highestRisk = recentScans.reduce(
      (max, scan) => Math.max(max, scan.riskPercent),
      0,
    );
    return [
      { label: "Recent scans", value: recentScans.length.toString() },
      { label: "Active", value: active.toString() },
      { label: "Completed", value: completed.toString() },
      { label: "Max risk", value: `${highestRisk.toFixed(0)}%` },
    ];
  }, [recentScans]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      let effectiveSourceValue = sourceValue.trim();
      setPhase("Validating source");

      if (sourceType === "repo_url") {
        if (!/^https?:\/\/github\.com\/[^/\s]+\/[^/\s]+/i.test(effectiveSourceValue)) {
          throw new Error("Use a public GitHub repository URL");
        }
      }

      if (sourceType === "paste") {
        effectiveSourceValue = normalizePasteInput(sourceValue);
      }

      if (sourceType === "archive") {
        if (!archiveFile) {
          throw new Error("Please choose a .zip, .tar.gz, or .tgz archive");
        }
        setPhase("Uploading archive");
        const upload = await initUpload(archiveFile.name, archiveFile.size);
        await uploadArchive(upload.uploadId, archiveFile);
        await completeUpload(upload.uploadId);
        effectiveSourceValue = upload.uploadId;
      }

      setPhase("Starting scan");
      const scan = await createScan(sourceType, effectiveSourceValue);
      router.push(`/${locale}/scan/${scan.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to start scan";
      setError(message);
    } finally {
      setLoading(false);
      setPhase("");
    }
  }

  return (
    <main>
      <div className="min-h-screen px-4 py-5 text-slate-900 dark:text-slate-100 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-5">
          <header className="animate-fade-up flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="scan-surface grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold md:text-3xl">
                  {t("title")}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("subtitle")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(locale === "en" ? "/vi" : "/en")}
              >
                <Languages className="mr-2 h-4 w-4" />
                {locale === "en" ? "VI" : "EN"}
              </Button>
            </div>
          </header>

          <section className="grid gap-3 md:grid-cols-4">
            {stats.map((item, index) => (
              <div
                key={item.label}
                className="animate-fade-up rounded-lg border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <p className="text-xs font-medium uppercase text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
            <section className="animate-fade-up rounded-lg border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t("sourceType")}
                  </label>
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
                    {SOURCE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const selected = sourceType === option.value;
                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={cn(
                            "flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition",
                            selected
                              ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100",
                          )}
                          onClick={() => {
                            setSourceType(option.value);
                            setSourceValue("");
                            setArchiveFile(null);
                            setError("");
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="hidden sm:inline">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {sourceType !== "archive" ? (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t("sourceValue")}
                    </label>
                    <textarea
                      required
                      value={sourceValue}
                      onChange={(event) => setSourceValue(event.target.value)}
                      className="min-h-56 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-300 dark:focus:ring-slate-800"
                      placeholder={
                        sourceType === "repo_url" ? t("repoHint") : t("pasteHint")
                      }
                    />
                  </div>
                ) : (
                  <label className="scan-surface flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-500 dark:border-slate-700 dark:bg-slate-950">
                    <UploadCloud className="mb-3 h-9 w-9 text-slate-500" />
                    <span className="text-sm font-semibold">
                      {archiveFile?.name ?? t("uploadFile")}
                    </span>
                    <span className="mt-1 text-xs text-slate-500">
                      .zip, .tar.gz, .tgz
                    </span>
                    <input
                      required
                      type="file"
                      accept=".zip,.tar.gz,.tgz"
                      onChange={(event) =>
                        setArchiveFile(event.target.files?.[0] ?? null)
                      }
                      className="sr-only"
                    />
                  </label>
                )}

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button disabled={loading} type="submit" className="h-11 min-w-44">
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {loading ? phase || "Working" : t("submit")}
                  </Button>
                  {loading ? (
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="progress-animated h-full w-2/3 rounded-full bg-slate-900 dark:bg-sky-500" />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Scans run locally with SQLite and local file storage.
                    </p>
                  )}
                </div>
              </form>
            </section>

            <aside className="animate-fade-up rounded-lg border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("scanHistory")}</h2>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="space-y-2">
                {recentScans.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                    No scans yet.
                  </div>
                ) : (
                  recentScans.map((scan) => (
                    <button
                      type="button"
                      key={scan.id}
                      className="scan-surface flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600"
                      onClick={() => router.push(`/${locale}/scan/${scan.id}`)}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono font-semibold">
                          {formatScanId(scan.id)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {scan.riskPercent.toFixed(1)}% risk
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            statusTone[scan.status] ?? statusTone.queued,
                          )}
                        >
                          {scan.status}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-semibold",
                            riskTone[scan.riskLevel] ?? riskTone.Unknown,
                          )}
                        >
                          {scan.riskLevel}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
