"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, LayoutDashboard, FolderKanban, FileText, Settings, ShieldAlert, LogOut, Users, Activity, ShieldCheck, Database, Building2 } from "lucide-react";
import { ThemeToggle } from "../../components/ThemeToggle";
import { OrgSwitcher } from "../../components/OrgSwitcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isAdmin = (session?.user as any)?.roleGlobal === "admin" || (session?.user as any)?.roleGlobal === "super_admin";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Projects", href: "/projects", icon: FolderKanban },
    { name: "Scans & Reports", href: "/reports", icon: FileText },
    { name: "Team", href: "/team", icon: Users },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Rules & Policies", href: "/rules", icon: ShieldAlert },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const adminNavigation = [
    { name: "System Health", href: "/admin/health", icon: Activity },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Organizations", href: "/admin/organizations", icon: Building2 },
    { name: "All Projects", href: "/admin/projects", icon: FolderKanban },
    { name: "Scan Debugger", href: "/admin/scans", icon: ShieldCheck },
    { name: "Audit Logs", href: "/admin/audit", icon: Database },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/80 hidden md:flex flex-col transition-colors duration-300">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-sm">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">
            ScanVul
          </span>
        </div>

        <div className="px-4 mt-2">
          <OrgSwitcher />
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href) && !pathname.startsWith("/admin"));
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                Admin Panel
              </div>
              {adminNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={true}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand/10 text-brand font-bold dark:bg-brand/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? "text-brand" : "text-muted-foreground"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="p-4 mt-auto border-t border-border">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || "User"} />
              <AvatarFallback>{session?.user?.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setIsSigningOut(true);
              signOut({ callbackUrl: "/" });
            }}
            disabled={isSigningOut}
            className="w-full hover:text-destructive"
          >
            {isSigningOut ? (
              <Spinner className="mr-2" />
            ) : (
              <LogOut className="w-4 h-4 mr-2" />
            )}
            <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen relative overflow-y-auto">
        <div className="absolute top-6 right-8 z-50">
          <ThemeToggle />
        </div>
        <div className="flex-1 p-8 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
