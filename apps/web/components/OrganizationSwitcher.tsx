"use client";

import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";

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
      <label className="mb-2 block px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Workspace
      </label>
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="appearance-none pl-9 font-medium"
        >
          <option value="personal">Personal</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
