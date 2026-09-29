"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoadState, Post, useSocialText } from "@/components/social/common";
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
    <div className="flex min-w-0 flex-col gap-6" data-no-translate>
      <Link
        href="/dashboard/community"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("К ленте", "Лентаға оралу")}
      </Link>
      <PageHeader title={t("Обсуждение", "Талқылау")} />
      <LoadState
        loading={isLoading}
        error={error}
        retry={() => void mutate()}
      />
      {data && !error && (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <PostCard post={data} refresh={() => mutate()} />
          </div>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">
              {t("Ответы", "Жауаптар")}
            </h2>
            <PostList
              key={id}
              parentId={id}
              composer
              onChange={() => mutate()}
              empty={{
                title: t("Ответов пока нет", "Әзірге жауап жоқ"),
                text: t(
                  "Помогите автору — ответьте первым.",
                  "Авторға көмектесіңіз — бірінші болып жауап беріңіз.",
                ),
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
