"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Building2,
  Plus,
  Trash2,
  ChevronDown,
  Loader2,
  Shield,
  Crown,
  Eye,
  UserCog,
} from "lucide-react";

type Member = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; status: string };
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  members: Member[];
  myRole?: string;
};

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10" },
  member: { label: "Member", icon: UserCog, color: "text-slate-700 bg-slate-100 dark:text-zinc-200 dark:bg-zinc-800" },
  viewer: { label: "Viewer", icon: Eye, color: "text-slate-500 bg-slate-50 dark:text-zinc-400 dark:bg-zinc-900" },
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_LABELS[role] ?? ROLE_LABELS.viewer;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function InviteMemberForm({
  orgId,
  onSuccess,
}: {
  orgId: string;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add member");
      setSuccess(`${email} added as ${role}`);
      setEmail("");
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/50">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="member@example.com"
        required
        className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 text-slate-900 dark:text-zinc-100"
      >
        <option value="admin">Admin</option>
        <option value="member">Member</option>
        <option value="viewer">Viewer</option>
      </select>
      <button
        type="submit"
        disabled={loading}
        className="flex items-center space-x-1.5 bg-brand hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        <span>Add</span>
      </button>
      {error && <p className="text-xs text-red-500 mt-1 self-end">{error}</p>}
      {success && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 self-end">{success}</p>}
    </form>
  );
}

function MemberRow({
  member,
  orgId,
  canManage,
  onRefresh,
}: {
  member: Member;
  orgId: string;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const changeRole = async (newRole: string) => {
    setRoleMenuOpen(false);
    setLoading(true);
    try {
      await fetch(`/api/organizations/${orgId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async () => {
    if (!confirm(`Remove ${member.user.name || member.user.email} from this organization?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/organizations/${orgId}/members/${member.id}`, { method: "DELETE" });
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-zinc-400">
          {(member.user.name || member.user.email || "U").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white text-sm">
            {member.user.name || member.user.email}
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-500">{member.user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin text-brand" />}

        {canManage && member.role !== "owner" ? (
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen((o) => !o)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <RoleBadge role={member.role} />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {roleMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRoleMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden w-36">
                  {["admin", "member", "viewer"].map((r) => (
                    <button
                      key={r}
                      onClick={() => changeRole(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-slate-700 dark:text-zinc-200 capitalize"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <RoleBadge role={member.role} />
        )}

        {canManage && member.role !== "owner" && (
          <button
            onClick={removeMember}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title="Remove member"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function CreateOrgForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      setName("");
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 p-4 bg-brand/5 dark:bg-brand/10 rounded-xl border border-brand/20"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New organization name"
        required
        className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="flex items-center space-x-1.5 bg-brand hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        <span>Create</span>
      </button>
      {error && <p className="text-xs text-red-500 self-end">{error}</p>}
    </form>
  );
}

export default function TeamPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organizations");
      const data = await res.json();
      const orgList: Organization[] = data.items ?? [];

      // Fetch members for each org
      const withMembers = await Promise.all(
        orgList.map(async (org) => {
          const mRes = await fetch(`/api/organizations/${org.id}/members`);
          const mData = await mRes.json();
          const members: Member[] = mData.items ?? [];
          const myMember = members.find((m) => m.user);
          return { ...org, members, myRole: myMember?.role ?? "viewer" };
        }),
      );

      setOrgs(withMembers);
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const canManageOrg = (org: Organization) =>
    org.myRole === "owner" || org.myRole === "admin";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Team</h1>
          <p className="mt-1 text-slate-500 dark:text-zinc-400">
            Manage organizations, members, and roles.
          </p>
        </div>
        <button
          onClick={() => setShowCreateOrg((s) => !s)}
          className="flex items-center space-x-2 bg-brand hover:opacity-90 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm active:scale-[0.98] text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Organization</span>
        </button>
      </div>

      {showCreateOrg && (
        <CreateOrgForm
          onSuccess={() => {
            setShowCreateOrg(false);
            fetchOrgs();
          }}
        />
      )}

      {orgs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/30">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-zinc-600" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">No organization yet</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
            Create an organization to collaborate with your team and manage project access centrally.
          </p>
          <button
            onClick={() => setShowCreateOrg(true)}
            className="mt-4 inline-flex items-center space-x-2 bg-brand hover:opacity-90 text-white px-4 py-2.5 rounded-xl font-medium text-sm"
          >
            <Building2 className="w-4 h-4" />
            <span>Create Organization</span>
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {orgs.map((org) => (
            <section
              key={org.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/40"
            >
              {/* Org header */}
              <div className="border-b border-slate-100 dark:border-zinc-800/50 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{org.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      /{org.slug} · {org.members.length} member{org.members.length !== 1 ? "s" : ""} · {org.plan}
                    </p>
                  </div>
                </div>
                <RoleBadge role={org.myRole ?? "viewer"} />
              </div>

              {/* Invite form (only for owner/admin) */}
              {canManageOrg(org) && (
                <div className="p-4 border-b border-slate-100 dark:border-zinc-800/50">
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    Invite Member
                  </p>
                  <InviteMemberForm orgId={org.id} onSuccess={fetchOrgs} />
                </div>
              )}

              {/* Members list */}
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {org.members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    orgId={org.id}
                    canManage={canManageOrg(org)}
                    onRefresh={fetchOrgs}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
