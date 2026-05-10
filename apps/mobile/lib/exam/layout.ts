/** Широкий layout экрана сессии: колонка вопроса + сайдбар с сеткой номеров. */
export const EXAM_WIDE_BREAKPOINT = 1024
export const EXAM_SIDEBAR_WIDTH = 288
/** Горизонтальный padding сайдбара (16+16) для сетки вопросов. */
export const EXAM_SIDEBAR_GRID_INNER = EXAM_SIDEBAR_WIDTH - 32 - 32

/** ScrollView контента сессии: `paddingHorizontal` 16+16. */
export const EXAM_SCROLL_CONTENT_PAD_X = 32
/** Карточка вопроса: `cardInner` padding 20+20. */
export const EXAM_CARD_INNER_PAD_X = 40

/** Ширина области скролла с вопросом (без сайдбара на широком экране). */
export function examScrollViewportWidth(windowWidth: number): number {
  return windowWidth >= EXAM_WIDE_BREAKPOINT ? windowWidth - EXAM_SIDEBAR_WIDTH : windowWidth
}

/** Ширина текстовой колонки внутри карточки (для HTML/WebView) — сразу из ширины окна, без onLayout. */
export function examRichColumnWidth(windowWidth: number): number {
  const scrollInner = examScrollViewportWidth(windowWidth)
  return Math.max(
    160,
    Math.floor(scrollInner - EXAM_SCROLL_CONTENT_PAD_X - EXAM_CARD_INNER_PAD_X),
  )
}

/** Экран разбора: контент с `maxWidth` и горизонтальными отступами скролла 16+16. */
export function reviewContentColumnWidth(windowWidth: number, contentMaxWidth = 896): number {
  const scrollPadX = 32
  return Math.max(200, Math.floor(Math.min(contentMaxWidth, windowWidth - scrollPadX)))
}
