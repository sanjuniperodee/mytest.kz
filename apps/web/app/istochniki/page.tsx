import type { Metadata } from "next"
import { LegalShell } from "@/components/legal/legal-shell"
import { getSiteUrl } from "@/lib/site"

/**
 * Credits for licensed question material. CC BY 4.0 requires naming the author and work,
 * linking the licence and saying what was changed; questions from these banks link here
 * (components/exam/question-source.tsx). Keep in sync with apps/api/prisma/ent-banks/OPENSTAX.md.
 */

const OPENSTAX_BOOKS: Array<{ subject: string; title: string; url: string }> = [
  { subject: "Биология", title: "Concepts of Biology", url: "https://openstax.org/details/books/concepts-biology" },
  { subject: "Биология", title: "Biology 2e", url: "https://openstax.org/details/books/biology-2e" },
  { subject: "Химия", title: "Chemistry 2e", url: "https://openstax.org/details/books/chemistry-2e" },
  {
    subject: "Физика",
    title: "College Physics for AP® Courses 2e",
    url: "https://openstax.org/details/books/college-physics-ap-courses-2e",
  },
  { subject: "Математика", title: "College Algebra 2e", url: "https://openstax.org/details/books/college-algebra-2e" },
]

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  return {
    title: "Источники вопросов",
    description: "Откуда взяты учебные материалы в тестах mytest и на каких лицензиях они используются.",
    alternates: { canonical: `${siteUrl}/istochniki` },
    openGraph: { title: "Источники вопросов | mytest", url: `${siteUrl}/istochniki`, type: "website" },
  }
}

export default function SourcesPage() {
  return (
    <LegalShell title="Источники вопросов">
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-foreground/90">
        <p>
          Большая часть заданий mytest составлена командой проекта. Часть вопросов по биологии, химии,
          физике и математике адаптирована из открытых учебников. Под такими вопросами в тесте и в
          разборе стоит пометка «Источник».
        </p>

        <section id="openstax" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">OpenStax</h2>
          <p>
            Вопросы адаптированы из учебников <strong>OpenStax</strong> (Rice University), опубликованных
            под лицензией{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/deed.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Creative Commons Attribution 4.0 International (CC BY 4.0)
            </a>
            . Использованы версии учебников, выпущенные под этой лицензией.
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {OPENSTAX_BOOKS.map((book) => (
              <li key={book.title} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                <a
                  href={book.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {book.title}
                </a>
                <span className="text-sm text-muted-foreground">{book.subject}</span>
              </li>
            ))}
          </ul>
          <p>
            <strong>Что изменено:</strong> вопросы переведены на русский язык, переработаны в формат
            тестовых заданий с одним верным ответом, часть вариантов ответа и все объяснения написаны
            командой mytest. Ошибки перевода и адаптации — наши; сообщить о них можно кнопкой
            «Ошибка?» рядом с вопросом в тесте.
          </p>
          <p className="text-sm text-muted-foreground">
            OpenStax и Rice University не связаны с mytest и не одобряли этот сайт. Название OpenStax
            указано только как источник материала.
          </p>
        </section>
      </div>
    </LegalShell>
  )
}
