/**
 * Prompt builders for the AI mistakes coach.
 * The model is instructed to reply STRICTLY in the requested language and to emit
 * a single JSON object matching the documented schema. The server validates and
 * sanitizes the output (e.g. drops unknown ids) before returning it to the client.
 */

export type AiLanguage = 'ru' | 'kk';

export interface PromptMistake {
  /** Stable index the model echoes back (0-based). */
  ref: number;
  questionId: string;
  subjectId: string;
  subject: string;
  topic: string;
  difficulty: number;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  timeSpentSecs: number | null;
}

export interface PromptSubject {
  subjectId: string;
  subject: string;
  openCount: number;
  /** ENT scoring weight hint (max points the subject contributes). */
  maxScore: number;
}

export interface PromptLessonQuestion {
  ref: number;
  difficulty: number;
  question: string;
  correctAnswer: string;
  explanation: string;
}

const LANG_NAME: Record<AiLanguage, string> = {
  ru: 'русском',
  kk: 'казахском (қазақ тілінде)',
};

// ─── Weak-zone analysis ──────────────────────────────────────────────────────

export function weakZoneSystemPrompt(language: AiLanguage): string {
  return [
    'Ты — опытный персональный репетитор по подготовке к ЕНТ (Единое национальное тестирование, Казахстан).',
    'Твоя задача — проанализировать реальные ошибки ученика и дать конкретный, действенный разбор слабых зон, а не общие фразы.',
    'Опирайся ТОЛЬКО на предоставленные данные об ошибках. Не выдумывай вопросы, которых нет.',
    'Группируй ошибки в слабые зоны по конкретным темам/концептам (например, не «алгебра», а «квадратные уравнения: дискриминант»).',
    'Для каждой зоны определи КОРНЕВУЮ причину (что именно ученик не понимает, какую типичную ошибку допускает), а не просто «нужно повторить».',
    'Учитывай вес предметов в ЕНТ: профильные предметы дают до 50 баллов каждый, история Казахстана — 20, грамотность — по 10. Слабость в более «дорогом» предмете приоритетнее.',
    `Отвечай СТРОГО на ${LANG_NAME[language]} языке. Верни ТОЛЬКО валидный JSON-объект, без markdown и пояснений вне JSON.`,
  ].join('\n');
}

export function weakZoneUserPrompt(input: {
  language: AiLanguage;
  subjects: PromptSubject[];
  mistakes: PromptMistake[];
  totalOpen: number;
}): string {
  const schema = `Схема ответа (JSON):
{
  "overview": "string — 2-3 предложения: общая картина по ошибкам ученика",
  "weakZones": [
    {
      "subjectId": "string — ОДИН из subjectId предоставленного списка subjects",
      "title": "string — короткое название слабой зоны (тема/концепт)",
      "severity": "high | medium | low",
      "rootCause": "string — корневая причина: что именно ученик не понимает или путает",
      "recommendations": ["string", "string"],  // 2-4 конкретных действия
      "mistakeRefs": [число, ...]  // ref из списка mistakes, относящиеся к этой зоне
    }
  ],
  "studyPlan": [
    { "order": 1, "focus": "string — на чём сфокусироваться", "why": "string — почему это в приоритете", "days": число }
  ],
  "motivation": "string — 1-2 предложения поддержки и мотивации"
}`;

  const data = {
    totalOpenMistakes: input.totalOpen,
    subjects: input.subjects,
    // Strip questionId from the prompt — the model echoes the small `ref` instead
    // of long UUIDs (less error-prone, fewer tokens); the server maps ref→questionId.
    mistakes: input.mistakes.map((m) => ({
      ref: m.ref,
      subjectId: m.subjectId,
      subject: m.subject,
      topic: m.topic,
      difficulty: m.difficulty,
      question: m.question,
      studentAnswer: m.studentAnswer,
      correctAnswer: m.correctAnswer,
      timeSpentSecs: m.timeSpentSecs,
    })),
  };

  return [
    'Данные об открытых ошибках ученика (последний ответ на эти вопросы был неверным):',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
    '',
    'Сформируй 2-5 наиболее важных слабых зон (не дроби слишком мелко), план подготовки из 3-5 шагов в порядке приоритета и короткую мотивацию.',
    'В mistakeRefs указывай только ref из предоставленного списка mistakes.',
    '',
    schema,
  ].join('\n');
}

// ─── Per-mistake explanation ─────────────────────────────────────────────────

