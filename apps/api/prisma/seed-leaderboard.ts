import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ENT_EXAM_TYPE_ID = 'e7302303-c6f2-482d-a869-0e059190a0b8';

// Реальные КЗ комбинации профильных предметов
const SUBJECTS = {
  MATH_PHYS:  ['119716bd-f979-468a-9136-7dd170b6ec6a', '9b5f040a-30b8-44da-8712-2436a7f26abb'], // Математика + Физика
  MATH_INF:   ['119716bd-f979-468a-9136-7dd170b6ec6a', 'd32dceee-9018-44e9-b00b-f8078a27a1b1'], // Математика + Информатика
  MATH_GEOG:  ['119716bd-f979-468a-9136-7dd170b6ec6a', '8f9ddf95-cf80-4177-bc18-3a0f4cba7d71'], // Математика + География
  BIO_CHEM:   ['2ada7d92-4bc4-495b-8082-26897d078240', '30336d7f-0c2f-4ed2-bfdd-c060caaff561'], // Биология + Химия
  BIO_GEOG:   ['2ada7d92-4bc4-495b-8082-26897d078240', '8f9ddf95-cf80-4177-bc18-3a0f4cba7d71'], // Биология + География
  EN_HIST:    ['74fac274-81ac-4785-83e3-a3e5ada48cbc', '8c337ccf-879a-47d3-b329-458010087be0'],  // Иностранный + Всемирная история
  GEOG_EN:    ['8f9ddf95-cf80-4177-bc18-3a0f4cba7d71', '74fac274-81ac-4785-83e3-a3e5ada48cbc'], // География + Иностранный
  HIST_GEOG:  ['8c337ccf-879a-47d3-b329-458010087be0', '8f9ddf95-cf80-4177-bc18-3a0f4cba7d71'],  // Всемирная история + География
  CHEM_PHYS:  ['30336d7f-0c2f-4ed2-bfdd-c060caaff561', '9b5f040a-30b8-44da-8712-2436a7f26abb'], // Химия + Физика
  CHEM_BIO:   ['30336d7f-0c2f-4ed2-bfdd-c060caaff561', '2ada7d92-4bc4-495b-8082-26897d078240'], // Химия + Биология
};

const users = [
  { firstName: 'Алишер', lastName: 'Нурланов', username: 'alisher_n', rawScore: 135, durationSecs: 5400, subjects: SUBJECTS.MATH_PHYS },
  { firstName: 'Динара', lastName: 'Смирнова', username: 'dinara_s', rawScore: 132, durationSecs: 5700, subjects: SUBJECTS.MATH_INF },
  { firstName: 'Ерлан', lastName: 'Оспанов', username: 'erlan_o', rawScore: 128, durationSecs: 5200, subjects: SUBJECTS.MATH_GEOG },
  { firstName: 'Айгуль', lastName: 'Касымова', username: 'aigul_k', rawScore: 125, durationSecs: 6000, subjects: SUBJECTS.MATH_PHYS },
  { firstName: 'Тимур', lastName: 'Жумабаев', username: 'timur_j', rawScore: 121, durationSecs: 5500, subjects: SUBJECTS.MATH_INF },
  { firstName: 'Зарина', lastName: 'Абилова', username: 'zarina_a', rawScore: 118, durationSecs: 5800, subjects: SUBJECTS.MATH_GEOG },
  { firstName: 'Бекболат', lastName: 'Тулегенов', username: 'bekbolat_t', rawScore: 114, durationSecs: 5900, subjects: SUBJECTS.MATH_PHYS },
  { firstName: 'Молдир', lastName: 'Аскарова', username: 'moldir_a', rawScore: 110, durationSecs: 6100, subjects: SUBJECTS.MATH_INF },
  { firstName: 'Нуржан', lastName: 'Молдашев', username: 'nurzhan_m', rawScore: 107, durationSecs: 6200, subjects: SUBJECTS.MATH_GEOG },
  { firstName: 'Гульназ', lastName: 'Рахимова', username: 'gulnaz_r', rawScore: 104, durationSecs: 6300, subjects: SUBJECTS.MATH_PHYS },
];

async function main() {
  await prisma.testSession.deleteMany({
    where: { user: { telegramUsername: { in: users.map((u) => u.username) } } },
  });
  await prisma.user.deleteMany({
    where: { telegramUsername: { in: users.map((u) => u.username) } },
  });
  console.log('Cleared existing seed users');

  let baseTelegramId = 900000001;

  for (const u of users) {
    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(baseTelegramId++),
        telegramUsername: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        preferredLanguage: 'ru',
      },
    });

    const score = Number(((u.rawScore / 140) * 100).toFixed(2));
    const finishedAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));

    await prisma.testSession.create({
      data: {
        userId: user.id,
        examTypeId: ENT_EXAM_TYPE_ID,
        status: 'completed',
        language: 'ru',
        totalQuestions: 120,
        rawScore: u.rawScore,
        maxScore: 140,
        score: score,
        durationSecs: u.durationSecs,
        finishedAt: finishedAt,
        metadata: {
          profileSubjectIds: u.subjects,
        },
      },
    });

    console.log(`Created: ${u.firstName} ${u.lastName} — rawScore: ${u.rawScore}, subjects: ${u.subjects.length}`);
  }

  console.log('\nDone! 10 users with varied subject combinations created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
