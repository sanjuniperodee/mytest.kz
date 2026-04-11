/**
 * Импорт банков «История Казахстана» (ЕНТ, RU PDF) из history-kz-ent-ru-seed-data.json.
 * Запуск из apps/api: npx ts-node prisma/seed-history-kz-ent-ru.ts
 * При отсутствии создаёт exam `ent` и предмет `history_kz` (как seed-history-kz-ent-kk).
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  parseQuestionContentLocale,
  QUESTION_METADATA_LOCALE_KEY,
} from '../src/common/question-locale';

const prisma = new PrismaClient();

type I18n = { kk: string; ru: string; en: string };
const i = (kk: string, ru: string, en: string): Prisma.InputJsonValue => ({ kk, ru, en });

interface TopicGroup {
  name: I18n;
  questions: {
    stemRu: string;
    optionsRu: Record<string, string>;
    correct: string;
    contentLocale?: string;
  }[];
}

interface Bank {
  id: string;
  label: I18n;
  topics: TopicGroup[];
}

function cleanStem(s: string): string {
  return s.replace(/^\d+\)\s*/, '').trim();
}

async function main() {
  const jsonPath = path.join(__dirname, 'history-kz-ent-ru-seed-data.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath} — run: python3 prisma/scripts/parse_ent_ru_history_pdfs.py`);
  }
  const banks = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Bank[];

  let ent = await prisma.examType.findUnique({ where: { slug: 'ent' } });
  if (!ent) {
    ent = await prisma.examType.create({
      data: {
        slug: 'ent',
        name: i('ҰБТ/ЕНТ', 'ЕНТ', 'UNT'),
        description: i(
          'ЕНТ сынақтары',
          'Варианты ЕНТ',
          'UNT practice',
        ),
      },
    });
    console.log('Created exam type ent');
  }

  let subject = await prisma.subject.findUnique({
    where: { examTypeId_slug: { examTypeId: ent.id, slug: 'history_kz' } },
  });
  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        examTypeId: ent.id,
        slug: 'history_kz',
        name: i('Қазақстан тарихы', 'История Казахстана', 'History of Kazakhstan'),
        isMandatory: true,
        sortOrder: 3,
      },
    });
    console.log('Created subject history_kz');
  }

  const existingTopics = await prisma.topic.findMany({ where: { subjectId: subject.id } });

  let ord =
    existingTopics.length > 0
      ? Math.max(...existingTopics.map((t) => t.sortOrder), 0) + 1
      : 900;

  const letters = ['A', 'B', 'C', 'D'] as const;

  for (const bank of banks) {
    for (const tg of bank.topics) {
      const topicRu = `${bank.label.ru} · ${tg.name.ru}`;
      const topicKk = `${bank.label.kk} · ${tg.name.kk}`;
      const topicEn = `${bank.label.en} · ${tg.name.en}`;

      let topic = existingTopics.find((t) => {
        const n = t.name as { ru?: string };
        return n.ru === topicRu;
      });

      if (!topic) {
        topic = await prisma.topic.create({
          data: {
            subjectId: subject.id,
            name: i(topicKk, topicRu, topicEn),
            sortOrder: ord++,
          },
        });
        existingTopics.push(topic);
      }

      const deleted = await prisma.question.deleteMany({ where: { topicId: topic.id } });
      const short = topicRu.length > 72 ? `${topicRu.slice(0, 72)}…` : topicRu;
      console.log(`Topic "${short}": removed ${deleted.count} old questions`);

      for (const q of tg.questions) {
        const stemRu = cleanStem(q.stemRu);
        const opt = (L: string) => q.optionsRu[L] ?? '';
        const answerOptions = letters.map((L, idx) => ({
          content: i('', opt(L), opt(L)) as Prisma.InputJsonValue,
          isCorrect: L === q.correct,
          sortOrder: idx,
        }));

        const contentLocale = parseQuestionContentLocale(q.contentLocale, 'ru');
        await prisma.question.create({
          data: {
            topicId: topic.id,
            subjectId: subject.id,
            examTypeId: ent.id,
            difficulty: 3,
            type: 'single_choice',
            content: i('', stemRu, stemRu) as unknown as Prisma.InputJsonValue,
            explanation: i('', '', '') as unknown as Prisma.InputJsonValue,
            metadata: {
              [QUESTION_METADATA_LOCALE_KEY]: contentLocale,
            } as Prisma.InputJsonValue,
            answerOptions: { create: answerOptions },
          },
        });
      }
      console.log(`  inserted ${tg.questions.length} questions`);
    }
  }

  console.log('seed-history-kz-ent-ru done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