export function explainSystemPrompt(language: AiLanguage): string {
  return [
    'Ты — терпеливый репетитор по подготовке к ЕНТ (Казахстан).',
    'Ученик ошибся в конкретном вопросе. Объясни ИМЕННО его ошибку: почему выбранный им вариант неверен (какое заблуждение за этим стоит), и как прийти к правильному ответу.',
    'Будь конкретным и кратким, говори простым языком, как живой наставник. Не лей воду.',
    `Отвечай СТРОГО на ${LANG_NAME[language]} языке. Верни ТОЛЬКО валидный JSON-объект.`,
  ].join('\n');
}

export function explainUserPrompt(input: {
  subject: string;
  topic: string;
  question: string;
  passage: string;
  options: { text: string; isCorrect: boolean; chosen: boolean }[];
}): string {
  const schema = `Схема ответа (JSON):
{
  "diagnosis": "string — почему именно выбранный учеником вариант неверен, какое заблуждение за этим стоит",
  "correctApproach": "string — пошагово, как правильно рассуждать к верному ответу",
  "keyConcept": "string — ключевое правило/формула/факт, который здесь проверяется",
  "tip": "string — как не допустить такую ошибку в следующий раз"
}`;

  const data = {
    subject: input.subject,
    topic: input.topic,
    ...(input.passage ? { passage: input.passage } : {}),
    question: input.question,
    options: input.options.map((o, i) => ({
      label: String.fromCharCode(65 + i),
      text: o.text,
      isCorrect: o.isCorrect,
      chosenByStudent: o.chosen,
    })),
  };

  return [
    'Данные вопроса и ответа ученика:',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
    '',
    schema,
  ].join('\n');
}

// ─── Topic reinforcement lesson ─────────────────────────────────────────────

export function topicLessonSystemPrompt(language: AiLanguage): string {
  return [
    'Ты — опытный преподаватель и методист по подготовке к ЕНТ (Казахстан), умеющий объяснять глубоко и понятно.',
    'Создай ПОЛНОЦЕННЫЙ, подробный учебный урок по одной теме — как полноценное занятие, а не краткую шпаргалку.',
    'Каждая секция теории должна по-настоящему обучать: давай интуицию («почему это так»), выводи или обосновывай формулы, показывай как рассуждать, приводи маленькие пояснения прямо в тексте. Пиши развёрнуто, в 2–4 абзаца на секцию, без «воды», но и без излишней краткости.',
    'Иди от простого к сложному: сначала база и определения, затем методы и формулы, затем сложные случаи и связки с другими темами. Подсвечивай типичные заблуждения прямо по ходу объяснения.',
    'Разобранные примеры делай детальными: каждый шаг — отдельным понятным пунктом с пояснением, что и зачем делаем, и в конце — чёткий ответ и предупреждение о ловушке.',
    'Форматирование строк: обычный текст; для абзацев разделяй двумя переводами строки (\\n\\n); ВСЮ математику пиши в LaTeX ($...$ для строчных, $$...$$ для выносных). НЕ используй markdown-символы вне LaTeX (никаких **, ##, маркеров списков «- » в тексте) — перечисления оформляй отдельными полями схемы (steps, checklist, commonTraps).',
    'Не используй персональные ответы ученика и не утверждай, что ученик выбрал конкретный вариант. Урок кэшируется по теме и переиспользуется всеми.',
    'Графики возвращай как структурированные данные (line/bar/table), а не картинками или ASCII. Если тема не математическая — дай таблицу/сравнение.',
    'Опирайся на тему, предмет и примеры вопросов из банка; не выдумывай факты, противоречащие программе ЕНТ.',
    `Отвечай СТРОГО на ${LANG_NAME[language]} языке. Верни ТОЛЬКО валидный JSON-объект. Будь содержательным, но уложись в лимит ответа — не обрывай JSON на середине.`,
  ].join('\n');
}

