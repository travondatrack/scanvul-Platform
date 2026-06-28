import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { User, Key, Bell, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { ProfileSettingsForm } from "@/components/ProfileSettingsForm";

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
            
            <ProfileSettingsForm
              initialName={session?.user?.name || ""}
              email={session?.user?.email || ""}
              initialImage={session?.user?.image || ""}
            />
          </Card>

          <Card className="border-destructive/20 bg-destructive/5 p-6">
            <h2 className="text-lg font-bold text-destructive mb-2">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Disable your account, revoke sign-in access, and anonymize your profile. Historical project and scan records are retained.
            </p>
            <DeleteAccountDialog />
          </Card>
        </div>
      </div>
    </div>
  );
}
