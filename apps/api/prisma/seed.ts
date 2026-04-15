import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import { QUESTION_METADATA_LOCALE_KEY } from '../src/common/question-locale';

const prisma = new PrismaClient();

type I18n = { kk: string; ru: string; en: string };
const i = (kk: string, ru: string, en: string): Prisma.InputJsonValue => ({ kk, ru, en });

const META_KK = { [QUESTION_METADATA_LOCALE_KEY]: 'kk' } as Prisma.InputJsonValue;
const META_RU = { [QUESTION_METADATA_LOCALE_KEY]: 'ru' } as Prisma.InputJsonValue;

interface QDef {
  kk: string; ru: string; en: string;
  explKk: string; explRu: string; explEn: string;
  difficulty: number;
  answers: { kk: string; ru: string; en: string; correct: boolean }[];
}

async function seedQ(
  q: QDef, topicId: string, subjectId: string, examTypeId: string,
) {
  await prisma.question.create({
    data: {
      topicId, subjectId, examTypeId,
      difficulty: q.difficulty,
      type: 'single_choice',
      content: i(q.kk, '', '') as any,
      explanation: i(q.explKk, '', '') as any,
      metadata: META_KK,
      answerOptions: {
        create: q.answers.map((a, idx) => ({
          content: i(a.kk, '', '') as any,
          isCorrect: a.correct,
          sortOrder: idx,
        })),
      },
    },
  });
  await prisma.question.create({
    data: {
      topicId, subjectId, examTypeId,
      difficulty: q.difficulty,
      type: 'single_choice',
      content: i('', q.ru, q.ru) as any,
      explanation: i('', q.explRu, q.explRu) as any,
      metadata: META_RU,
      answerOptions: {
        create: q.answers.map((a, idx) => ({
          content: i('', a.ru, a.ru) as any,
          isCorrect: a.correct,
          sortOrder: idx,
        })),
      },
    },
  });
}

// ─── Question bank helpers ──────────────────────────────
function mathQ(text: string, expl: string, d: number, correct: string, w1: string, w2: string, w3: string): QDef {
  return {
    kk: text, ru: text, en: text,
    explKk: expl, explRu: expl, explEn: expl,
    difficulty: d,
    answers: [
      { kk: correct, ru: correct, en: correct, correct: true },
      { kk: w1, ru: w1, en: w1, correct: false },
      { kk: w2, ru: w2, en: w2, correct: false },
      { kk: w3, ru: w3, en: w3, correct: false },
    ],
  };
}

function triQ(
  kk: string, ru: string, en: string,
  ekk: string, eru: string, een: string,
  d: number,
  ans: { kk: string; ru: string; en: string; correct: boolean }[],
): QDef {
  return { kk, ru, en, explKk: ekk, explRu: eru, explEn: een, difficulty: d, answers: ans };
}

function ta(kk: string, ru: string, en: string, c = false) {
  return { kk, ru, en, correct: c };
}

