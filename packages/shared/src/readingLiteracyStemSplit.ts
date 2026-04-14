/**
 * Делит длинный stem блока «Оқу сауаттылығы» на мәтін + сұрақ (эвристика по сидам).
 * Если разделить нельзя — возвращаем null (один блок как раньше).
 */
const MIN_PASSAGE_LEN = 55;
const MAX_PROMPT_LEN = 420;

/** Фразы начала задания после точки и пробела; длинные раньше коротких. */
const QUESTION_START_AFTER_DOT = [
  // Қазақша
  'Жетіспейтін сөзді табыңыз',
  'Мəтін мазмұнынан алшақ ойды табыңыз',
  'Мəтіннің соңғы бөлігінде айтылған ойды табыңыз',
  'Мəтіннің соңғы бөлігінде айтылған ой',
  'Мəтінде эндемикалық өсімдіктер қатарына жататын түрді көрсетіңіз',
  'Мəтінде Бейбарыс сұлтанға қатысты не айтылмады',
  'Мəтін бойынша дəрілік өсімдіктердің басты ерекшелігі',
  'Мəтінге тəн стиль түрі',
  'Мəтіннен шығатын қорытынды',
  'Мəтінге қайшы тұжырым',
  'Мәтінге қайшы тұжырым',
  'Мəтінге лайық тақырып',
  'Мəтінге сəйкес',
  'Мəтінге ',
  'Мәтінге ',
  // Орысский
  'Утверждение, противоречащее тексту',
  'Пропущенное слово в ряду',
  'В каком абзаце встречаются',
  'В каком абзаце',
  'Согласно тексту,',
  'Согласно тексту ',
  'О влиянии плавания',
  'Сколько калорий',
  'Что изначально обозначал',
  'Что из перечисленного',
  'Какое из утверждений',
  'Какая из причин',
  'Определите стиль текста',
  'Определите тип речи',
  'Укажите неверное утверждение',
  'Выберите неверное утверждение',
  'Укажите верные параметры',
  'Укажите верное утверждение',
  'Укажите неверное',
  'Укажите ',
  'Найдите ',
  'Выберите ',
  'Определите ',
].sort((a, b) => b.length - a.length);

/** Хвост после последних предложений — похож на формулировку задания, а не на абзац текста. */
function looksLikeQuestionTail(t: string): boolean {
  const s = t.trim();
  if (s.length < 6 || s.length > MAX_PROMPT_LEN) return false;
  if (s.endsWith('?')) return true;

  const prefixes = [
    'Укажите',
    'Найдите',
    'Выберите',
    'Определите',
    'Согласно тексту',
    'В каком абзаце',
    'Пропущенное слово',
    'Утверждение,',
    'Сколько калорий',
    'О влиянии',
    'Что из',
    'Какое из',
    'Какая из',
    'Какой из',
    'Учебными принадлежностями',
    'Мəтінге',
    'Мәтінге',
    'Жетіспейтін',
    'Мəтін бойынша',
    'Мəтіннің стилін',
    'Мəтін мазмұнына',
    'Мəтінде жауабы',
    'Қате тұжырымды',
    'Дұрыс тұжырымды',
    'Автор қай',
    'Тұжырымдардың дұрысы',
    'Бірінші азатжолдағы',
    'Мəтін бойынша қазақ',
    'Үрмелі музыкалық',
    'Үрмелі аспаптың',
    'Керней аспабының',
    'Жазушының əкесі',
    'Жазушының',
    'Төреқұл Айтматовтың',
    'Лениндік сыйлық',
    '«Жəмилə» повесі',
    'Қазақтың ерекше ырымы',
    'Келін үйдің',
    'Қырқынан шығару',
    'Мереке күндері',
    'Киімді сəндеу',
    'Қыздың ұзатылуы',
    'Қыш-құмыра өндіру',
    'Мəтіндегі Үркер',
    'Автордың жұлдыздар',
    'Халықтың:',
    'Бірінші көрмеге',
    'Мəтін мазмұнына сай',
    'реттілігін анықтаңыз',
    'Ягель бір жылда',
    'За год ягель',
  ];

  if (prefixes.some((p) => s.startsWith(p))) return true;

  if (s.length <= 120 && /таңдаңыз:|табыңыз:|анықтаңыз:|көрсетіңіз:/.test(s)) return true;

  return false;
}

function splitByNeedles(s: string): { passage: string; prompt: string } | null {
  for (const needle of QUESTION_START_AFTER_DOT) {
    const marker = '. ' + needle;
    const hit = s.lastIndexOf(marker);
    if (hit < MIN_PASSAGE_LEN) continue;
    const prompt = s.slice(hit + 2).trim();
    if (prompt.length < 4) continue;
    return { passage: s.slice(0, hit + 1).trim(), prompt };
  }
  return null;
}

function splitByQuestionMark(s: string): { passage: string; prompt: string } | null {
  if (!s.endsWith('?')) return null;
  const before = s.slice(0, -1);
  const lastDot = before.lastIndexOf('. ');
  if (lastDot < MIN_PASSAGE_LEN) return null;
  const prompt = s.slice(lastDot + 2).trim();
  if (prompt.length < 8 || prompt.length > 520) return null;
  return { passage: s.slice(0, lastDot + 1).trim(), prompt };
}

function splitByTrailingSegments(s: string): { passage: string; prompt: string } | null {
  const parts = s.split('. ');
  if (parts.length < 2) return null;

  for (let n = 1; n < parts.length; n++) {
    const headParts = parts.slice(0, -n);
    const tailParts = parts.slice(-n);
    const passageCore = headParts.join('. ');
    if (passageCore.length < MIN_PASSAGE_LEN) break;

    const prompt = tailParts.join('. ').trim();
    if (!looksLikeQuestionTail(prompt)) continue;

    const passage = passageCore.endsWith('.') ? passageCore : `${passageCore}.`;
    return { passage, prompt };
  }
  return null;
}

export function splitReadingStem(raw: string): { passage: string; prompt: string } | null {
  const s = raw.replace(/\r\n/g, '\n').trim();
  if (s.length < MIN_PASSAGE_LEN + 15) return null;

  const idxPara = s.indexOf('\n\n');
  if (idxPara >= MIN_PASSAGE_LEN && s.length - idxPara > 20) {
    return { passage: s.slice(0, idxPara).trim(), prompt: s.slice(idxPara + 2).trim() };
  }

  return (
    splitByNeedles(s) ??
    splitByQuestionMark(s) ??
    splitByTrailingSegments(s)
  );
}
