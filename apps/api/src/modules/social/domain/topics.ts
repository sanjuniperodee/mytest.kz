// Темы обсуждений. Ключ хранится в SocialPost.topicKey; ответы наследуют тему и публичность корня.
//   program:B057        — группа образовательных программ (страница проходных баллов специальности)
//   university:13       — вуз (страница проходных баллов вуза)
//   qotd:2026-11-08     — «вопрос дня» в сообществе (только для вошедших)
export const TOPIC_KEY_RE = /^(program:[A-Z]{1,2}\d{3}|university:\d{1,5}|qotd:\d{4}-\d{2}-\d{2})$/;

/** Темы, вопросы в которых можно публиковать открыто — на SEO-страницах вузов и специальностей. */
export const PUBLIC_TOPIC_KEY_RE = /^(program:[A-Z]{1,2}\d{3}|university:\d{1,5})$/;

export function isPublicTopic(key: string | null | undefined): boolean {
  return Boolean(key && PUBLIC_TOPIC_KEY_RE.test(key));
}

// Публичный текст попадает в поиск: ссылки и телефоны там — спам или утечка личных данных.
const LINK_RE = /(https?:\/\/|www\.|t\.me\/|wa\.me\/|\b[a-z0-9-]{2,}\.(kz|ru|com|net|org|me|io|info|site|xyz)\b)/i;
const PHONE_RE = /(\+?7|8)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/;

export const PUBLIC_LINK_MESSAGE =
  "В открытых обсуждениях нельзя оставлять ссылки и номера телефонов";

export function publicTextProblem(body: string): string | null {
  return LINK_RE.test(body) || PHONE_RE.test(body) ? PUBLIC_LINK_MESSAGE : null;
}

/** Имя автора на публичной странице: «Айгерим К.», без фамилии и аватара. */
export function publicAuthorName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim();
  const initial = (lastName ?? "").trim().charAt(0);
  if (!first) return "Участник";
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}
