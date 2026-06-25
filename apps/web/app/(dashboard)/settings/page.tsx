import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { User, Mail, Key, Bell, Shield } from "lucide-react";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6 max-w-4xl mx-auto mt-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Account Settings</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">Manage your personal profile, security, and preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Settings Navigation Sidebar */}
        <div className="space-y-2">
          <button className="w-full flex items-center space-x-3 px-4 py-3 bg-slate-100 dark:bg-zinc-800/50 text-slate-900 dark:text-white rounded-xl font-medium border border-slate-200 dark:border-zinc-700/50">
            <User className="w-5 h-5" />
            <span>Profile</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl font-medium transition-colors">
            <Shield className="w-5 h-5" />
            <span>Security</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl font-medium transition-colors">
            <Key className="w-5 h-5" />
            <span>API Keys</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl font-medium transition-colors">
            <Bell className="w-5 h-5" />
            <span>Notifications</span>
          </button>
        </div>

        {/* Settings Content Area */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 shadow-sm dark:shadow-xl dark:backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Profile Information</h2>
            
            <div className="flex items-center space-x-6 mb-8">
              <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 overflow-hidden">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-zinc-500 text-3xl font-bold">
                    {session?.user?.name?.charAt(0) || "U"}
                  </div>
                )}
              </div>
              <div>
                <button className="px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-900 dark:text-white rounded-lg text-sm font-medium transition-colors mb-2">
                  Change Avatar
                </button>
                <p className="text-xs text-slate-500 dark:text-zinc-500">JPG, GIF or PNG. Max size of 2MB.</p>
              </div>
            </div>

            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 ml-1">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    </div>
                    <input
                      type="text"
                      defaultValue={session?.user?.name || ""}
                      className="w-full bg-white dark:bg-zinc-950/50 border border-slate-300 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 ml-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    </div>
                    <input
                      type="email"
                      defaultValue={session?.user?.email || ""}
                      disabled
                      className="w-full bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-500 dark:text-zinc-500 cursor-not-allowed opacity-70"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="button" className="bg-brand hover:opacity-90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95">
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
            <p className="text-red-500/80 dark:text-zinc-400 text-sm mb-4">
              Permanently delete your account and all associated data, projects, and scans.
            </p>
            <button className="px-4 py-2 bg-white dark:bg-red-500/10 hover:bg-red-50 dark:hover:bg-red-500/20 text-red-600 dark:text-red-500 rounded-lg text-sm font-medium transition-colors border border-red-200 dark:border-red-500/20 shadow-sm">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
