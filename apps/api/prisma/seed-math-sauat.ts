/**
 * Импорт банка «Математическая грамотность» (ЕНТ) из math-literacy-seed-data.json.
 * Запуск: из каталога apps/api — `npx ts-node prisma/seed-math-sauat.ts`
 * Требует существующих exam type `ent` и subject `math_literacy` (основной seed или продакшен).
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type I18n = { kk: string; ru: string; en: string };
const i = (kk: string, ru: string, en: string): Prisma.InputJsonValue => ({ kk, ru, en });

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
  }[];
}

async function main() {
  const jsonPath = path.join(__dirname, 'math-literacy-seed-data.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath} — run: python3 prisma/scripts/parse_math_sauat_pdfs.py`);
  }
  const banks = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Bank[];

  const ent = await prisma.examType.findUnique({ where: { slug: 'ent' } });
  if (!ent) throw new Error('examType ent not found. Run main prisma/seed.ts first.');

  const subject = await prisma.subject.findUnique({
    where: { examTypeId_slug: { examTypeId: ent.id, slug: 'math_literacy' } },
  });
  if (!subject) throw new Error('subject math_literacy not found.');

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

    const deleted = await prisma.question.deleteMany({ where: { topicId: topic.id } });
    console.log(`Topic ${bank.id}: removed ${deleted.count} old questions`);

    const letters = ['A', 'B', 'C', 'D'] as const;
    for (const q of bank.questions) {
      const answerOptions = letters.map((L, idx) => ({
        content: i(
          q.optionsKk[L] ?? '',
          q.optionsRu[L] ?? '',
          q.optionsRu[L] ?? '',
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
          content: i(q.stemKk, q.stemRu, q.stemRu) as unknown as Prisma.InputJsonValue,
          explanation: i('', '', '') as unknown as Prisma.InputJsonValue,
          answerOptions: { create: answerOptions },
        },
      });
    }
    console.log(`Topic ${bank.id}: inserted ${bank.questions.length} questions`);
  }

  console.log('seed-math-sauat done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
