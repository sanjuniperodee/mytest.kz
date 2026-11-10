import Link from "next/link"

/**
 * Attribution line for questions adapted from CC BY 4.0 material (OpenStax textbooks).
 * The licence requires crediting the source to the reader; full credits are on /istochniki.
 * Opens in a new tab so it never pulls a student out of a running test.
 */
export function QuestionSource({
  source,
  locale,
  className,
}: {
  source?: "openstax" | null
  locale?: string
  className?: string
}) {
  if (source !== "openstax") return null
  const kk = locale === "kk"
  return (
    <p className={className ?? "text-xs text-muted-foreground"} data-no-translate>
      {kk ? "Дереккөз: " : "Источник: "}
      <Link
        href="/istochniki#openstax"
        target="_blank"
        rel="noopener"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {kk ? "OpenStax оқулықтары бойынша бейімделген, CC BY 4.0" : "адаптировано по учебникам OpenStax, CC BY 4.0"}
      </Link>
    </p>
  )
}
