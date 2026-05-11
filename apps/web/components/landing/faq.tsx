import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    q: "Задания совпадают с настоящим ЕНТ?",
    a: "Формат — 1:1 с экзаменом: 140 заданий, 240 минут, такая же структура и баллы. Сами задания мы пишем с действующими преподавателями по программе МОН РК, обновляем базу каждый месяц.",
  },
  {
    q: "Можно ли проходить с телефона?",
    a: "Да. Талапкер работает на любом устройстве: телефон, планшет, ноутбук. Прогресс синхронизируется автоматически — можно начать в автобусе и закончить дома.",
  },
  {
    q: "Что если я уже зарегистрировался, но не понравилось?",
    a: "В течение 14 дней после оплаты — полный возврат денег без вопросов. Просто напиши в чат поддержки.",
  },
  {
    q: "Подходит для подготовки на грант?",
    a: "Да. Ты заранее видишь, какой балл стабильно показываешь, и можешь сравнить с пороговым для нужного вуза и специальности. Все профили ЕНТ (включая творческие комбинации) поддерживаются.",
  },
  {
    q: "А если я учусь в казахской школе?",
    a: "Все задания доступны на двух языках — қазақ тілі и русском. Переключение в один клик, прогресс общий.",
  },
  {
    q: "Как часто обновляются задания?",
    a: "Каждый месяц мы добавляем 200–400 новых заданий и убираем устаревшие. Ты не будешь видеть один и тот же тест дважды.",
  },
  {
    q: "Есть ли скидки для школ и учителей?",
    a: "Да. Если ты учитель или завуч — напиши нам, оформим класс или поток с большой скидкой и отдельной аналитикой по ученикам.",
  },
]

export function FAQ() {
  return (
    <section id="faq" className="border-b border-border/60">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="text-center">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Вопросы
          </span>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Что обычно{" "}
            <span className="font-serif italic font-normal">спрашивают</span>.
          </h2>
        </div>

        <Accordion
          type="single"
          collapsible
          className="mt-12 divide-y divide-border border-y border-border"
        >
          {faqs.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border-b-0 px-1"
            >
              <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline sm:text-lg">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 pr-8 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Есть ещё вопросы?{" "}
          <a href="#lead" className="font-medium text-foreground underline-offset-4 hover:underline">
            Оставь заявку
          </a>
          .
        </p>
      </div>
    </section>
  )
}
