"use client";

import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";

type OrganizationItem = {
  id: string;
  name: string;
  slug: string;
  members?: Array<{ role: string }>;
};

export function OrganizationSwitcher() {
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [selected, setSelected] = useState("personal");

  useEffect(() => {
    fetch("/api/organizations", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setOrganizations(data.items ?? []))
      .catch(() => setOrganizations([]));
  }, []);

  return (
    <div className="px-4">
      <label className="mb-2 block px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
        Workspace
      </label>
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-brand/60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
        >
          <option value="personal">Personal</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
