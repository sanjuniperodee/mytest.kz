/**
 * Импорт авторских банков вопросов ЕНТ из prisma/ent-banks/**\/*.txt
 *
 * Формат файла — см. prisma/ent-banks/README.md.
 * Импорт только добавляющий: существующие вопросы не удаляются и не меняются,
 * точные дубликаты (язык + формулировка + варианты) пропускаются.
 *
 * Запуск из apps/api:
 *   npx ts-node prisma/seed-ent-banks.ts --check            # только разбор и валидация, БД не нужна
 *   npx ts-node prisma/seed-ent-banks.ts                    # импорт всех банков
 *   npx ts-node prisma/seed-ent-banks.ts physics            # только каталог/файлы, путь которых содержит "physics"
 *   npx ts-node prisma/seed-ent-banks.ts --remove-bank=ent26-physics   # откат по префиксу metadata.sourceBankId
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { QUESTION_METADATA_LOCALE_KEY } from '../src/common/question-locale';

type Locale = 'kk' | 'ru';
type I18n = { kk: string; ru: string; en: string };

interface ParsedQuestion {
  file: string;
  line: number;
  locales: Locale[];
  bank: string;
  subject: string;
  topic: I18n;
  passage?: string;
  stem: string;
  options: { text: string; correct: boolean }[];
  fixed: boolean;
  explanation: string;
  difficulty: number;
  weight?: number;
}

const BANKS_DIR = path.join(__dirname, 'ent-banks');

/** Предметы ЕНТ: создаются, если ещё нет в БД. */
const SUBJECT_CATALOG: Record<string, { name: I18n; mandatory: boolean; sortOrder: number }> = {
  math_literacy: { name: { kk: 'Математикалық сауаттылық', ru: 'Математическая грамотность', en: 'Mathematical Literacy' }, mandatory: true, sortOrder: 1 },
  reading_literacy: { name: { kk: 'Оқу сауаттылығы', ru: 'Грамотность чтения', en: 'Reading Literacy' }, mandatory: true, sortOrder: 2 },
  history_kz: { name: { kk: 'Қазақстан тарихы', ru: 'История Казахстана', en: 'History of Kazakhstan' }, mandatory: true, sortOrder: 3 },
  math: { name: { kk: 'Математика', ru: 'Математика', en: 'Mathematics' }, mandatory: false, sortOrder: 4 },
  physics: { name: { kk: 'Физика', ru: 'Физика', en: 'Physics' }, mandatory: false, sortOrder: 5 },
  chemistry: { name: { kk: 'Химия', ru: 'Химия', en: 'Chemistry' }, mandatory: false, sortOrder: 6 },
  biology: { name: { kk: 'Биология', ru: 'Биология', en: 'Biology' }, mandatory: false, sortOrder: 7 },
  geography: { name: { kk: 'География', ru: 'География', en: 'Geography' }, mandatory: false, sortOrder: 8 },
  world_history: { name: { kk: 'Дүниежүзі тарихы', ru: 'Всемирная история', en: 'World History' }, mandatory: false, sortOrder: 9 },
  english: { name: { kk: 'Ағылшын тілі', ru: 'Английский язык', en: 'English Language' }, mandatory: false, sortOrder: 10 },
  kazakh_lang: { name: { kk: 'Қазақ тілі', ru: 'Казахский язык', en: 'Kazakh Language' }, mandatory: false, sortOrder: 11 },
  russian_lang: { name: { kk: 'Орыс тілі', ru: 'Русский язык', en: 'Russian Language' }, mandatory: false, sortOrder: 12 },
  informatics: { name: { kk: 'Информатика', ru: 'Информатика', en: 'Computer Science' }, mandatory: false, sortOrder: 13 },
  law_basics: { name: { kk: 'Құқық негіздері', ru: 'Основы права', en: 'Fundamentals of Law' }, mandatory: false, sortOrder: 14 },
};

/* ───────────────────────── parsing ───────────────────────── */

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith('.txt')) out.push(p);
  }
  return out.sort();
}

function parseTopicLine(spec: string): I18n {
  const t: I18n = { kk: '', ru: '', en: '' };
  for (const part of spec.split('|')) {
    const m = part.trim().match(/^(kk|ru|en)\s*=\s*(.+)$/);
    if (m) t[m[1] as keyof I18n] = m[2].trim();
  }
  if (!t.ru && !t.kk) throw new Error(`bad @topic: ${spec}`);
  if (!t.kk) t.kk = t.ru;
  if (!t.ru) t.ru = t.kk;
  if (!t.en) t.en = t.ru;
  return t;
}

