import { redirect } from "next/navigation";

// Profiles moved to /dashboard/profile/:id; keep shared links working.
export default async function LegacyPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/profile/${encodeURIComponent(id)}`);
}
