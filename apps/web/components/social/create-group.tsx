"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Settings, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LoadState,
  Person,
  PersonAvatar,
  personName,
  useSocialText,
} from "./common";

export function CreateGroup({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const t = useSocialText();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Users className="size-4" />
          {t("Создать группу", "Топ құру")}
        </Button>
      </DialogTrigger>
      <DialogContent data-no-translate>
        <DialogHeader>
          <DialogTitle>{t("Новая группа", "Жаңа топ")}</DialogTitle>
          <DialogDescription>
            {t(
              "До 200 участников. Пригласи друзей после создания.",
              "200 қатысушыға дейін. Құрғаннан кейін достарыңды шақыр.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const room = await api<{ id: string }>("/social/groups", {
                method: "POST",
                body: { title },
              });
              setOpen(false);
              setTitle("");
              onCreated();
              router.push(`/dashboard/messages?room=${room.id}`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block space-y-2 text-sm">
            <span>{t("Название", "Атауы")}</span>
            <input
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-3"
            />
          </label>
          <Button
            disabled={busy || !title.trim()}
            type="submit"
            className="w-full"
          >
            {t("Создать", "Құру")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
