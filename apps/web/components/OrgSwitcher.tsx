"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, ChevronDown, User, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export type OrgContext = {
  type: "personal" | "org";
  id?: string;
  name: string;
  slug?: string;
  role?: string;
};

const STORAGE_KEY = "scanvul_org_context";

export function getOrgContext(): OrgContext {
  if (typeof window === "undefined") return { type: "personal", name: "Personal" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as OrgContext;
  } catch {
    // ignore
  }
  return { type: "personal", name: "Personal" };
}

export function setOrgContext(ctx: OrgContext) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  window.dispatchEvent(new Event("orgContextChange"));
}

type Org = {
  id: string;
  name: string;
  slug: string;
  members: { role: string }[];
};

type Props = {
  /** Called when the user switches org so parent can re-fetch data */
  onChange?: (ctx: OrgContext) => void;
};

export function OrgSwitcher({ onChange }: Props) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [current, setCurrent] = useState<OrgContext>({ type: "personal", name: "Personal" });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrent(getOrgContext());
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((data) => setOrgs(data.items ?? []))
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, []);

  const select = useCallback(
    (ctx: OrgContext) => {
      setCurrent(ctx);
      setOrgContext(ctx);
      setOpen(false);
      onChange?.(ctx);
    },
    [onChange],
  );

  const personalCtx: OrgContext = { type: "personal", name: "Personal" };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center space-x-2 w-full px-3 py-2 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-colors text-sm font-medium text-foreground"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
          {current.type === "personal" ? (
            <User className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Building2 className="w-4 h-4 text-brand" />
          )}
        </span>
        <span className="flex-1 truncate text-left">{current.name}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div
            role="listbox"
            className="absolute left-0 top-full mt-1 z-20 w-64 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden"
          >
            {/* Personal */}
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Personal
              </p>
            </div>
            <button
              role="option"
              aria-selected={current.type === "personal"}
              onClick={() => select(personalCtx)}
              className="flex items-center space-x-3 w-full px-3 py-2 hover:bg-muted transition-colors text-sm text-foreground"
            >
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-left">Personal</span>
              {current.type === "personal" && (
                <Check className="w-4 h-4 text-brand flex-shrink-0" />
              )}
            </button>

            {/* Organizations */}
            {!loading && orgs.length > 0 && (
              <>
                <div className="px-3 pt-3 pb-1 border-t border-border mt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Organizations
                  </p>
                </div>
                {orgs.map((org) => {
                  const isActive = current.type === "org" && current.id === org.id;
                  const myRole = org.members[0]?.role ?? "member";
                  return (
                    <button
                      key={org.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() =>
                        select({ type: "org", id: org.id, name: org.name, slug: org.slug, role: myRole })
                      }
                      className="flex items-center space-x-3 w-full px-3 py-2 hover:bg-muted transition-colors text-sm text-foreground"
                    >
                      <Building2 className="w-4 h-4 text-brand flex-shrink-0" />
                      <span className="flex-1 text-left truncate">{org.name}</span>
                      <span className="text-xs text-muted-foreground capitalize mr-1">
                        {myRole}
                      </span>
                      {isActive && <Check className="w-4 h-4 text-brand flex-shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}

            {loading && (
              <div className="space-y-2 px-3 py-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-4/5" />
              </div>
            )}

            <div className="border-t border-border p-2">
              <a
                href="/team"
                className="flex items-center space-x-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-brand hover:bg-brand/5 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Manage Organizations</span>
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