function parseFile(file: string): ParsedQuestion[] {
  const rel = path.relative(BANKS_DIR, file);
  const lines = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n').split('\n');
  const result: ParsedQuestion[] = [];

  let subject = '';
  let bank = '';
  let locales: Locale[] = [];
  let topic: I18n | null = null;
  let weight: number | undefined;

  type Draft = {
    line: number;
    stem: string;
    passage?: string;
    options: { text: string; correct: boolean }[];
    fixed: boolean;
    explanation: string;
    difficulty: number;
    weight?: number;
    cur: 'stem' | 'passage' | 'option' | 'explanation' | null;
  };
  let d: Draft | null = null;

  const flush = () => {
    if (!d) return;
    if (!subject || !bank || locales.length === 0 || !topic) {
      throw new Error(`${rel}:${d.line}: вопрос до объявления @subject/@bank/@locales/@topic`);
    }
    result.push({
      file: rel,
      line: d.line,
      locales,
      bank,
      subject,
      topic,
      passage: d.passage?.trim() || undefined,
      stem: d.stem.trim(),
      options: d.options.map((o) => ({ text: o.text.trim(), correct: o.correct })),
      fixed: d.fixed,
      explanation: d.explanation.trim(),
      difficulty: d.difficulty,
      weight: d.weight ?? weight,
    });
    d = null;
  };

  lines.forEach((raw, idx) => {
    const ln = idx + 1;
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('//')) return; // комментарий
    const dir = line.match(/^@(subject|bank|locales|topic|weight)\s+(.*)$/);
    if (dir) {
      flush();
      const [, key, val] = dir;
      if (key === 'subject') subject = val.trim();
      else if (key === 'bank') bank = val.trim();
      else if (key === 'locales') {
        locales = val.split(',').map((x) => x.trim()) as Locale[];
        if (!locales.every((l) => l === 'kk' || l === 'ru')) throw new Error(`${rel}:${ln}: @locales kk|ru`);
      } else if (key === 'topic') topic = parseTopicLine(val);
      else if (key === 'weight') weight = val.trim() === 'default' ? undefined : Number(val);
      return;
    }
    if (line.trim() === '') {
      flush();
      return;
    }
    const q = line.match(/^\? (.*)$/);
    if (q) {
      flush();
      d = { line: ln, stem: q[1], options: [], fixed: false, explanation: '', difficulty: 3, cur: 'stem' };
      return;
    }
    if (!d) throw new Error(`${rel}:${ln}: текст вне вопроса: "${line.slice(0, 40)}"`);
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^P: ?(.*)$/))) {
      d.passage = (d.passage ? d.passage + '\n' : '') + m[1];
      d.cur = 'passage';
    } else if ((m = line.match(/^([+-]) (.*)$/))) {
      d.options.push({ text: m[2], correct: m[1] === '+' });
      d.cur = 'option';
    } else if ((m = line.match(/^E: ?(.*)$/))) {
      d.explanation = (d.explanation ? d.explanation + '\n' : '') + m[1];
      d.cur = 'explanation';
    } else if ((m = line.match(/^D: ?(\d)$/))) {
      d.difficulty = Math.min(5, Math.max(1, Number(m[1])));
    } else if (line === '!fixed') {
      d.fixed = true;
    } else if (d.cur === 'stem') d.stem += '\n' + line;
    else if (d.cur === 'passage') d.passage += '\n' + line;
    else if (d.cur === 'explanation') d.explanation += '\n' + line;
    else if (d.cur === 'option') d.options[d.options.length - 1].text += '\n' + line;
  });
  flush();
  return result;
}

/* ───────────────────────── validation ───────────────────────── */

const ORDER_DEPENDENT =
  /(все перечисленные|все вышеперечисленные|все ответы|все варианты|ни один из|ничего из|верны все|оба варианта|оба ответа|жоғарыдағылардың барлығы|барлық жауап|барлығы дұрыс|бәрі дұрыс|ешқайсысы)/i;

