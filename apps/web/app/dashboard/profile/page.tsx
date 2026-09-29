"use client";

import { ProfileView } from "@/components/profile/profile-view";
import { useAuth } from "@/lib/api/auth-context";

/** The current user's profile — the same page everyone else sees, plus the editor. */
export default function MyProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return <ProfileView key={user.id} id={user.id} />;
}
