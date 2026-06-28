"use client";

import { useState, useEffect } from "react";
import { Users, Search, Lock, Unlock, Shield, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";

type UserItem = {
  id: string;
  name: string | null;
  email: string | null;
  roleGlobal: string;
  status: string;
  createdAt: string;
};

export function AdminUsersClient({ currentUserRole }: { currentUserRole: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update status");
      }
    } catch (e) {
      alert("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, roleGlobal: newRole } : u)));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update role");
      }
    } catch (e) {
      alert("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-brand" />
            Users Management
          </h1>
          <p className="text-slate-400 mt-1">Manage global user access, lock/unlock accounts, and assign roles.</p>
        </div>
        <Button onClick={fetchUsers} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="flex gap-3 max-w-md">
        <Input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchUsers(); } }}
        />
        <Button onClick={() => { setPage(1); fetchUsers(); }}>Search</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No users found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-slate-300 text-xs uppercase">
                <th className="p-4 font-bold">User</th>
                <th className="p-4 font-bold">Role</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold">Created</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {users.map((u) => {
                const isLoadingThis = actionLoading === u.id;
                return (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white">{u.name || "Unnamed"}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <select
                        value={u.roleGlobal}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={isLoadingThis || (u.roleGlobal === "super_admin" && currentUserRole !== "super_admin")}
                        className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-brand"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="support_admin">support_admin</option>
                        <option value="security_admin">security_admin</option>
                        {currentUserRole === "super_admin" && <option value="super_admin">super_admin</option>}
                      </select>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={u.status === "active" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {u.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-slate-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {isLoadingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin inline-block text-brand" />
                      ) : u.status === "active" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStatusChange(u.id, "disabled")}
                          title="Lock User"
                          className="h-8 px-2"
                        >
                          <Lock className="w-3.5 h-3.5 mr-1" /> Lock
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(u.id, "active")}
                          title="Unlock User"
                          className="h-8 px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4 mt-4 px-4 pb-4">
            <p className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </p>
            <Pagination className="w-auto mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className={page === 1 ? "pointer-events-none opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className={page === totalPages ? "pointer-events-none opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
}
