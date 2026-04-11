/**
 * Импорт банков «Қазақстан тарихы / История Казахстана» (ЕНТ, KK PDF) из history-kz-ent-kk-seed-data.json.
 * Запуск из apps/api: npx ts-node prisma/seed-history-kz-ent-kk.ts
 * Предмет: history_kz (тот же, что в основном seed).
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type I18n = { kk: string; ru: string; en: string };
const i = (kk: string, ru: string, en: string): Prisma.InputJsonValue => ({ kk, ru, en });

interface TopicGroup {
  name: I18n;
  questions: {
    stemKk: string;
    optionsKk: Record<string, string>;
    correct: string;
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
  const jsonPath = path.join(__dirname, 'history-kz-ent-kk-seed-data.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath} — run: python3 prisma/scripts/parse_ent_kk_history_pdfs.py`);
  }
  const banks = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Bank[];

  const ent = await prisma.examType.findUnique({ where: { slug: 'ent' } });
  if (!ent) {
    throw new Error('Exam type ent not found — run prisma seed first');
  }

  const subject = await prisma.subject.findUnique({
    where: { examTypeId_slug: { examTypeId: ent.id, slug: 'history_kz' } },
  });
  if (!subject) {
    throw new Error('Subject history_kz not found — run prisma seed first');
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
        const stemKk = cleanStem(q.stemKk);
        const answerOptions = letters.map((L, idx) => ({
          content: i(
            q.optionsKk[L] ?? '',
            q.optionsKk[L] ?? '',
            q.optionsKk[L] ?? '',
          ) as Prisma.InputJsonValue,
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
            content: i(stemKk, stemKk, stemKk) as unknown as Prisma.InputJsonValue,
            explanation: i('', '', '') as unknown as Prisma.InputJsonValue,
            answerOptions: { create: answerOptions },
          },
        });
      }
      console.log(`  inserted ${tg.questions.length} questions`);
    }
  }

  console.log('seed-history-kz-ent-kk done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
