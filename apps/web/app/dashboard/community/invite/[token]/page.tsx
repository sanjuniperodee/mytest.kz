"use client";
import { useState } from "react";
import { clearInviteDestination } from '@/lib/api/login-return';
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  CommunityFrame,
  LoadState,
  useSocialText,
} from "@/components/social/common";
type Invite = {
  title: string;
  description: string;
  _count: { members: number };
};
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const t = useSocialText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<Invite>(
    `/social/invites/${token}`,
    (path: string) => api<Invite>(path),
  );
  return (
    <CommunityFrame>
      <LoadState
        loading={isLoading}
        error={error}
        retry={() => void mutate()}
      />
      {data && !error && (
        <div className="rounded-3xl border border-border bg-background p-6 text-center">
          <Users className="mx-auto mb-4 size-10 text-emerald-600" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("Приглашение в группу", "Топқа шақыру")}
          </p>
          <h1 className="mt-3 break-words text-2xl font-semibold">
            {data.title}
          </h1>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {data.description}
          </p>
          <p className="my-4 text-sm">
            {data._count.members} {t("участников", "қатысушы")}
          </p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const room = await api<{ id: string }>(
                  `/social/invites/${token}/join`,
                  { method: "POST" },
                );
                clearInviteDestination();
                router.push(`/dashboard/messages?room=${room.id}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Присоединиться", "Қосылу")}
          </Button>
        </div>
      )}
    </CommunityFrame>
  );
}
