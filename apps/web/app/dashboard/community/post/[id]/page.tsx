"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api/client";
import {
  CommunityFrame,
  LoadState,
  Post,
  useSocialText,
} from "@/components/social/common";
import { PostCard, PostList } from "@/components/social/posts";
export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const t = useSocialText();
  const { data, error, isLoading, mutate } = useSWR<Post>(
    `/social/posts/${id}`,
    (path: string) => api<Post>(path),
    {
      revalidateOnFocus: true,
      refreshInterval: 4000,
      refreshWhenHidden: false,
    },
  );
  return (
    <CommunityFrame>
      <Link
        href="/dashboard/community"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("К ленте", "Лентаға оралу")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">
        {t("Обсуждение", "Талқылау")}
      </h1>
      <LoadState
        loading={isLoading}
        error={error}
        retry={() => void mutate()}
      />
      {data && !error && (
        <>
          <div className="mb-5 overflow-hidden rounded-3xl border border-border bg-background">
            <PostCard post={data} refresh={() => mutate()} />
          </div>
          <h2 className="mb-3 text-sm font-semibold">
            {t("Ответы", "Жауаптар")}
          </h2>
          <PostList key={id} parentId={id} composer onChange={() => mutate()} />
        </>
      )}
    </CommunityFrame>
  );
}