function validate(qs: ParsedQuestion[]): string[] {
  const errs: string[] = [];
  const seen = new Map<string, string>();
  for (const q of qs) {
    const where = `${q.file}:${q.line}`;
    const correct = q.options.filter((o) => o.correct).length;
    if (!SUBJECT_CATALOG[q.subject]) errs.push(`${where}: неизвестный предмет ${q.subject}`);
    if (q.stem.length < 6) errs.push(`${where}: слишком короткая формулировка`);
    if (q.options.length < 2 || q.options.length > 8) errs.push(`${where}: вариантов ${q.options.length}`);
    if (correct < 1) errs.push(`${where}: нет верного ответа`);
    if (correct === q.options.length) errs.push(`${where}: все варианты верны`);
    if (correct === 1 && (q.options.length < 3 || q.options.length > 5)) errs.push(`${where}: single — ожидается 3–5 вариантов (${q.options.length})`);
    if (correct > 1 && q.options.length < 5) errs.push(`${where}: multiple — ожидается ≥5 вариантов`);
    const texts = q.options.map((o) => o.text.replace(/\s+/g, ' ').trim());
    if (new Set(texts).size !== texts.length) errs.push(`${where}: повторяющиеся варианты`);
    if (texts.some((t) => !t)) errs.push(`${where}: пустой вариант`);
    if (q.options.some((o) => /^([A-E][).]|[А-Е]\))\s/.test(o.text))) errs.push(`${where}: в варианте остался префикс A)`);
    if (!q.fixed && q.options.some((o) => ORDER_DEPENDENT.test(o.text)))
      errs.push(`${where}: вариант зависит от порядка — добавьте !fixed и расставьте варианты вручную`);
    if (!q.explanation) errs.push(`${where}: нет объяснения (E:)`);
    for (const t of [q.stem, q.passage ?? '', ...q.options.map((o) => o.text)])
      if ((t.match(/(?<!\\)\$/g) ?? []).length % 2 === 1) errs.push(`${where}: нечётное число $ (LaTeX): ${t.slice(0, 40)}`);
    for (const loc of q.locales) {
      const key = `${q.subject}|${loc}|${fingerprintText(q)}`;
      const prev = seen.get(key);
      if (prev) errs.push(`${where}: дубликат ${prev}`);
      else seen.set(key, where);
    }
  }
  return errs;
}

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function fingerprintText(q: Pick<ParsedQuestion, 'stem' | 'passage' | 'options'>): string {
  return `${norm(q.passage ?? '')}§${norm(q.stem)}§${q.options
    .map((o) => `${norm(o.text)}:${o.correct ? 1 : 0}`)
    .sort()
    .join('|')}`;
}

/* ───────────────────────── import ───────────────────────── */

/** Детерминированный shuffle (mulberry32) от хэша формулировки. */
function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const h = createHash('sha1').update(seedStr).digest();
  let a = h.readUInt32LE(0);
  const rnd = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const slot = (loc: Locale, text: string): Prisma.InputJsonValue =>
  loc === 'kk' ? { kk: text, ru: '', en: '' } : { kk: '', ru: text, en: text };

const slotObj = (loc: Locale, obj: { text: string; passage?: string }): Prisma.InputJsonValue => {
  const o = obj.passage ? { text: obj.text, passage: obj.passage } : { text: obj.text };
  return loc === 'kk'
    ? ({ kk: o, ru: '', en: '' } as unknown as Prisma.InputJsonValue)
    : ({ kk: '', ru: o, en: { ...o } } as unknown as Prisma.InputJsonValue);
};

