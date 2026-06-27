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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";

type Member = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; status: string };
  isMe?: boolean;
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
    <Badge variant="secondary" className="gap-1.5">
      <Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
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
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 p-4 bg-muted/40 rounded-xl border border-border">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="member@example.com"
        required
        className="flex-1"
      />
      <Select
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="admin">Admin</option>
        <option value="member">Member</option>
        <option value="viewer">Viewer</option>
      </Select>
      <Button
        type="submit"
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        <span>Add</span>
      </Button>
      {error && <p className="text-xs text-red-400 mt-1 self-end">{error}</p>}
      {success && <p className="text-xs text-emerald-400 mt-1 self-end">{success}</p>}
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

  const leaveOrg = async () => {
    if (!confirm("Are you sure you want to leave this organization? You will lose access to its projects.")) return;
    setLoading(true);
    try {
      await fetch(`/api/organizations/${orgId}/members/${member.id}`, { method: "DELETE" });
      // Usually you'd redirect here if it's the only org, but refresh works
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-sm font-bold text-muted-foreground">
          {(member.user.name || member.user.email || "U").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-foreground text-sm">
            {member.user.name || member.user.email}
          </p>
          <p className="text-xs text-muted-foreground">{member.user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin text-brand" />}

        {canManage && member.role !== "owner" && !member.isMe ? (
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
                <div className="absolute right-0 top-full mt-1 z-20 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden w-36">
                  {["admin", "member", "viewer"].map((r) => (
                    <button
                      key={r}
                      onClick={() => changeRole(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground capitalize"
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

        {canManage && member.role !== "owner" && !member.isMe && (
          <button
            onClick={removeMember}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Remove member"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        
        {member.isMe && member.role !== "owner" && (
          <button
            onClick={leaveOrg}
            className="px-3 py-1.5 ml-2 text-xs font-semibold rounded-lg text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-colors"
            title="Leave Organization"
          >
            Leave
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
      className="flex gap-2 p-4 bg-muted/40 rounded-xl border border-border"
    >
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New organization name"
        required
        className="flex-1"
      />
      <Button
        type="submit"
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        <span>Create</span>
      </Button>
      {error && <p className="text-xs text-red-400 self-end">{error}</p>}
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
          return { ...org, members };
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
      <div className="space-y-6">
        <PageHeader title="Team" description="Manage organizations, members, and roles." />
        <CardGridSkeleton cards={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage organizations, members, and roles."
        actions={(
          <Button onClick={() => setShowCreateOrg((s) => !s)}>
            <Plus className="w-4 h-4" />
            <span>New Organization</span>
          </Button>
        )}
      />

      {showCreateOrg && (
        <CreateOrgForm
          onSuccess={() => {
            setShowCreateOrg(false);
            fetchOrgs();
          }}
        />
      )}

      {orgs.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">No organization yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            Create an organization to collaborate with your team and manage project access centrally.
          </p>
          <Button
            onClick={() => setShowCreateOrg(true)}
            className="mt-6"
          >
            <Building2 className="w-4 h-4" />
            <span>Create Organization</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-5">
          {orgs.map((org) => (
            <section
              key={org.id}
              className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
            >
              {/* Org header */}
              <div className="border-b border-border p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{org.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      /{org.slug} - {org.members.length} member{org.members.length !== 1 ? "s" : ""} - {org.plan}
                    </p>
                  </div>
                </div>
                <RoleBadge role={org.myRole ?? "viewer"} />
              </div>

              {/* Invite form (only for owner/admin) */}
              {canManageOrg(org) && (
                <div className="p-4 border-b border-border bg-muted/30">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Invite Member
                  </p>
                  <InviteMemberForm orgId={org.id} onSuccess={fetchOrgs} />
                </div>
              )}

              {/* Members list */}
              <div className="divide-y divide-border">
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
