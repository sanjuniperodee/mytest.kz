"use client";

import { useParams } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <ProfileView key={id} id={id} />;
}
