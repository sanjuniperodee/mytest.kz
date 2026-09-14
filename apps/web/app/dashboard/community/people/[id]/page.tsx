"use client";
import { useParams } from "next/navigation";
import { SocialProfile } from "@/components/social/people";
export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  return <SocialProfile key={id} id={id} />;
}
