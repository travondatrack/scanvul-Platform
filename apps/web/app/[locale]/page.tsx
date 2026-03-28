"use client";

import { Moon, Shield, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  completeUpload,
  createScan,
  initUpload,
  listScans,
  uploadArchive,
} from "@/lib/api";

type ScanListItem = {
  id: string;
  status: string;
  riskLevel: string;
  riskPercent: number;
};

export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();

  const [sourceType, setSourceType] = useState("repo_url");
  const [sourceValue, setSourceValue] = useState("");
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanListItem[]>([]);

  useEffect(() => {
    listScans(8)
      .then((data) => setRecentScans(data.items))
      .catch(() => setRecentScans([]));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      let effectiveSourceValue = sourceValue;
      if (sourceType === "archive") {
        if (!archiveFile) {
          throw new Error("Please choose an archive file");
        }
        const upload = await initUpload(archiveFile.name, archiveFile.size);
        await uploadArchive(upload.uploadId, archiveFile);
        await completeUpload(upload.uploadId);
        effectiveSourceValue = upload.uploadId;
      }

      const scan = await createScan(sourceType, effectiveSourceValue);
      router.push(`/${locale}/scan/${scan.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start scan";
      window.alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={dark ? "dark" : ""}>
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <section className="rounded-3xl border border-brand-200/70 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-brand-900 dark:bg-slate-900/70">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-600 p-2 text-white">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {t("title")}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t("subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setDark((prev) => !prev)}
              >
                {dark ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}{" "}
                Theme
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(locale === "en" ? "/vi" : "/en")}
              >
                {locale === "en" ? "VI" : "EN"}
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("sourceType")}
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={sourceType}
                onChange={(event) => {
                  setSourceType(event.target.value);
                  setSourceValue("");
                  setArchiveFile(null);
                }}
              >
                <option value="repo_url">GitHub Public URL</option>
                <option value="archive">Archive Upload (.zip/.tar.gz)</option>
                <option value="paste">Multi-file Paste</option>
              </select>
            </div>
            {sourceType !== "archive" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sourceValue")}
                </label>
                <textarea
                  required
                  value={sourceValue}
                  onChange={(event) => setSourceValue(event.target.value)}
                  className="min-h-40 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder={
                    sourceType === "repo_url" ? t("repoHint") : t("pasteHint")
                  }
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("uploadFile")}
                </label>
                <input
                  required
                  type="file"
                  accept=".zip,.tar.gz,.tgz"
                  onChange={(event) =>
                    setArchiveFile(event.target.files?.[0] ?? null)
                  }
                  className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            )}
            <Button
              disabled={loading}
              type="submit"
              className="w-full md:w-auto"
            >
              {loading ? "Scanning..." : t("submit")}
            </Button>
          </form>

          <div className="mt-8">
            <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
              {t("scanHistory")}
            </h2>
            <div className="space-y-2">
              {recentScans.map((scan) => (
                <button
                  type="button"
                  key={scan.id}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-left text-sm dark:border-slate-700 dark:bg-slate-900"
                  onClick={() => router.push(`/${locale}/scan/${scan.id}`)}
                >
                  <span>{scan.id}</span>
                  <span className="text-slate-500">
                    {t("status")}: {scan.status} | {t("risk")}: {scan.riskLevel}{" "}
                    ({scan.riskPercent.toFixed(0)}%)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
