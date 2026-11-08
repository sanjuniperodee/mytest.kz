import { MessageCircle, MessageSquarePlus, Heart } from "lucide-react"
import { ConversionLink } from "@/components/landing/conversion-link"
import { loginHref } from "@/lib/api/login-return"
import { getSiteUrl } from "@/lib/site"
import type { SeoLang } from "@/lib/seo/grant-cutoffs"

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.my-test.kz"
/** Новые вопросы появляются на странице не позже чем через 10 минут. */
const DISCUSSIONS_REVALIDATE = 600

type PublicReply = {
  id: string
  body: string
  createdAt: string
  authorName: string
  _count: { likes: number }
}
type PublicQuestion = PublicReply & {
  topicKey: string
  _count: { likes: number; replies: number }
  replies: PublicReply[]
}

const tx = (lang: SeoLang, ru: string, kk: string) => (lang === "kk" ? kk : ru)

function repliesRu(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "ответ"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "ответа"
  return "ответов"
}

async function loadDiscussions(topicKey: string): Promise<PublicQuestion[]> {
  try {
    const res = await fetch(
      `${API_ORIGIN}/api/v1/social/public/discussions?topicKey=${encodeURIComponent(topicKey)}`,
      { next: { revalidate: DISCUSSIONS_REVALIDATE } },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { items?: PublicQuestion[] }
    return Array.isArray(data.items) ? data.items : []
  } catch {
    // Обсуждение — дополнение к странице баллов: недоступный API не должен ронять её.
    return []
  }
}

function formatDate(value: string, lang: SeoLang) {
  return new Date(value).toLocaleDateString(lang === "kk" ? "kk-KZ" : "ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Almaty",
  })
}

/**
 * «Вопросы о поступлении» на странице вуза или специальности: живые вопросы
 * абитуриентов (SEO-контент, который обновляется сам) и вход в сообщество —
 * спросить или ответить можно после входа, вопрос сразу появляется и в ленте.
 */
export async function TopicDiscussion({
  topicKey,
  lang,
  title,
  askLabel,
}: {
  /** program:B057 или university:13 */
  topicKey: string
  lang: SeoLang
  /** Заголовок блока, уже с названием вуза/специальности. */
  title: string
  /** Подпись темы для формы вопроса: «IT · B057», «ЕНУ». */
  askLabel: string
}) {
  const items = await loadDiscussions(topicKey)
  const siteUrl = getSiteUrl()
  const askHref = loginHref(
    `/dashboard/community/ask?${new URLSearchParams({ topic: topicKey, label: askLabel }).toString()}`,
    `discussion-${topicKey.split(":")[0]}`,
  )

  const jsonLd = items.length
    ? items.map((item) => ({
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: item.body.length > 110 ? `${item.body.slice(0, 107)}…` : item.body,
        text: item.body,
        datePublished: item.createdAt,
        author: { "@type": "Person", name: item.authorName },
        url: `${siteUrl}/t/${encodeURIComponent(topicKey)}`,
        interactionStatistic: [
          { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: item._count.likes },
          { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: item._count.replies },
        ],
        comment: item.replies.map((reply) => ({
          "@type": "Comment",
          text: reply.body,
          datePublished: reply.createdAt,
          author: { "@type": "Person", name: reply.authorName },
        })),
      }))
    : null

  return (
    <section id="voprosy" className="scroll-mt-20" aria-labelledby={`voprosy-${topicKey}`}>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id={`voprosy-${topicKey}`} className="text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {tx(
              lang,
              "Спроси про баллы, предметы, конкурс или общежитие — ответят абитуриенты и студенты из сообщества mytest.",
              "Балл, пәндер, конкурс не жатақхана туралы сұра — mytest қауымдастығындағы талапкерлер мен студенттер жауап береді.",
            )}
          </p>
        </div>
        <ConversionLink
          href={askHref}
          placement={`discussion_ask_${topicKey.split(":")[0]}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          {tx(lang, "Задать вопрос", "Сұрақ қою")}
        </ConversionLink>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center">
          <MessageCircle className="mx-auto size-7 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-3 font-medium">{tx(lang, "Вопросов пока нет — спроси первым", "Әзірге сұрақ жоқ — бірінші болып сұра")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {tx(
              lang,
              "Например: хватит ли моих баллов на грант, какие профильные предметы выбрать, сложно ли учиться.",
              "Мысалы: балым грантқа жете ме, қандай бейіндік пәндерді таңдаған дұрыс, оқу қиын ба.",
            )}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => {
            const moreReplies = item._count.replies - item.replies.length
            const replyHref = loginHref(`/dashboard/community/post/${item.id}`, "discussion-reply")
            return (
              <li key={item.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{item.authorName}</span> · {formatDate(item.createdAt, lang)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]">{item.body}</p>
                {item.replies.length > 0 && (
                  <ul className="mt-3 space-y-2 border-l-2 border-border pl-4">
                    {item.replies.map((reply) => (
                      <li key={reply.id}>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{reply.authorName}</span> · {formatDate(reply.createdAt, lang)}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{reply.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3.5" aria-hidden="true" />
                    {item._count.likes}
                  </span>
                  <ConversionLink href={replyHref} placement="discussion_reply" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    {moreReplies > 0
                      ? tx(lang, `Ещё ${moreReplies} ${repliesRu(moreReplies)} · ответить`, `Тағы ${moreReplies} жауап · жауап беру`)
                      : tx(lang, "Ответить", "Жауап беру")}
                  </ConversionLink>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
