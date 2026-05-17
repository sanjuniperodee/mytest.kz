import { ArrowRight, Sparkles } from "lucide-react"

export function PromoBar() {
  return (
    <div className="bg-foreground text-background">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm">
        <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span className="hidden sm:inline opacity-90">Сезон ЕНТ 2026 открыт.</span>
        <span className="opacity-90">Premium-разбор · скидки до 50% на тарифы</span>
        <a
          href="#pricing"
          className="ml-1 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          Начать
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}