export function topicLessonUserPrompt(input: {
  language: AiLanguage;
  exam: string;
  subject: string;
  topic: string;
  questions: PromptLessonQuestion[];
}): string {
  const schema = `Схема ответа (JSON):
{
  "title": "string — короткий заголовок урока",
  "studentGoal": "string — что ученик сможет делать после урока",
  "whyItMatters": "string — почему тема важна для ЕНТ",
  "sections": [
    {
      "title": "string",
      "content": "string — объяснение простым языком, можно использовать LaTeX вида $...$ или $$...$$"
    }
  ],
  "formulas": [
    { "latex": "string — только LaTeX без $", "note": "string — когда применять" }
  ],
  "visualizations": [
    {
      "type": "line | bar | table",
      "title": "string",
      "xLabel": "string",
      "yLabel": "string",
      "data": [
        { "label": "string", "value": число, "secondValue": число | null }
      ]
    }
  ],
  "workedExamples": [
    {
      "title": "string",
      "question": "string",
      "steps": ["string", "string"],
      "answer": "string",
      "trap": "string — типичная ошибка"
    }
  ],
  "practice": [
    {
      "prompt": "string",
      "options": ["string", "string"],
      "answer": "string",
      "explanation": "string"
    }
  ],
  "commonTraps": ["string", "string"],
  "checklist": ["string", "string"],
  "miniTest": [
    { "prompt": "string", "answer": "string", "explanation": "string" }
  ]
}`;

  const data = {
    exam: input.exam,
    subject: input.subject,
    topic: input.topic,
    sampleQuestions: input.questions,
  };

  return [
    'Создай мини-урок для закрепления темы:',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
    '',
    'Требования к полноценному уроку:',
    '- 5-7 секций теории, каждая развёрнутая (2-4 абзаца): определение/идея → объяснение «почему» → как применять → короткий пример или замечание. Абзацы разделяй \\n\\n.',
    '- 3-6 формул/ключевых правил с пояснением, КОГДА и КАК применять (поле note).',
    '- 1-3 визуализации (line/bar/table) с осмысленными данными, где это помогает понять тему.',
    '- 4-6 подробно разобранных примеров: поле steps — 4-8 понятных шагов с пояснениями; обязательно answer и trap.',
    '- 6-8 заданий для закрепления (practice) с вариантами и разбором в explanation, и 4-5 заданий в miniTest.',
    '- 4-6 типичных ловушек (commonTraps) и 5-7 пунктов чек-листа готовности (checklist).',
    '- Вся математика — в LaTeX. Никаких markdown-символов в тексте (** , ##, «- »).',
    '- Будь содержательным и глубоким, но следи за лимитом ответа — JSON должен быть полным и валидным.',
    '',
    schema,
  ].join('\n');
}

// ─── Study-theme taxonomy (curriculum themes, independent of DB topics) ─────────

export function themeTaxonomySystemPrompt(language: AiLanguage): string {
  return [
    'Ты — методист ЕНТ (Казахстан), отлично знающий официальную программу предмета.',
    'Составь канонический список учебных тем предмета — так, как они разбиты в программе ЕНТ.',
    'Темы должны покрывать предмет целиком, быть взаимоисключающими и осмысленными (не слишком крупными и не слишком мелкими): обычно 8–16 тем.',
    'Ориентируйся на свои знания программы ЕНТ; примеры вопросов из банка — лишь подсказка о реальном наполнении, не ограничивайся ими.',
    `Поле "key" — стабильный латиницей slug (a-z, 0-9, дефис). "name" — на ${LANG_NAME[language]} языке.`,
    'Верни ТОЛЬКО валидный JSON-объект.',
  ].join('\n');
}

export function themeTaxonomyUserPrompt(input: {
  exam: string;
  subject: string;
  sampleQuestions: string[];
}): string {
  const schema = `Схема ответа (JSON):
{
  "themes": [
    { "key": "string — латиницей slug", "name": "string — название темы" }
  ]
}`;
  const data = {
    exam: input.exam,
    subject: input.subject,
    sampleQuestions: input.sampleQuestions,
  };
  return [
    'Составь список учебных тем для предмета:',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
    '',
    'Дай 8–16 тем, покрывающих программу предмета на ЕНТ.',
    '',
    schema,
  ].join('\n');
}

// ─── Question → theme classification ────────────────────────────────────────────

export interface PromptClassifyQuestion {
  ref: number;
  question: string;
}

export function classifySystemPrompt(): string {
  return [
    'Ты — методист ЕНТ. Отнеси каждый вопрос ровно к ОДНОЙ теме из предложенного списка по его содержанию.',
    'Если вопрос явно не попадает ни в одну тему — верни key="other".',
    'Опирайся на суть вопроса, а не на отдельные слова. Верни ТОЛЬКО валидный JSON-объект.',
  ].join('\n');
}

export function classifyUserPrompt(input: {
  subject: string;
  themes: { key: string; name: string }[];
  questions: PromptClassifyQuestion[];
}): string {
  const schema = `Схема ответа (JSON):
{
  "assignments": [
    { "ref": число, "key": "string — key темы из списка или \\"other\\"" }
  ]
}`;
  const data = {
    subject: input.subject,
    themes: input.themes,
    questions: input.questions,
  };
  return [
    'Классифицируй вопросы по темам:',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
    '',
    'Верни assignment для КАЖДОГО ref из questions.',
    '',
    schema,
  ].join('\n');
}