function textOf(content: unknown, loc: Locale): string {
  if (!content || typeof content !== 'object') return '';
  const v = (content as Record<string, unknown>)[loc] ?? (loc === 'ru' ? (content as Record<string, unknown>).en : '');
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return String((v as { text?: string }).text ?? '');
  return '';
}
function passageOf(content: unknown, loc: Locale): string {
  const v = content && typeof content === 'object' ? (content as Record<string, unknown>)[loc] : null;
  return v && typeof v === 'object' ? String((v as { passage?: string }).passage ?? '') : '';
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const removeArg = args.find((a) => a.startsWith('--remove-bank='));
  const filters = args.filter((a) => !a.startsWith('--'));

  const files = walk(BANKS_DIR).filter((f) => filters.length === 0 || filters.some((x) => f.includes(x)));
  if (files.length === 0 && !removeArg) throw new Error(`Нет файлов в ${BANKS_DIR}`);

  const questions: ParsedQuestion[] = [];
  for (const f of files) questions.push(...parseFile(f));

  const errors = validate(questions);
  // статистика
  const stat = new Map<string, number>();
  for (const q of questions) for (const l of q.locales) stat.set(`${q.subject}/${l}`, (stat.get(`${q.subject}/${l}`) ?? 0) + 1);
  console.log(`Файлов: ${files.length}, вопросов (записей-источников): ${questions.length}`);
  for (const [k, v] of [...stat].sort()) console.log(`  ${k}: ${v}`);
  if (errors.length) {
    console.error(`\nОШИБОК ВАЛИДАЦИИ: ${errors.length}`);
    for (const e of errors.slice(0, 80)) console.error('  ' + e);
    if (errors.length > 80) console.error(`  … и ещё ${errors.length - 80}`);
    process.exit(1);
  }
  console.log('Валидация OK');
  if (checkOnly) return;

  const prisma = new PrismaClient();
  try {
    if (removeArg) {
      const prefix = removeArg.split('=')[1];
      const victims = await prisma.question.findMany({
        where: { metadata: { path: ['sourceBankId'], string_starts_with: prefix } },
        select: { id: true },
      });
      const ids = victims.map((v) => v.id);
      await prisma.testAnswer.deleteMany({ where: { questionId: { in: ids } } });
      const del = await prisma.question.deleteMany({ where: { id: { in: ids } } });
      console.log(`Удалено вопросов с sourceBankId "${prefix}*": ${del.count}`);
      return;
    }

    let ent = await prisma.examType.findUnique({ where: { slug: 'ent' } });
    if (!ent) {
      ent = await prisma.examType.create({
        data: { slug: 'ent', name: { kk: 'ҰБТ/ЕНТ', ru: 'ЕНТ', en: 'UNT' }, description: { kk: 'ҰБТ', ru: 'Единое национальное тестирование', en: 'Unified National Testing' } },
      });
    }

    const subjectIds = new Map<string, string>();
    for (const slug of new Set(questions.map((q) => q.subject))) {
      let s = await prisma.subject.findUnique({ where: { examTypeId_slug: { examTypeId: ent.id, slug } } });
      if (!s) {
        const c = SUBJECT_CATALOG[slug];
        s = await prisma.subject.create({
          data: { examTypeId: ent.id, slug, name: c.name, isMandatory: c.mandatory, sortOrder: c.sortOrder },
        });
        console.log(`Создан предмет ${slug}`);
      }
      subjectIds.set(slug, s.id);
    }

    let inserted = 0;
    let skipped = 0;
    for (const [slug, subjectId] of subjectIds) {
      const topics = await prisma.topic.findMany({ where: { subjectId } });
      let nextOrder = Math.max(1000, ...topics.map((t) => t.sortOrder + 1));
      const topicCache = new Map<string, string>();
      const topicIdFor = async (name: I18n): Promise<string> => {
        const key = norm(name.ru);
        const cached = topicCache.get(key);
        if (cached) return cached;
        const found = topics.find((t) => norm(String((t.name as Record<string, string>).ru ?? '')) === key);
        if (found) {
          topicCache.set(key, found.id);
          return found.id;
        }
        const created = await prisma.topic.create({ data: { subjectId, name, sortOrder: nextOrder++ } });
        topics.push(created);
        topicCache.set(key, created.id);
        return created.id;
      };

      // отпечатки уже существующих вопросов предмета
      const existing = await prisma.question.findMany({
        where: { subjectId, examTypeId: ent.id },
        select: { content: true, metadata: true, answerOptions: { select: { content: true, isCorrect: true } } },
      });
      const have = new Set<string>();
      for (const e of existing) {
        const loc: Locale =
          (e.metadata as Record<string, unknown> | null)?.[QUESTION_METADATA_LOCALE_KEY] === 'kk' ? 'kk' : 'ru';
        have.add(
          `${loc}|${fingerprintText({
            passage: passageOf(e.content, loc),
            stem: textOf(e.content, loc),
            options: e.answerOptions.map((o) => ({ text: textOf(o.content, loc), correct: o.isCorrect })),
          })}`,
        );
      }

      for (const q of questions.filter((x) => x.subject === slug)) {
        const topicId = await topicIdFor(q.topic);
        for (const loc of q.locales) {
          const fp = `${loc}|${fingerprintText(q)}`;
          if (have.has(fp)) {
            skipped++;
            continue;
          }
          have.add(fp);
          const opts = q.fixed ? q.options : seededShuffle(q.options, q.stem);
          const correctCount = opts.filter((o) => o.correct).length;
          await prisma.question.create({
            data: {
              topicId,
              subjectId,
              examTypeId: ent.id,
              difficulty: q.difficulty,
              type: correctCount > 1 ? 'multiple_choice' : 'single_choice',
              content: slotObj(loc, { text: q.stem, passage: q.passage }),
              explanation: slot(loc, q.explanation),
              scoreWeight: q.weight ?? null,
              metadata: {
                [QUESTION_METADATA_LOCALE_KEY]: loc,
                sourceBankId: q.bank,
                sourceFile: q.file,
                authoredAt: '2026-10',
              } as Prisma.InputJsonValue,
              answerOptions: {
                create: opts.map((o, i) => ({ content: slot(loc, o.text), isCorrect: o.correct, sortOrder: i })),
              },
            },
          });
          inserted++;
        }
      }
    }
    console.log(`Готово. Добавлено: ${inserted}, пропущено дубликатов: ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
