// Baseline filter for user-generated text (App Store guideline 1.2, Google Play UGC policy).
// It stops the most obvious abuse before it is stored. Reports, blocking and audited
// moderation remain the primary controls; extend the list with SOCIAL_BLOCKED_TERMS
// (comma-separated word stems) without a deploy.

// Stems are matched against whole words of the normalized text, never across word borders.
// Roots that stay obscene wherever they sit in a word ("нахуй", "распиздяй").
const ROOT_STEMS = [
  "хуй", "хуе", "пизд", "ебан", "ебат", "ебал", "ебну", "ебуч", "бляд", "блят", "залуп", "мудак", "гандон", "fuck", "nigg", "pizd",
];
const PREFIX_STEMS = [
  // Russian
  "хуй", "хуе", "хуя", "хуи", "пизд", "пидор", "пидар", "пидр", "еба", "ебе", "ебл", "ебу", "еби", "ебн",
  "блят", "бляд", "мудак", "мудил", "гандон", "шлюх", "залуп", "сука", "сучк", "сучар", "долбоеб", "уебан", "уебок",
  // Kazakh
  "сиктир", "сіктір", "сікті", "қотақ", "жезөкше", "амына", "амыңа",
  // English and transliterated Russian
  "fuck", "nigg", "bitch", "cunt", "whore", "faggot", "pizd", "blyat", "blyad", "pidor", "pidar",
];
// Prefixes that are also common word beginnings need an explicit exception list.
const ALLOWED_WORDS = new Set(["ебеня"]);

const HOMOGLYPHS: Record<string, string> = {
  a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", k: "к", m: "м", t: "т", h: "н", b: "в",
};

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/ё/g, "е")
    .replace(/[​-‏⁠﻿]/g, "");

function words(text: string): string[] {
  const tokens = fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  // "х у й" or "х.у.й": join runs of single letters back into one word.
  const joined: string[] = [];
  let run = "";
  for (const token of tokens) {
    if ([...token].length === 1) run += token;
    else {
      if (run.length > 1) joined.push(run);
      run = "";
    }
  }
  if (run.length > 1) joined.push(run);
  return [...tokens, ...joined];
}

const toCyrillic = (word: string) => [...word].map((ch) => HOMOGLYPHS[ch] ?? ch).join("");

export function containsBlockedContent(text: string, extraStems: string[] = configuredStems()): boolean {
  if (!text) return false;
  const stems = [...PREFIX_STEMS, ...extraStems.map((stem) => stem.toLowerCase())];
  return words(text).some((word) => {
    if (ALLOWED_WORDS.has(word)) return false;
    // Latin look-alikes are only folded to Cyrillic inside mixed-script words ("xуй"),
    // so plain English words such as "ebay" are not mistaken for Russian.
    const mixed = /[a-z]/.test(word) && /[а-яәіңғүұқөһ]/.test(word);
    const variants = mixed ? [word, toCyrillic(word)] : [word];
    return variants.some(
      (variant) =>
        ROOT_STEMS.some((root) => variant.includes(root)) ||
        stems.some((stem) => variant.startsWith(stem)),
    );
  });
}

function configuredStems(): string[] {
  return (process.env.SOCIAL_BLOCKED_TERMS ?? "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
}

export const BLOCKED_CONTENT_MESSAGE =
  "Текст содержит недопустимые выражения. Перефразируйте / Мәтінде рұқсат етілмеген сөздер бар. Басқаша жазыңыз";
