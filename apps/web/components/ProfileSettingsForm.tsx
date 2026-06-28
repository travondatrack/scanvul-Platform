"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileSettingsForm({
  initialName,
  email,
  initialImage,
}: {
  initialName: string;
  email: string;
  initialImage: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setMessage("Profile saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={saveProfile}>
      <div className="flex items-center space-x-6 mb-8">
        <div className="w-24 h-24 rounded-xl bg-muted border border-border overflow-hidden">
          {image ? (
            <img src={image} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-3xl font-bold">
              {(name || email || "U").charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-xs font-medium text-muted-foreground ml-1">Avatar URL</label>
          <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://example.com/avatar.png" />
          <p className="text-xs text-muted-foreground">JPG, GIF, PNG URL or image data URI.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground ml-1">Full Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input type="text" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground ml-1">Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input type="email" value={email} disabled className="pl-10" />
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
