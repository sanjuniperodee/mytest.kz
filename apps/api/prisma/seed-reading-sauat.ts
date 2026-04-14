/**
 * Импорт «Оқу сауаттылығы» из reading-literacy-seed-data.json.
 * bank-19 (RU+KK): две записи на вопрос (kk и ru). Остальные банки — один язык.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  parseQuestionContentLocale,
  QUESTION_METADATA_LOCALE_KEY,
} from '../src/common/question-locale';
import { splitReadingStem } from '@bilimland/shared';

const prisma = new PrismaClient();

type I18n = { kk: string; ru: string; en: string };
const i = (kk: string, ru: string, en: string): Prisma.InputJsonValue => ({ kk, ru, en });

/** Мәтін → `passage`, сұрақ → `text` (те же эвристики, что на клиенте). Иначе весь текст в `text`. */
function readingLocaleSlot(fullStem: string): { passage?: string; text: string } {
  const sp = splitReadingStem(fullStem);
  if (sp && sp.passage.trim().length > 0 && sp.prompt.trim().length > 0) {
    return { passage: sp.passage, text: sp.prompt };
  }
  return { text: fullStem };
}

function contentKkOnly(stemKk: string): Prisma.InputJsonValue {
  const slot = readingLocaleSlot(stemKk);
  return { kk: slot, ru: '', en: '' } as unknown as Prisma.InputJsonValue;
}

function contentRuOnly(stemRu: string): Prisma.InputJsonValue {
  const slot = readingLocaleSlot(stemRu);
  const ru = { ...slot };
  const en = { ...slot };
  return { kk: '', ru, en } as unknown as Prisma.InputJsonValue;
}

interface Bank {
  id: string;
  label: I18n;
  questions: {
    n: number;
    stemRu: string;
    stemKk: string;
    optionsRu: Record<string, string>;
    optionsKk: Record<string, string>;
    correct: string;
    contentLocale?: string;
  }[];
}

const letters = ['A', 'B', 'C', 'D'] as const;

function isDualLanguageBank(bankId: string): boolean {
  return bankId === 'bank-19';
}

function fallbackLocaleForBank(bankId: string): 'kk' | 'ru' {
  if (bankId.includes('82-ru') || bankId.endsWith('-ru')) return 'ru';
  return 'kk';
}

async function main() {
  const jsonPath = path.join(__dirname, 'reading-literacy-seed-data.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath} — run: python3 prisma/scripts/parse_reading_literacy_pdfs.py`);
  }
  const banks = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Bank[];

  let ent = await prisma.examType.findUnique({ where: { slug: 'ent' } });
  if (!ent) {
    ent = await prisma.examType.create({
      data: {
        slug: 'ent',
        name: i('ҰБТ/ЕНТ', 'ЕНТ', 'UNT'),
        description: i(
          'Оқу сауаттылығы банкі',
          'Банк вопросов грамотности чтения',
          'Reading literacy question bank',
        ),
      },
    });
    console.log('Created exam type ent');
  }

  let subject = await prisma.subject.findUnique({
    where: { examTypeId_slug: { examTypeId: ent.id, slug: 'reading_literacy' } },
  });
  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        examTypeId: ent.id,
        slug: 'reading_literacy',
        name: i('Оқу сауаттылығы', 'Грамотность чтения', 'Reading Literacy'),
        isMandatory: true,
        sortOrder: 2,
      },
    });
    console.log('Created subject reading_literacy');
  }

  const existingTopics = await prisma.topic.findMany({ where: { subjectId: subject.id } });

  let ord = 800;
  for (const bank of banks) {
    let topic = existingTopics.find((t) => {
      const n = t.name as { ru?: string };
      return n.ru === bank.label.ru;
    });

    if (!topic) {
      topic = await prisma.topic.create({
        data: {
          subjectId: subject.id,
          name: i(bank.label.kk, bank.label.ru, bank.label.en),
          sortOrder: ord++,
        },
      });
      existingTopics.push(topic);
    }

    await prisma.testAnswer.deleteMany({
      where: { question: { topicId: topic.id } },
    });
    const deleted = await prisma.question.deleteMany({ where: { topicId: topic.id } });
    console.log(`Topic ${bank.id}: removed ${deleted.count} old questions`);

    let inserted = 0;
    const dual = isDualLanguageBank(bank.id);
    const fb = fallbackLocaleForBank(bank.id);

    for (const q of bank.questions) {
      const loc = dual ? null : parseQuestionContentLocale(q.contentLocale, fb);

      if (dual) {
        const optsKk = letters.map((L, idx) => ({
          content: i(q.optionsKk[L] ?? '', '', '') as Prisma.InputJsonValue,
          isCorrect: L === q.correct,
          sortOrder: idx,
        }));
        const optsRu = letters.map((L, idx) => ({
          content: i('', q.optionsRu[L] ?? '', q.optionsRu[L] ?? '') as Prisma.InputJsonValue,
          isCorrect: L === q.correct,
          sortOrder: idx,
        }));
        await prisma.question.create({
          data: {
            topicId: topic.id,
            subjectId: subject.id,
            examTypeId: ent.id,
            difficulty: 3,
            type: 'single_choice',
            content: contentKkOnly(q.stemKk),
            explanation: i('', '', '') as unknown as Prisma.InputJsonValue,
            metadata: { [QUESTION_METADATA_LOCALE_KEY]: 'kk' } as Prisma.InputJsonValue,
            answerOptions: { create: optsKk },
          },
        });
        await prisma.question.create({
          data: {
            topicId: topic.id,
            subjectId: subject.id,
            examTypeId: ent.id,
            difficulty: 3,
            type: 'single_choice',
            content: contentRuOnly(q.stemRu),
            explanation: i('', '', '') as unknown as Prisma.InputJsonValue,
            metadata: { [QUESTION_METADATA_LOCALE_KEY]: 'ru' } as Prisma.InputJsonValue,
            answerOptions: { create: optsRu },
          },
        });
        inserted += 2;
      } else if (loc === 'ru') {
        const optsRu = letters.map((L, idx) => ({
          content: i('', q.optionsRu[L] ?? '', q.optionsRu[L] ?? '') as Prisma.InputJsonValue,
          isCorrect: L === q.correct,
          sortOrder: idx,
        }));
        await prisma.question.create({
          data: {
            topicId: topic.id,
            subjectId: subject.id,
            examTypeId: ent.id,
            difficulty: 3,
            type: 'single_choice',
            content: contentRuOnly(q.stemRu),
            explanation: i('', '', '') as unknown as Prisma.InputJsonValue,
            metadata: { [QUESTION_METADATA_LOCALE_KEY]: 'ru' } as Prisma.InputJsonValue,
            answerOptions: { create: optsRu },
          },
        });
        inserted += 1;
      } else {
        const optsKk = letters.map((L, idx) => ({
          content: i(q.optionsKk[L] ?? '', '', '') as Prisma.InputJsonValue,
          isCorrect: L === q.correct,
          sortOrder: idx,
        }));
        await prisma.question.create({
          data: {
            topicId: topic.id,
            subjectId: subject.id,
            examTypeId: ent.id,
            difficulty: 3,
            type: 'single_choice',
            content: contentKkOnly(q.stemKk),
            explanation: i('', '', '') as unknown as Prisma.InputJsonValue,
            metadata: { [QUESTION_METADATA_LOCALE_KEY]: 'kk' } as Prisma.InputJsonValue,
            answerOptions: { create: optsKk },
          },
        });
        inserted += 1;
      }
    }
    console.log(`Topic ${bank.id}: inserted ${inserted} questions`);
  }

  console.log('seed-reading-sauat done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