async function main() {
  console.log('Seeding database...\n');

  await prisma.testAnswer.deleteMany();
  await prisma.testSession.deleteMany();
  await prisma.testTemplateSection.deleteMany();
  await prisma.testTemplate.deleteMany();
  await prisma.answerOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.examType.deleteMany();

  /* ── EXAM TYPES ── */
  const ent = await prisma.examType.create({ data: {
    slug: 'ent',
    name: i('ЕНТ', 'ЕНТ', 'UNT'),
    description: i('Ұлттық бірыңғай тестілеу', 'Единое национальное тестирование', 'Unified National Testing'),
  }});
  const nuet = await prisma.examType.create({ data: {
    slug: 'nuet',
    name: i('NUET', 'НУФИПЕТ', 'NUET'),
    description: i('Назарбаев Университетіне түсу емтиханы', 'Вступительный экзамен в Назарбаев Университет', 'Nazarbayev University Entrance Test'),
  }});
  const nis = await prisma.examType.create({ data: {
    slug: 'nis',
    name: i('НИШ', 'НИШ', 'NIS'),
    description: i('Назарбаев Зияткерлік мектептеріне түсу', 'Поступление в Назарбаев Интеллектуальные школы', 'Nazarbayev Intellectual Schools entrance'),
  }});
  const ktl = await prisma.examType.create({ data: {
    slug: 'ktl',
    name: i('ҚТЛ', 'КТЛ', 'KTL'),
    description: i('Қазақ-түрік лицейіне түсу', 'Поступление в Казахско-Турецкий лицей', 'Kazakh-Turkish Lyceum entrance'),
  }});
  const pm = await prisma.examType.create({ data: {
    slug: 'physmath',
    name: i('ФизМат', 'ФизМат', 'PhysMath'),
    description: i('Физика-математика мектептеріне түсу', 'Поступление в физико-математические школы', 'Physics-Mathematics school entrance'),
  }});
  console.log('Exam types done');

  /* ── SUBJECTS ── */
  const sub = async (etId: string, slug: string, kk: string, ru: string, en: string, mand: boolean, ord: number) =>
    prisma.subject.create({ data: { examTypeId: etId, slug, name: i(kk, ru, en), isMandatory: mand, sortOrder: ord } });

  // ENT
  const sML = await sub(ent.id, 'math_literacy', 'Математикалық сауаттылық', 'Математическая грамотность', 'Mathematical Literacy', true, 1);
  const sRL = await sub(ent.id, 'reading_literacy', 'Оқу сауаттылығы', 'Грамотность чтения', 'Reading Literacy', true, 2);
  const sHK = await sub(ent.id, 'history_kz', 'Қазақстан тарихы', 'История Казахстана', 'History of Kazakhstan', true, 3);
  const sMath = await sub(ent.id, 'math', 'Математика', 'Математика', 'Mathematics', false, 4);
  const sPhys = await sub(ent.id, 'physics', 'Физика', 'Физика', 'Physics', false, 5);
  const sChem = await sub(ent.id, 'chemistry', 'Химия', 'Химия', 'Chemistry', false, 6);
  const sBio = await sub(ent.id, 'biology', 'Биология', 'Биология', 'Biology', false, 7);
  const sGeo = await sub(ent.id, 'geography', 'География', 'География', 'Geography', false, 8);
  const sWH = await sub(ent.id, 'world_history', 'Дүниежүзі тарихы', 'Всемирная история', 'World History', false, 9);
  const sEng = await sub(ent.id, 'english', 'Ағылшын тілі', 'Английский язык', 'English Language', false, 10);
  const sKzL = await sub(ent.id, 'kazakh_lang', 'Қазақ тілі', 'Казахский язык', 'Kazakh Language', false, 11);
  const sRuL = await sub(ent.id, 'russian_lang', 'Орыс тілі', 'Русский язык', 'Russian Language', false, 12);
  const sInf = await sub(ent.id, 'informatics', 'Информатика', 'Информатика', 'Computer Science', false, 13);

  // NUET
  const nMath = await sub(nuet.id, 'math', 'Математика', 'Математика', 'Mathematics', true, 1);
  const nCrit = await sub(nuet.id, 'critical_thinking', 'Сыни ойлау', 'Критическое мышление', 'Critical Thinking', true, 2);
  const nAcad = await sub(nuet.id, 'academic_aptitude', 'Академиялық қабілет', 'Академические способности', 'Academic Aptitude', true, 3);

  // NIS
  const nisMath = await sub(nis.id, 'math', 'Математика', 'Математика', 'Mathematics', true, 1);
  const nisKz = await sub(nis.id, 'kazakh_lang', 'Қазақ тілі', 'Казахский язык', 'Kazakh Language', true, 2);
  const nisRu = await sub(nis.id, 'russian_lang', 'Орыс тілі', 'Русский язык', 'Russian Language', true, 3);
  const nisEn = await sub(nis.id, 'english', 'Ағылшын тілі', 'Английский язык', 'English Language', true, 4);
  const nisLog = await sub(nis.id, 'logic', 'Логика', 'Логика', 'Logic', true, 5);

  // KTL
  const ktlMath = await sub(ktl.id, 'math', 'Математика', 'Математика', 'Mathematics', true, 1);
  const ktlKz = await sub(ktl.id, 'kazakh_lang', 'Қазақ тілі', 'Казахский язык', 'Kazakh Language', true, 2);
  const ktlSci = await sub(ktl.id, 'science', 'Жаратылыстану', 'Естествознание', 'Science', true, 3);
  const ktlLog = await sub(ktl.id, 'logic', 'Логика', 'Логика', 'Logic', true, 4);

  // PhysMath
  const pmMath = await sub(pm.id, 'math', 'Математика', 'Математика', 'Mathematics', true, 1);
  const pmPhys = await sub(pm.id, 'physics', 'Физика', 'Физика', 'Physics', true, 2);
  const pmLog = await sub(pm.id, 'logic', 'Логика', 'Логика', 'Logic', true, 3);

  console.log('Subjects done');

  /* ── TOPICS ── */
  const topic = async (sId: string, kk: string, ru: string, en: string, ord: number) =>
    prisma.topic.create({ data: { subjectId: sId, name: i(kk, ru, en), sortOrder: ord } });

  // ENT Math Literacy
  const mlArith = await topic(sML.id, 'Арифметика', 'Арифметика', 'Arithmetic', 1);
  const mlPct = await topic(sML.id, 'Пайыз', 'Проценты', 'Percentages', 2);
  const mlRatio = await topic(sML.id, 'Қатынас', 'Пропорции', 'Proportions', 3);
  const mlFin = await topic(sML.id, 'Қаржылық сауаттылық', 'Финансовая грамотность', 'Financial Literacy', 4);
  const mlGraph = await topic(sML.id, 'Диаграммалар', 'Диаграммы', 'Charts', 5);

  // ENT Reading Literacy — полный банк: prisma/seed-reading-sauat.ts; здесь тема для top-up
  const rlPassage = await topic(sRL.id, 'Мәтін', 'Текст для чтения', 'Reading passage', 1);

  // ENT History KZ
  const hAnc = await topic(sHK.id, 'Ежелгі дәуір', 'Древний период', 'Ancient Period', 1);
  const hMed = await topic(sHK.id, 'Орта ғасырлар', 'Средневековье', 'Medieval Period', 2);
  const hMod = await topic(sHK.id, 'Жаңа заман', 'Новое время', 'Modern Period', 3);
  const hInd = await topic(sHK.id, 'Тәуелсіздік', 'Независимость', 'Independence', 4);

  // ENT Math (profile)
  const mAlg = await topic(sMath.id, 'Алгебра', 'Алгебра', 'Algebra', 1);
  const mGeom = await topic(sMath.id, 'Геометрия', 'Геометрия', 'Geometry', 2);
  const mEq = await topic(sMath.id, 'Теңдеулер', 'Уравнения', 'Equations', 3);
  const mFunc = await topic(sMath.id, 'Функциялар', 'Функции', 'Functions', 4);
  const mProb = await topic(sMath.id, 'Ықтималдық', 'Вероятность', 'Probability', 5);

  // ENT Physics
  const pMech = await topic(sPhys.id, 'Механика', 'Механика', 'Mechanics', 1);
  const pTherm = await topic(sPhys.id, 'Термодинамика', 'Термодинамика', 'Thermodynamics', 2);
  const pElec = await topic(sPhys.id, 'Электр', 'Электричество', 'Electricity', 3);
  const pOpt = await topic(sPhys.id, 'Оптика', 'Оптика', 'Optics', 4);

  // ENT Chemistry
  const cGen = await topic(sChem.id, 'Жалпы химия', 'Общая химия', 'General Chemistry', 1);
  const cOrg = await topic(sChem.id, 'Органикалық химия', 'Органическая химия', 'Organic Chemistry', 2);

  // ENT Biology
  const bCell = await topic(sBio.id, 'Жасуша биологиясы', 'Клеточная биология', 'Cell Biology', 1);
  const bGen = await topic(sBio.id, 'Генетика', 'Генетика', 'Genetics', 2);

  // ENT Geography
  const gPhys = await topic(sGeo.id, 'Физикалық география', 'Физическая география', 'Physical Geography', 1);
  const gKz = await topic(sGeo.id, 'Қазақстан географиясы', 'География Казахстана', 'Geography of KZ', 2);

  // ENT World History
  const whAnc = await topic(sWH.id, 'Ежелгі дүние', 'Древний мир', 'Ancient World', 1);
  const whMod = await topic(sWH.id, 'Жаңа және қазіргі заман', 'Новое и новейшее время', 'Modern History', 2);

  // ENT English
  const eGr = await topic(sEng.id, 'Грамматика', 'Грамматика', 'Grammar', 1);
  const eVoc = await topic(sEng.id, 'Лексика', 'Лексика', 'Vocabulary', 2);

  // ENT Kazakh
  const kGr = await topic(sKzL.id, 'Грамматика', 'Грамматика', 'Grammar', 1);
  const kLex = await topic(sKzL.id, 'Лексика', 'Лексика', 'Vocabulary', 2);

  // ENT Russian
  const rGr = await topic(sRuL.id, 'Грамматика', 'Грамматика', 'Grammar', 1);
  const rLex = await topic(sRuL.id, 'Лексика', 'Лексика', 'Vocabulary', 2);

  // ENT Informatics
  const iAlg = await topic(sInf.id, 'Алгоритмдер', 'Алгоритмы', 'Algorithms', 1);
  const iProg = await topic(sInf.id, 'Программалау', 'Программирование', 'Programming', 2);

  // NUET
  const nuAlg = await topic(nMath.id, 'Алгебра', 'Алгебра', 'Algebra', 1);
  const nuGeom = await topic(nMath.id, 'Геометрия', 'Геометрия', 'Geometry', 2);
  const nuCrLog = await topic(nCrit.id, 'Логика', 'Логика', 'Logic', 1);
  const nuCrAn = await topic(nCrit.id, 'Талдау', 'Анализ', 'Analysis', 2);
  const nuAcV = await topic(nAcad.id, 'Вербалды', 'Вербальная часть', 'Verbal', 1);
  const nuAcQ = await topic(nAcad.id, 'Сандық', 'Количественная часть', 'Quantitative', 2);

  // NIS
  const nisMA = await topic(nisMath.id, 'Арифметика', 'Арифметика', 'Arithmetic', 1);
  const nisML = await topic(nisMath.id, 'Логикалық есептер', 'Логические задачи', 'Logic Problems', 2);
  const nisKzT = await topic(nisKz.id, 'Грамматика', 'Грамматика', 'Grammar', 1);
  const nisRuT = await topic(nisRu.id, 'Грамматика', 'Грамматика', 'Grammar', 1);
  const nisEnT = await topic(nisEn.id, 'Grammar', 'Грамматика', 'Grammar', 1);
  const nisLogT = await topic(nisLog.id, 'Логикалық тапсырмалар', 'Логические задания', 'Logic Tasks', 1);

  // KTL
  const ktlMA = await topic(ktlMath.id, 'Арифметика', 'Арифметика', 'Arithmetic', 1);
  const ktlKzT = await topic(ktlKz.id, 'Грамматика', 'Грамматика', 'Grammar', 1);
  const ktlSciT = await topic(ktlSci.id, 'Жаратылыстану', 'Естествознание', 'Science', 1);
  const ktlLogT = await topic(ktlLog.id, 'Логика', 'Логика', 'Logic', 1);

  // PhysMath
  const pmMA = await topic(pmMath.id, 'Алгебра', 'Алгебра', 'Algebra', 1);
  const pmPM = await topic(pmPhys.id, 'Механика', 'Механика', 'Mechanics', 1);
  const pmLogT = await topic(pmLog.id, 'Логика', 'Логика', 'Logic', 1);

  console.log('Topics done');

  /* ════════════════════════════════════════════════════════════
     QUESTIONS — real trilingual content
     ════════════════════════════════════════════════════════════ */

  // ── Math Literacy (15Q) ──
  const mlQs: [string, QDef][] = [
    [mlArith.id, mathQ('$\\frac{2}{3} + \\frac{3}{4} = ?$', '$\\frac{8}{12} + \\frac{9}{12} = \\frac{17}{12}$', 1, '$\\frac{17}{12}$', '$\\frac{5}{7}$', '$\\frac{5}{12}$', '$\\frac{6}{7}$')],
    [mlArith.id, mathQ('$(-3)^2 + 4 \\cdot (-2) = ?$', '$9 + (-8) = 1$', 2, '1', '17', '-1', '-17')],
    [mlArith.id, mathQ('$\\sqrt{144} - \\sqrt{49} = ?$', '$12 - 7 = 5$', 1, '5', '7', '$\\sqrt{95}$', '19')],
    [mlArith.id, mathQ('$0{,}125$ жай бөлшек түрінде / в виде дроби', '$0{,}125 = \\frac{1}{8}$', 1, '$\\frac{1}{8}$', '$\\frac{1}{4}$', '$\\frac{1}{5}$', '$\\frac{1}{6}$')],
    [mlArith.id, mathQ('$2^{10} = ?$', '$2^{10} = 1024$', 2, '1024', '512', '2048', '256')],
    [mlPct.id, triQ(
      'Тауардың бағасы 5000 тг. 20% жеңілдік. Бағасы қанша?',
      'Цена товара 5000 тг. Скидка 20%. Какова цена?',
      'Price is 5000. 20% discount. What is the price?',
      '$5000 \\cdot 0{,}80 = 4000$', '$5000 \\cdot 0{,}80 = 4000$', '$5000 \\times 0.80 = 4000$', 1,
      [ta('4000 тг', '4000 тг', '4000', true), ta('4500 тг', '4500 тг', '4500'), ta('3500 тг', '3500 тг', '3500'), ta('1000 тг', '1000 тг', '1000')],
    )],
    [mlPct.id, triQ(
      'Айлық 250 000 тг, +12%. Жаңа айлық?',
      'Зарплата 250 000 тг, +12%. Новая зарплата?',
      'Salary 250,000, +12%. New salary?',
      '$250000 \\cdot 1{,}12 = 280000$', '$250000 \\cdot 1{,}12 = 280000$', '$250000 \\times 1.12 = 280000$', 2,
      [ta('280 000', '280 000', '280,000', true), ta('262 000', '262 000', '262,000'), ta('300 000', '300 000', '300,000'), ta('275 000', '275 000', '275,000')],
    )],
    [mlPct.id, triQ(
      '40 оқушының 15-і қыз. Қыздар — қанша %?',
      'Из 40 учеников 15 девочек. Сколько %?',
      '15 out of 40 are girls. What %?',
      '$15/40 \\cdot 100 = 37{,}5\\%$', '$15/40 \\cdot 100 = 37{,}5\\%$', '$15/40 \\times 100 = 37.5\\%$', 2,
      [ta('37,5%', '37,5%', '37.5%', true), ta('35%', '35%', '35%'), ta('40%', '40%', '40%'), ta('25%', '25%', '25%')],
    )],
    [mlRatio.id, triQ(
      'Екі санның қатынасы 3:5. Қосындысы 64. Үлкен санды табыңыз.',
      'Отношение двух чисел 3:5. Сумма 64. Найдите большее.',
      'Ratio of two numbers is 3:5. Sum is 64. Find the larger.',
      '$8x=64, x=8, 5 \\cdot 8 = 40$', '$8x=64, x=8, 5 \\cdot 8 = 40$', '$8x=64, x=8, 5 \\times 8 = 40$', 2,
      [ta('40', '40', '40', true), ta('24', '24', '24'), ta('32', '32', '32'), ta('36', '36', '36')],
    )],
    [mlRatio.id, triQ(
      'Автокөлік 3 сағ-та 210 км жүрді. 5 сағатта?',
      'Машина проехала 210 км за 3 ч. За 5 часов?',
      'Car traveled 210 km in 3 h. In 5 hours?',
      '$210/3=70, 70 \\cdot 5 = 350$', '$210/3=70, 70 \\cdot 5 = 350$', '$210/3=70, 70 \\times 5 = 350$', 1,
      [ta('350 км', '350 км', '350 km', true), ta('300 км', '300 км', '300 km'), ta('420 км', '420 км', '420 km'), ta('280 км', '280 км', '280 km')],
    )],
    [mlFin.id, triQ(
      '500 000 тг, 10% жылдық, 2 жыл. Жай пайыз — сома?',
      '500 000 тг под 10% на 2 года. Простые проценты — итого?',
      '500,000 at 10% for 2 years. Simple interest — total?',
      '$500000 \\cdot 1{,}2 = 600000$', '$500000 \\cdot 1{,}2 = 600000$', '$500000 \\times 1.2 = 600000$', 3,
      [ta('600 000', '600 000', '600,000', true), ta('550 000', '550 000', '550,000'), ta('605 000', '605 000', '605,000'), ta('620 000', '620 000', '620,000')],
    )],
    [mlFin.id, triQ(
      'Несие 1 000 000 тг, 15% жылдық, 1 жыл. Артық төлем?',
      'Кредит 1 000 000 тг, 15% годовых, 1 год. Переплата?',
      'Loan 1,000,000, 15% annual, 1 year. Overpayment?',
      '$1000000 \\cdot 0{,}15 = 150000$', '$1000000 \\cdot 0{,}15 = 150000$', '$1000000 \\times 0.15 = 150000$', 2,
      [ta('150 000', '150 000', '150,000', true), ta('100 000', '100 000', '100,000'), ta('200 000', '200 000', '200,000'), ta('115 000', '115 000', '115,000')],
    )],
    [mlGraph.id, triQ(
      'А: 25%, Б: 35%, В: 40%. Жалпы 2 000 000. Б-ның табысы?',
      'А: 25%, Б: 35%, В: 40%. Всего 2 000 000. Выручка Б?',
      'A: 25%, B: 35%, C: 40%. Total 2,000,000. B revenue?',
      '$2000000 \\cdot 0{,}35 = 700000$', '$2000000 \\cdot 0{,}35 = 700000$', '$2000000 \\times 0.35 = 700000$', 2,
      [ta('700 000', '700 000', '700,000', true), ta('500 000', '500 000', '500,000'), ta('800 000', '800 000', '800,000'), ta('350 000', '350 000', '350,000')],
    )],
    [mlArith.id, mathQ('$\\frac{7}{8} - \\frac{3}{8} = ?$', '$\\frac{7-3}{8} = \\frac{4}{8} = \\frac{1}{2}$', 1, '$\\frac{1}{2}$', '$\\frac{4}{16}$', '$\\frac{10}{8}$', '$\\frac{3}{4}$')],
    [mlPct.id, triQ(
      'Бағасы 8000 тг тауар 25% қымбаттады. Жаңа бағасы?',
      'Товар стоил 8000 тг и подорожал на 25%. Новая цена?',
      'Price was 8000, increased by 25%. New price?',
      '$8000 \\cdot 1{,}25 = 10000$', '$8000 \\cdot 1{,}25 = 10000$', '$8000 \\times 1.25 = 10000$', 2,
      [ta('10 000', '10 000', '10,000', true), ta('10 250', '10 250', '10,250'), ta('9 000', '9 000', '9,000'), ta('8 250', '8 250', '8,250')],
    )],
  ];
  for (const [tid, q] of mlQs) await seedQ(q, tid, sML.id, ent.id);
  console.log(`  Math Literacy: ${mlQs.length}`);

  // ── History KZ (12Q) ──
  const hQs: [string, QDef][] = [
    [hMed.id, triQ('Қазақ хандығы қай жылы құрылды?','В каком году основано Казахское ханство?','When was the Kazakh Khanate founded?','1465 жылы Керей мен Жәнібек','В 1465 году ханами Кереем и Жанибеком','In 1465 by Kerey and Zhanibek',1,
      [ta('1465','1465','1465',true),ta('1370','1370','1370'),ta('1520','1520','1520'),ta('1428','1428','1428')])],
    [hInd.id, triQ('Тәуелсіздік қашан жарияланды?','Когда провозглашена независимость?','When was independence declared?','16 желтоқсан 1991 жыл','16 декабря 1991 года','December 16, 1991',1,
      [ta('16.12.1991','16.12.1991','Dec 16, 1991',true),ta('25.10.1990','25.10.1990','Oct 25, 1990'),ta('01.12.1991','01.12.1991','Dec 1, 1991'),ta('30.08.1995','30.08.1995','Aug 30, 1995')])],
    [hMed.id, triQ('Қасым хан қай жылдары билік құрды?','Годы правления хана Касыма?','When did Khan Kasym rule?','1511–1521 жж.','1511–1521 гг.','1511–1521',2,
      [ta('1511–1521','1511–1521','1511–1521',true),ta('1465–1480','1465–1480','1465–1480'),ta('1538–1580','1538–1580','1538–1580'),ta('1480–1511','1480–1511','1480–1511')])],
    [hMed.id, triQ('Абылай хан қай жүздің ханы?','Ханом какого жуза был Абылай?','Khan of which zhuz was Abylai?','Орта жүз','Средний жуз','Middle Zhuz',2,
      [ta('Орта жүз','Средний жуз','Middle Zhuz',true),ta('Ұлы жүз','Старший жуз','Senior Zhuz'),ta('Кіші жүз','Младший жуз','Junior Zhuz'),ta('Барлық','Всех трёх','All three')])],
    [hInd.id, triQ('Астана қай жылы жаңа астана болды?','Когда Астана стала столицей?','When did Astana become the capital?','1997 жылы','В 1997 году','In 1997',1,
      [ta('1997','1997','1997',true),ta('1995','1995','1995'),ta('1999','1999','1999'),ta('2000','2000','2000')])],
    [hMod.id, triQ('1986 жылғы Желтоқсан оқиғасы қай қалада?','Где произошли события декабря 1986?','Where did December 1986 events occur?','Алматы','Алма-Ата','Alma-Ata',1,
      [ta('Алматы','Алма-Ата','Alma-Ata',true),ta('Астана','Астана','Astana'),ta('Шымкент','Шымкент','Shymkent'),ta('Қарағанды','Караганда','Karaganda')])],
    [hMed.id, triQ('Тоқтамыс хан қай мемлекеттің ханы болды?','Ханом какого государства был Тохтамыш?','Which state did Tokhtamysh rule?','Алтын Орда','Золотая Орда','Golden Horde',2,
      [ta('Алтын Орда','Золотая Орда','Golden Horde',true),ta('Қазақ хандығы','Казахское ханство','Kazakh Khanate'),ta('Ноғай Ордасы','Ногайская Орда','Nogai Horde'),ta('Моғол империясы','Монгольская империя','Mongol Empire')])],
    [hAnc.id, triQ('Сақтар қай ғасырда өмір сүрді?','В каком веке жили саки?','In what century did the Sakas live?','б.з.б. VII–III ғ.','VII–III вв. до н.э.','7th–3rd c. BCE',2,
      [ta('б.з.б. VII–III ғ.','VII–III вв. до н.э.','7th–3rd c. BCE',true),ta('б.з.б. I–III ғ.','I–III вв. до н.э.','1st–3rd c. BCE'),ta('б.з. I–V ғ.','I–V вв. н.э.','1st–5th c. CE'),ta('б.з.б. X–VII ғ.','X–VII вв. до н.э.','10th–7th c. BCE')])],
    [hAnc.id, triQ('\"Алтын адам\" қай жерден табылды?','Где был найден \"Золотой человек\"?','Where was the "Golden Man" found?','Есік қорғаны','Курган Иссык','Issyk Kurgan',1,
      [ta('Есік','Иссык','Issyk',true),ta('Берел','Берел','Berel'),ta('Тараз','Тараз','Taraz'),ta('Отырар','Отрар','Otrar')])],
    [hInd.id, triQ('Қазақстан Конституциясы қай жылы қабылданды?','Когда принята Конституция РК?','When was the Constitution of RK adopted?','1995 жылы 30 тамызда','30 августа 1995 года','August 30, 1995',1,
      [ta('1995','1995','1995',true),ta('1991','1991','1991'),ta('1993','1993','1993'),ta('1997','1997','1997')])],
    [hMod.id, triQ('Кенесары Қасымов көтерілісі қай жылдары болды?','Годы восстания Кенесары Касымова?','Years of Kenesary Kasymov uprising?','1837–1847','1837–1847','1837–1847',3,
      [ta('1837–1847','1837–1847','1837–1847',true),ta('1824–1835','1824–1835','1824–1835'),ta('1850–1860','1850–1860','1850–1860'),ta('1916–1917','1916–1917','1916–1917')])],
    [hMod.id, triQ('Алаш Орда партиясы қашан құрылды?','Когда была создана партия Алаш?','When was the Alash party founded?','1917 жылы','В 1917 году','In 1917',2,
      [ta('1917','1917','1917',true),ta('1905','1905','1905'),ta('1920','1920','1920'),ta('1913','1913','1913')])],
  ];
  for (const [tid, q] of hQs) await seedQ(q, tid, sHK.id, ent.id);
  console.log(`  History KZ: ${hQs.length}`);

  // ── Math profile (15Q) ──
  const mathQs: [string, QDef][] = [
    [mAlg.id, mathQ('$(3+2)^2 = ?$', '$(3+2)^2 = 25$', 1, '25', '13', '10', '36')],
    [mAlg.id, mathQ('$\\log_2 8 = ?$', '$2^3=8$, $\\log_2 8=3$', 2, '3', '2', '4', '8')],
    [mEq.id, mathQ('$2x + 5 = 17$, $x = ?$', '$2x=12$, $x=6$', 1, '6', '7', '11', '5')],
    [mEq.id, mathQ('$x^2 - 5x + 6 = 0$', '$D=1$, $x_1=2$, $x_2=3$', 2, '2 и 3', '1 и 6', '-2 и -3', '5 и 1')],
    [mGeom.id, mathQ('$S = \\pi r^2$, $r=5$', '$S = 25\\pi$', 2, '$25\\pi$', '$10\\pi$', '$50\\pi$', '$5\\pi$')],
    [mGeom.id, mathQ('Катеты 6 и 8. Гипотенуза?', '$c=\\sqrt{36+64}=10$', 2, '10', '14', '12', '$\\sqrt{48}$')],
    [mFunc.id, mathQ('$f(x)=3x^2-2x+1$, $f(2)=?$', '$12-4+1=9$', 2, '9', '7', '11', '13')],
    [mFunc.id, mathQ('$y=x^2-4$, нули?', '$x=\\pm 2$', 2, '$\\pm 2$', '$\\pm 4$', '0', '2')],
    [mProb.id, mathQ('3 красных, 5 синих. P(красный)?', '$3/8$', 2, '$3/8$', '$5/8$', '$3/5$', '$1/3$')],
    [mAlg.id, mathQ('$a_1=3$, $d=4$. $a_{10}=?$', '$3+9 \\cdot 4=39$', 2, '39', '43', '40', '36')],
    [mAlg.id, mathQ('$\\sin 30° + \\cos 60° = ?$', '$0{,}5 + 0{,}5 = 1$', 2, '1', '0,5', '$\\sqrt{3}$', '0')],
    [mEq.id, mathQ('$3^x = 81$, $x=?$', '$81=3^4$, $x=4$', 2, '4', '3', '27', '5')],
    [mGeom.id, mathQ('$V$ куба с ребром 4?', '$V=64$', 1, '64', '48', '16', '24')],
    [mAlg.id, mathQ('$\\lim_{n\\to\\infty}\\frac{3n+1}{n+2}=?$', 'Делим на n: 3', 3, '3', '1', '$\\infty$', '0')],
    [mFunc.id, mathQ('$(x^3)\\prime = ?$', '$3x^2$', 2, '$3x^2$', '$x^2$', '$3x^3$', '$2x^3$')],
  ];
  for (const [tid, q] of mathQs) await seedQ(q, tid, sMath.id, ent.id);
  console.log(`  Math: ${mathQs.length}`);

  // ── Physics (12Q) ──
  const phQs: [string, QDef][] = [
    [pMech.id, triQ('$m=2$ кг, $F=10$ Н. $a=?$','$m=2$ кг, $F=10$ Н. $a=?$','$m=2$ kg, $F=10$ N. $a=?$','$a=F/m=5$','$a=F/m=5$','$a=F/m=5$',1,
      [ta('5 м/с²','5 м/с²','5 m/s²',true),ta('20 м/с²','20 м/с²','20 m/s²'),ta('0,2 м/с²','0,2 м/с²','0.2 m/s²'),ta('12 м/с²','12 м/с²','12 m/s²')])],
    [pMech.id, mathQ('$v_0=20$ м/с вверх. $t$ до верхней точки? ($g=10$)', '$t=v_0/g=2$ с', 2, '2 с', '4 с', '1 с', '0,5 с')],
    [pMech.id, mathQ('$m=5$ кг, $h=10$ м. $E_k$ при ударе? ($g=10$)', '$E=mgh=500$ Дж', 2, '500 Дж', '250 Дж', '100 Дж', '50 Дж')],
    [pTherm.id, mathQ('$m=2$ кг воды, от 20° до 70°C. $Q=?$ ($c=4200$)', '$Q=4200 \\cdot 2 \\cdot 50=420000$ Дж', 3, '420 кДж', '210 кДж', '840 кДж', '168 кДж')],
    [pElec.id, mathQ('$R=10$ Ом, $U=220$ В. $I=?$', '$I=U/R=22$ А', 1, '22 А', '2200 А', '2,2 А', '0,045 А')],
    [pElec.id, mathQ('$I=5$ А, $U=12$ В. $P=?$', '$P=UI=60$ Вт', 1, '60 Вт', '2,4 Вт', '17 Вт', '600 Вт')],
    [pOpt.id, mathQ('$c=3 \\cdot 10^8$, $n=1{,}5$. $v=?$', '$v=c/n=2 \\cdot 10^8$', 2, '$2 \\cdot 10^8$', '$4{,}5 \\cdot 10^8$', '$1{,}5 \\cdot 10^8$', '$3 \\cdot 10^8$')],
    [pMech.id, mathQ('Свободное падение 3 с. $v=?$ ($g=10$)', '$v=gt=30$', 1, '30 м/с', '45 м/с', '10 м/с', '15 м/с')],
    [pElec.id, mathQ('$R_1=4$ Ом, $R_2=6$ Ом последовательно. $R=?$', '$R=R_1+R_2=10$', 1, '10 Ом', '2,4 Ом', '24 Ом', '1,5 Ом')],
    [pElec.id, mathQ('$R_1=4$ Ом, $R_2=4$ Ом параллельно. $R=?$', '$R=R_1 R_2/(R_1+R_2)=2$', 2, '2 Ом', '8 Ом', '4 Ом', '1 Ом')],
    [pMech.id, mathQ('$m=3$ кг, $v=4$ м/с. Импульс?', '$p=mv=12$', 1, '12 кг·м/с', '7 кг·м/с', '0,75 кг·м/с', '1,3 кг·м/с')],
    [pTherm.id, triQ('Абсолют нөл неше °C?','Абсолютный нуль в °C?','Absolute zero in °C?','$-273{,}15°C$','$-273{,}15°C$','$-273.15°C$',1,
      [ta('-273°C','-273°C','-273°C',true),ta('0°C','0°C','0°C'),ta('-100°C','-100°C','-100°C'),ta('-373°C','-373°C','-373°C')])],
  ];
  for (const [tid, q] of phQs) await seedQ(q, tid, sPhys.id, ent.id);
  console.log(`  Physics: ${phQs.length}`);

  // ── Chemistry (8Q) ──
  const chQs: [string, QDef][] = [
    [cGen.id, triQ('Судың формуласы','Формула воды','Formula of water','$H_2O$','$H_2O$','$H_2O$',1,[ta('$H_2O$','$H_2O$','$H_2O$',true),ta('$CO_2$','$CO_2$','$CO_2$'),ta('$H_2O_2$','$H_2O_2$','$H_2O_2$'),ta('$NaCl$','$NaCl$','$NaCl$')])],
    [cGen.id, triQ('Оттектің реттік нөмірі','Порядковый номер кислорода','Atomic number of oxygen','8','8','8',1,[ta('8','8','8',true),ta('6','6','6'),ta('16','16','16'),ta('7','7','7')])],
    [cGen.id, triQ('pH=7 орта қандай?','Какова среда при pH=7?','What environment at pH=7?','Бейтарап','Нейтральная','Neutral',2,[ta('Бейтарап','Нейтральная','Neutral',true),ta('Қышқылдық','Кислая','Acidic'),ta('Сілтілік','Щелочная','Alkaline'),ta('Белгісіз','Неизвестно','Unknown')])],
    [cOrg.id, triQ('Метанның формуласы','Формула метана','Formula of methane','$CH_4$','$CH_4$','$CH_4$',1,[ta('$CH_4$','$CH_4$','$CH_4$',true),ta('$C_2H_6$','$C_2H_6$','$C_2H_6$'),ta('$C_2H_4$','$C_2H_4$','$C_2H_4$'),ta('$C_6H_6$','$C_6H_6$','$C_6H_6$')])],
    [cGen.id, triQ('NaCl — қандай зат?','NaCl — это?','NaCl is?','Ас тұзы','Поваренная соль','Table salt',1,[ta('Ас тұзы','Поваренная соль','Table salt',true),ta('Ішімдік сода','Пищевая сода','Baking soda'),ta('Күкірт қышқылы','Серная кислота','Sulfuric acid'),ta('Сірке қышқылы','Уксусная кислота','Acetic acid')])],
    [cGen.id, triQ('$Fe$ — қандай элемент?','$Fe$ — какой элемент?','$Fe$ — which element?','Темір','Железо','Iron',1,[ta('Темір','Железо','Iron',true),ta('Фтор','Фтор','Fluorine'),ta('Күміс','Серебро','Silver'),ta('Мыс','Медь','Copper')])],
    [cOrg.id, triQ('Глюкозаның формуласы','Формула глюкозы','Formula of glucose','$C_6H_{12}O_6$','$C_6H_{12}O_6$','$C_6H_{12}O_6$',2,[ta('$C_6H_{12}O_6$','$C_6H_{12}O_6$','$C_6H_{12}O_6$',true),ta('$C_{12}H_{22}O_{11}$','$C_{12}H_{22}O_{11}$','$C_{12}H_{22}O_{11}$'),ta('$CH_3OH$','$CH_3OH$','$CH_3OH$'),ta('$C_2H_5OH$','$C_2H_5OH$','$C_2H_5OH$')])],
    [cGen.id, triQ('Авогадро саны','Число Авогадро','Avogadro number','$6{,}022 \\cdot 10^{23}$','$6{,}022 \\cdot 10^{23}$','$6.022 \\times 10^{23}$',2,[ta('$6 \\cdot 10^{23}$','$6 \\cdot 10^{23}$','$6 \\times 10^{23}$',true),ta('$3 \\cdot 10^{8}$','$3 \\cdot 10^{8}$','$3 \\times 10^{8}$'),ta('$6 \\cdot 10^{26}$','$6 \\cdot 10^{26}$','$6 \\times 10^{26}$'),ta('$1{,}6 \\cdot 10^{-19}$','$1{,}6 \\cdot 10^{-19}$','$1.6 \\times 10^{-19}$')])],
  ];
  for (const [tid, q] of chQs) await seedQ(q, tid, sChem.id, ent.id);
  console.log(`  Chemistry: ${chQs.length}`);

  // ── Biology (6Q) ──
  const bioQs: [string, QDef][] = [
    [bCell.id, triQ('Жасушаның энергия станциясы?','Энергетическая станция клетки?','Powerhouse of the cell?','Митохондрия','Митохондрия','Mitochondria',1,[ta('Митохондрия','Митохондрия','Mitochondria',true),ta('Рибосома','Рибосома','Ribosome'),ta('Ядро','Ядро','Nucleus'),ta('Лизосома','Лизосома','Lysosome')])],
    [bCell.id, triQ('ДНҚ толық атауы','Полное название ДНК','Full name of DNA','Дезоксирибонуклеин қышқылы','Дезоксирибонуклеиновая кислота','Deoxyribonucleic acid',1,[ta('Дезоксирибонуклеин','Дезоксирибонуклеиновая','Deoxyribonucleic',true),ta('Рибонуклеин','Рибонуклеиновая','Ribonucleic'),ta('Аминқышқылы','Аминокислота','Amino acid'),ta('Нуклеотид','Нуклеотид','Nucleotide')])],
    [bCell.id, triQ('Фотосинтез қай органоидта?','Где происходит фотосинтез?','Where does photosynthesis occur?','Хлоропласт','Хлоропласт','Chloroplast',1,[ta('Хлоропласт','Хлоропласт','Chloroplast',true),ta('Митохондрия','Митохондрия','Mitochondria'),ta('Гольджи','Гольджи','Golgi'),ta('ЭПР','ЭПС','ER')])],
    [bGen.id, triQ('Адамның хромосома саны?','Число хромосом у человека?','Number of human chromosomes?','46','46','46',1,[ta('46','46','46',true),ta('23','23','23'),ta('48','48','48'),ta('44','44','44')])],
    [bGen.id, triQ('Генотиптегі Аа — қандай тип?','Генотип Аа — это?','Genotype Aa is?','Гетерозигота','Гетерозигота','Heterozygous',2,[ta('Гетерозигота','Гетерозигота','Heterozygous',true),ta('Гомозигота','Гомозигота','Homozygous'),ta('Гемизигота','Гемизигота','Hemizygous'),ta('Полизигота','Полизигота','Polyzygous')])],
    [bCell.id, triQ('Жасуша бөлінуінің түрі — митоз нәтижесі','Результат митоза','Result of mitosis','2 бірдей жасуша','2 одинаковые клетки','2 identical cells',2,[ta('2 бірдей жасуша','2 одинаковые клетки','2 identical cells',true),ta('4 жасуша','4 клетки','4 cells'),ta('1 жасуша','1 клетка','1 cell'),ta('3 жасуша','3 клетки','3 cells')])],
  ];
  for (const [tid, q] of bioQs) await seedQ(q, tid, sBio.id, ent.id);
  console.log(`  Biology: ${bioQs.length}`);

  // ── Bulk-generate remaining subjects with formulaic questions ──
  async function bulkSeed(subjectId: string, examTypeId: string, topicIds: string[], count: number, prefix: string) {
    for (let n = 0; n < count; n++) {
      const tId = topicIds[n % topicIds.length];
      const d = (n % 5) + 1;
      const correct = n % 4;
      await prisma.question.create({
        data: {
          topicId: tId, subjectId, examTypeId,
          difficulty: d, type: 'single_choice',
          content: i(`${prefix}: ${n + 1}-сұрақ`, '', '') as any,
          explanation: i(`${prefix}: ${n + 1}-түсіндірме`, '', '') as any,
          metadata: META_KK,
          answerOptions: {
            create: [0, 1, 2, 3].map((idx) => ({
              content: i(`${String.fromCharCode(65 + idx)} нұсқасы`, '', '') as any,
              isCorrect: idx === correct,
              sortOrder: idx,
            })),
          },
        },
      });
      await prisma.question.create({
        data: {
          topicId: tId, subjectId, examTypeId,
          difficulty: d, type: 'single_choice',
          content: i('', `${prefix}: Вопрос ${n + 1}`, `${prefix}: Вопрос ${n + 1}`) as any,
          explanation: i('', `${prefix}: Объяснение ${n + 1}`, `${prefix}: Объяснение ${n + 1}`) as any,
          metadata: META_RU,
          answerOptions: {
            create: [0, 1, 2, 3].map((idx) => ({
              content: i('', `Вариант ${String.fromCharCode(65 + idx)}`, `Вариант ${String.fromCharCode(65 + idx)}`) as any,
              isCorrect: idx === correct,
              sortOrder: idx,
            })),
          },
        },
      });
    }
  }

  async function ensureMinQuestions(
    subjectId: string,
    examTypeId: string,
    topicIds: string[],
    minCount: number,
    prefix: string,
  ) {
    const targetRows = minCount * 2;
    const existing = await prisma.question.count({
      where: { subjectId, examTypeId },
    });
    if (existing >= targetRows) return;
    const pairsNeeded = Math.ceil((targetRows - existing) / 2);
    await bulkSeed(subjectId, examTypeId, topicIds, pairsNeeded, `${prefix} (top-up)`);
  }

  // Geography, World History, English, Kazakh, Russian, Informatics + NIS, KTL, NUET extras, PM
  const bulkTargets: [string, string, string[], number, string][] = [
    [sGeo.id, ent.id, [gPhys.id, gKz.id], 25, 'География'],
    [sWH.id, ent.id, [whAnc.id, whMod.id], 25, 'Всемирная история'],
    [sEng.id, ent.id, [eGr.id, eVoc.id], 25, 'English'],
    [sKzL.id, ent.id, [kGr.id, kLex.id], 25, 'Қазақ тілі'],
    [sRuL.id, ent.id, [rGr.id, rLex.id], 25, 'Русский язык'],
    [sInf.id, ent.id, [iAlg.id, iProg.id], 25, 'Информатика'],
    // NUET
    [nMath.id, nuet.id, [nuAlg.id, nuGeom.id], 20, 'NUET Математика'],
    [nCrit.id, nuet.id, [nuCrLog.id, nuCrAn.id], 20, 'NUET Сыни ойлау'],
    [nAcad.id, nuet.id, [nuAcV.id, nuAcQ.id], 20, 'NUET Академиялық'],
    // NIS
    [nisMath.id, nis.id, [nisMA.id, nisML.id], 20, 'НИШ Математика'],
    [nisLog.id, nis.id, [nisLogT.id], 20, 'НИШ Логика'],
    // KTL
    [ktlMath.id, ktl.id, [ktlMA.id], 20, 'КТЛ Математика'],
    [ktlSci.id, ktl.id, [ktlSciT.id], 20, 'КТЛ Жаратылыстану'],
    [ktlLog.id, ktl.id, [ktlLogT.id], 20, 'КТЛ Логика'],
    // PhysMath
    [pmMath.id, pm.id, [pmMA.id], 20, 'ФизМат Математика'],
    [pmPhys.id, pm.id, [pmPM.id], 20, 'ФизМат Физика'],
    [pmLog.id, pm.id, [pmLogT.id], 20, 'ФизМат Логика'],
    // NIS language subjects
    [nisKz.id, nis.id, [nisKzT.id], 20, 'НИШ Қазақ тілі'],
    [nisRu.id, nis.id, [nisRuT.id], 20, 'НИШ Орыс тілі'],
    [nisEn.id, nis.id, [nisEnT.id], 20, 'НИШ English'],
    // KTL Kazakh
    [ktlKz.id, ktl.id, [ktlKzT.id], 20, 'КТЛ Қазақ тілі'],
  ];

  for (const [sId, eId, tIds, cnt, pfx] of bulkTargets) {
    await bulkSeed(sId, eId, tIds, cnt, pfx);
    console.log(`  ${pfx}: ${cnt}`);
  }

  await ensureMinQuestions(sHK.id, ent.id, [hAnc.id, hMed.id, hMod.id, hInd.id], 20, 'ENT Тарих');
  await ensureMinQuestions(sRL.id, ent.id, [rlPassage.id], 10, 'ENT Оқу сауаттылығы');
  await ensureMinQuestions(sML.id, ent.id, [mlArith.id, mlPct.id, mlRatio.id, mlFin.id, mlGraph.id], 10, 'ENT Матсауат');
  // Профиль: по 40 вопросов на предмет в полном ЕНТ
  await ensureMinQuestions(sMath.id, ent.id, [mAlg.id, mGeom.id, mEq.id, mFunc.id, mProb.id], 40, 'ENT Математика');
  await ensureMinQuestions(sPhys.id, ent.id, [pMech.id, pTherm.id, pElec.id, pOpt.id], 40, 'ENT Физика');
  await ensureMinQuestions(sChem.id, ent.id, [cGen.id, cOrg.id], 40, 'ENT Химия');
  await ensureMinQuestions(sBio.id, ent.id, [bCell.id, bGen.id], 40, 'ENT Биология');

  /* ── TEMPLATES ── */
  // ENT — обязательный блок: История 20 + Грамотность чтения 10 + Мат. грамотность 10; профиль +40+40 к сессии
  await prisma.testTemplate.create({
    data: {
      examTypeId: ent.id,
      name: i('ЕНТ пробник', 'ЕНТ пробник', 'UNT Practice'),
      durationMins: 240,
      sections: { create: [
        { subjectId: sHK.id, questionCount: 20, selectionMode: 'random', sortOrder: 1 },
        { subjectId: sRL.id, questionCount: 10, selectionMode: 'random', sortOrder: 2 },
        { subjectId: sML.id, questionCount: 10, selectionMode: 'random', sortOrder: 3 },
      ]},
    },
  });

  await prisma.testTemplate.create({
    data: {
      examTypeId: ent.id,
      name: i('ЕНТ экспресс', 'ЕНТ экспресс', 'UNT Express'),
      durationMins: 45,
      sections: { create: [
        { subjectId: sHK.id, questionCount: 10, selectionMode: 'random', sortOrder: 1 },
        { subjectId: sRL.id, questionCount: 5, selectionMode: 'random', sortOrder: 2 },
        { subjectId: sML.id, questionCount: 5, selectionMode: 'random', sortOrder: 3 },
      ]},
    },
  });

  // NUET
  await prisma.testTemplate.create({
    data: {
      examTypeId: nuet.id,
      name: i('NUET пробник', 'НУФИПЕТ пробник', 'NUET Practice'),
      durationMins: 240,
      sections: { create: [
        { subjectId: nMath.id, questionCount: 10, selectionMode: 'random', sortOrder: 1 },
        { subjectId: nCrit.id, questionCount: 10, selectionMode: 'random', sortOrder: 2 },
        { subjectId: nAcad.id, questionCount: 10, selectionMode: 'random', sortOrder: 3 },
      ]},
    },
  });

  // NIS
  await prisma.testTemplate.create({
    data: {
      examTypeId: nis.id,
      name: i('НИШ пробник', 'НИШ пробник', 'NIS Practice'),
      durationMins: 180,
      sections: { create: [
        { subjectId: nisKz.id, questionCount: 10, selectionMode: 'random', sortOrder: 1 },
        { subjectId: nisMath.id, questionCount: 10, selectionMode: 'random', sortOrder: 2 },
        { subjectId: nisRu.id, questionCount: 10, selectionMode: 'random', sortOrder: 3 },
        { subjectId: nisEn.id, questionCount: 10, selectionMode: 'random', sortOrder: 4 },
        { subjectId: nisLog.id, questionCount: 10, selectionMode: 'random', sortOrder: 5 },
      ]},
    },
  });

  // KTL
  await prisma.testTemplate.create({
    data: {
      examTypeId: ktl.id,
      name: i('ҚТЛ пробник', 'КТЛ пробник', 'KTL Practice'),
      durationMins: 120,
      sections: { create: [
        { subjectId: ktlMath.id, questionCount: 10, selectionMode: 'random', sortOrder: 1 },
        { subjectId: ktlKz.id, questionCount: 10, selectionMode: 'random', sortOrder: 2 },
        { subjectId: ktlSci.id, questionCount: 10, selectionMode: 'random', sortOrder: 3 },
        { subjectId: ktlLog.id, questionCount: 10, selectionMode: 'random', sortOrder: 4 },
      ]},
    },
  });

  // PhysMath
  await prisma.testTemplate.create({
    data: {
      examTypeId: pm.id,
      name: i('ФизМат пробник', 'ФизМат пробник', 'PhysMath Practice'),
      durationMins: 150,
      sections: { create: [
        { subjectId: pmMath.id, questionCount: 10, selectionMode: 'random', sortOrder: 1 },
        { subjectId: pmPhys.id, questionCount: 10, selectionMode: 'random', sortOrder: 2 },
        { subjectId: pmLog.id, questionCount: 10, selectionMode: 'random', sortOrder: 3 },
      ]},
    },
  });

  console.log('Templates done');

  const grantJson = path.join(__dirname, 'data', 'grant-admission', 'grant-admission-seed-data.json');
  if (fs.existsSync(grantJson)) {
    const { seedGrantAdmission } = await import('./seed-grant-admission');
    await seedGrantAdmission(prisma);
    console.log('Grant admission data seeded');
  }

  /* ── Summary ── */
  const [qCount, aCount, tCount, tmplCount, secCount] = await Promise.all([
    prisma.question.count(),
    prisma.answerOption.count(),
    prisma.topic.count(),
    prisma.testTemplate.count(),
    prisma.testTemplateSection.count(),
  ]);
  console.log(`\nSeed complete!`);
  console.log(`  ${qCount} questions, ${aCount} answer options`);
  console.log(`  ${tCount} topics, ${tmplCount} templates, ${secCount} sections`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
