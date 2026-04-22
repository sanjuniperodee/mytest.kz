/**
 * Импорт банка «География» (ЕНТ) из geo-ent-seed-data.json.
 *
 * Поддерживает вопросы с несколькими правильными ответами (A-F),
 * выставляя type = 'multiple_choice'.
 *
 * Запуск:
 *   npx ts-node prisma/seed-geo-ent.ts
 * Если geo-ent-seed-data.json отсутствует:
 *   python3 prisma/scripts/parse_geo_ent_pdfs.py
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import { QUESTION_METADATA_LOCALE_KEY } from '../src/common/question-locale';

const prisma = new PrismaClient();

type I18n = { kk: string; ru: string; en: string };
const i = (kk: string, ru: string, en: string): Prisma.InputJsonValue => ({ kk, ru, en });

interface SeedQuestion {
  n: number;
  stem: string;
  options: Record<string, string>;
  correct: string[];
  contentLocale: 'kk' | 'ru';
}

interface SeedTopic {
  name: I18n;
  questions: SeedQuestion[];
}

interface SeedBank {
  id: string;
  label: I18n;
  topics: SeedTopic[];
}

const OPTION_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

function normalizeLetter(letter: string): string {
  return (letter || '').trim().toUpperCase();
}

function sortOptionKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = OPTION_ORDER.indexOf(normalizeLetter(a));
    const ib = OPTION_ORDER.indexOf(normalizeLetter(b));
    const va = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
    const vb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
    if (va !== vb) return va - vb;
    return a.localeCompare(b);
  });
}

async function ensureEntAndGeography() {
  let ent = await prisma.examType.findUnique({ where: { slug: 'ent' } });
  if (!ent) {
    ent = await prisma.examType.create({
      data: {
        slug: 'ent',
        name: i('ҰБТ/ЕНТ', 'ЕНТ', 'UNT'),
        description: i('География сұрақтар банкі', 'Банк вопросов по географии', 'Geography question bank'),
      },
    });
    console.log('Created exam type ent');
  }

  let subject = await prisma.subject.findUnique({
    where: { examTypeId_slug: { examTypeId: ent.id, slug: 'geography' } },
  });
  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        examTypeId: ent.id,
        slug: 'geography',
        name: i('География', 'География', 'Geography'),
        isMandatory: false,
        sortOrder: 8,
      },
    });
    console.log('Created subject geography');
  }

  return { ent, subject };
}

async function main() {
  const jsonPath = path.join(__dirname, 'geo-ent-seed-data.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath} — run: python3 prisma/scripts/parse_geo_ent_pdfs.py`);
  }
  const banks = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as SeedBank[];
  if (!Array.isArray(banks) || banks.length === 0) {
    throw new Error(`Invalid ${jsonPath}: expected non-empty banks array`);
  }

  const { ent, subject } = await ensureEntAndGeography();
  const existingTopics = await prisma.topic.findMany({ where: { subjectId: subject.id } });
  let nextSortOrder =
    existingTopics.length > 0 ? Math.max(...existingTopics.map((t) => t.sortOrder), 0) + 1 : 900;

  let insertedTotal = 0;

  for (const bank of banks) {
    for (const topicGroup of bank.topics) {
      const topicRu = `${bank.label.ru} · ${topicGroup.name.ru}`;
      const topicKk = `${bank.label.kk} · ${topicGroup.name.kk}`;
      const topicEn = `${bank.label.en} · ${topicGroup.name.en}`;

      let topic = existingTopics.find((t) => {
        const name = t.name as { ru?: string };
        return name.ru === topicRu;
      });

      if (!topic) {
        topic = await prisma.topic.create({
          data: {
            subjectId: subject.id,
            name: i(topicKk, topicRu, topicEn),
            sortOrder: nextSortOrder++,
          },
        });
        existingTopics.push(topic);
      }

      let insertedTopic = 0;
      let skippedTopic = 0;
      for (const q of topicGroup.questions) {
        const locale = q.contentLocale === 'ru' ? 'ru' : 'kk';
        const optionsKeys = sortOptionKeys(Object.keys(q.options ?? {})).filter((k) => {
          const text = (q.options[k] ?? '').trim();
          return text.length > 0;
        });
        if (optionsKeys.length < 2) continue;

        const correctSet = new Set((q.correct ?? []).map((x) => normalizeLetter(x)));
        const hasAnyCorrect = optionsKeys.some((k) => correctSet.has(normalizeLetter(k)));
        if (!hasAnyCorrect) continue;

        const questionType = correctSet.size > 1 ? 'multiple_choice' : 'single_choice';
        const existingCount = await prisma.question.count({
          where: {
            topicId: topic.id,
            subjectId: subject.id,
            examTypeId: ent.id,
            AND: [
              { metadata: { path: ['sourceBankId'], equals: bank.id } },
              { metadata: { path: ['sourceQuestionNo'], equals: q.n } },
              { metadata: { path: [QUESTION_METADATA_LOCALE_KEY], equals: locale } },
            ],
          },
        });
        if (existingCount > 0) {
          skippedTopic += 1;
          continue;
        }

        await prisma.question.create({
          data: {
            topicId: topic.id,
            subjectId: subject.id,
            examTypeId: ent.id,
            difficulty: 3,
            type: questionType,
            content:
              locale === 'kk'
                ? (i(q.stem, '', '') as Prisma.InputJsonValue)
                : (i('', q.stem, q.stem) as Prisma.InputJsonValue),
            explanation: i('', '', '') as Prisma.InputJsonValue,
            metadata: {
              [QUESTION_METADATA_LOCALE_KEY]: locale,
              sourceBankId: bank.id,
              sourceQuestionNo: q.n,
            } as Prisma.InputJsonValue,
            answerOptions: {
              create: optionsKeys.map((letter, idx) => {
                const optionText = (q.options[letter] ?? '').trim();
                return {
                  content:
                    locale === 'kk'
                      ? (i(optionText, '', '') as Prisma.InputJsonValue)
                      : (i('', optionText, optionText) as Prisma.InputJsonValue),
                  isCorrect: correctSet.has(normalizeLetter(letter)),
                  sortOrder: idx,
                };
              }),
            },
          },
        });
        insertedTopic += 1;
      }

      insertedTotal += insertedTopic;
      console.log(`Topic "${topicRu}": inserted ${insertedTopic}, skipped existing ${skippedTopic}`);
    }
  }

  console.log(`seed-geo-ent done. Inserted total: ${insertedTotal}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
