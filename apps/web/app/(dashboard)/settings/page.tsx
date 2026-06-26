import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { User, Mail, Key, Bell, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6 max-w-4xl mx-auto mt-4">
      <PageHeader
        title="Account Settings"
        description="Manage your personal profile, security, and preferences."
        className="mb-8"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Settings Navigation Sidebar */}
        <div className="space-y-2">
          <button className="w-full flex items-center space-x-3 px-4 py-3 bg-muted text-foreground rounded-lg font-medium border border-border">
            <User className="w-5 h-5" />
            <span>Profile</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg font-medium transition-colors">
            <Shield className="w-5 h-5" />
            <span>Security</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg font-medium transition-colors">
            <Key className="w-5 h-5" />
            <span>API Keys</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg font-medium transition-colors">
            <Bell className="w-5 h-5" />
            <span>Notifications</span>
          </button>
        </div>

        {/* Settings Content Area */}
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-6">Profile Information</h2>
            
            <div className="flex items-center space-x-6 mb-8">
              <div className="w-24 h-24 rounded-xl bg-muted border border-border overflow-hidden">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-3xl font-bold">
                    {session?.user?.name?.charAt(0) || "U"}
                  </div>
                )}
              </div>
              <div>
                <Button type="button" variant="outline" className="mb-2">
                  Change Avatar
                </Button>
                <p className="text-xs text-muted-foreground">JPG, GIF or PNG. Max size of 2MB.</p>
              </div>
            </div>

            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground ml-1">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      type="text"
                      defaultValue={session?.user?.name || ""}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground ml-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      type="email"
                      defaultValue={session?.user?.email || ""}
                      disabled
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="button">
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5 p-6">
            <h2 className="text-lg font-bold text-destructive mb-2">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account and all associated data, projects, and scans.
            </p>
            <Button variant="destructive">
              Delete Account
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
