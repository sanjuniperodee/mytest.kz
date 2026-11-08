import { NextResponse, type NextRequest } from "next/server"
import { loadGrantData } from "@/lib/seo/grant-cutoffs"
import { GRANT_ROUTES } from "@/lib/seo/grant-routes"
import { getSiteUrl } from "@/lib/site"

/**
 * Короткая ссылка на тему обсуждения (метка над постом в ленте): ключ темы → страница,
 * где это обсуждение живёт. Вуз/специальность — публичная SEO-страница с блоком
 * вопросов, вопрос дня — тред внутри сообщества.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const topic = decodeURIComponent(key)
  const [kind, value = ""] = topic.split(":")
  let target = "/dashboard/community"

  if (kind === "qotd" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    target = `/dashboard/community/topic/${encodeURIComponent(topic)}`
  } else if (kind === "program" || kind === "university") {
    try {
      const data = await loadGrantData()
      if (kind === "program") {
        const program = data.getProgramByCode(value.toUpperCase())
        if (program) target = `${GRANT_ROUTES.ru.program(program.slug)}#voprosy`
      } else {
        const university = data.getUniversityByCode(Number(value))
        if (university) target = `${GRANT_ROUTES.ru.university(university.slug)}#voprosy`
      }
    } catch {
      target = GRANT_ROUTES.ru.hub
    }
  }
  // За nginx request.url указывает на внутренний адрес Next (localhost:3000), поэтому
  // абсолютный адрес строим от публичного origin; в разработке — от адреса запроса.
  const base = process.env.NODE_ENV === "production" ? getSiteUrl() : request.nextUrl.origin
  return NextResponse.redirect(new URL(target, base), 307)
}
