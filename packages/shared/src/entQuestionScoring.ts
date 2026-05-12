import { ENT_CONFIG } from './constants/index';

/** TotalErrors в спецификации ЕНТ: недобор верных + лишние отмеченные. */
export function computeEntTotalErrors(
  correctIds: readonly string[],
  selectedIds: readonly string[],
): number {
  let errors = 0;
  const selected = new Set(selectedIds);
  const correct = new Set(correctIds);
  for (const id of correctIds) if (!selected.has(id)) errors++;
  for (const id of selectedIds) if (!correct.has(id)) errors++;
  return errors;
}

/**
 * Баллы за один вопрос по правилам weighted ENT.
 * При пустом ответе (ничего не отмечено) — 0 баллов даже если wMax положительный.
 */
export function earnEntQuestionPoints(
  wMax: number,
  correctIds: readonly string[],
  selectedIds: readonly string[],
): { earned: number; max: number; errors: number } {
  const errors = computeEntTotalErrors(correctIds, selectedIds);
  const max = Math.max(1, Math.floor(Number(wMax)) || 0);
  let earned = 0;
  if (selectedIds.length > 0) {
    if (errors === 0) {
      earned = max;
    } else if (errors === 1 && max === 2) {
      earned = 1;
    }
  }
  return { earned, max: wMax <= 0 ? 0 : max, errors };
}

/**
 * Макс. число опций пользователь может отметить в полном ЕНТ в профильном блоке для слотов 31–35 / 36–40.
 * Иначе null (лимит на клиенте не навязываем).
 */
export function getEntProfileMaxSelections(opts: {
  entScope?: string;
  /** false = профильный блок профильных предметов */
  sectionIsMandatory?: boolean;
  profileHeavyFrom?: number | null;
  /** 1-based индекс вопроса внутри секции предмета */
  indexInSection: number;
}): number | null {
  if (opts.entScope !== 'full') return null;
  if (opts.sectionIsMandatory !== false) return null;
  const from = opts.profileHeavyFrom ?? ENT_CONFIG.profileTier1Count + 1;
  if (opts.indexInSection < from) return null;
  const rel0 = opts.indexInSection - from;
  if (
    rel0 < 0 ||
    rel0 >= ENT_CONFIG.profileTier2ACount + ENT_CONFIG.profileTier2BCount
  ) {
    return null;
  }
  if (rel0 < ENT_CONFIG.profileTier2ACount) return ENT_CONFIG.profileTier2ACorrectCount;
  return ENT_CONFIG.profileTier2BCorrectCount;
}

/**
 * Верхняя граница веса вопроса по структуре ответов (независимо от позиции в варианте).
 * Нужна при доборе вопросов из банка: слот 31–40 не должен давать 2 балла за типичный 4×1.
 */
export function getEntProfileIntrinsicMaxPoints(
  answerOptions: ReadonlyArray<{ isCorrect: boolean }>,
): number {
  const n = answerOptions.length;
  const c = answerOptions.filter((o) => o.isCorrect).length;
  if (
    n === ENT_CONFIG.profileTier1OptionCount &&
    c === ENT_CONFIG.profileTier1CorrectCount
  ) {
    return ENT_CONFIG.profileTier1Points;
  }
  if (
    n === ENT_CONFIG.profileTier2AOptionCount &&
    c >= 1 &&
    c <= ENT_CONFIG.profileTier2ACorrectCount
  ) {
    return ENT_CONFIG.profileTier2Points;
  }
  if (
    n === ENT_CONFIG.profileTier2BOptionCount &&
    c >= 1 &&
    c <= ENT_CONFIG.profileTier2BCorrectCount
  ) {
    return ENT_CONFIG.profileTier2Points;
  }
  if (c <= 1) return ENT_CONFIG.profileTier1Points;
  return ENT_CONFIG.profileTier2Points;
}

/** Лимит выбора в тяжёлом слоте с учётом числа верных ответов у конкретного вопроса. */
export function clampEntProfileHeavySlotSelections(
  slotCap: number,
  answerOptions: ReadonlyArray<{ isCorrect: boolean }>,
): number {
  const c = answerOptions.filter((o) => o.isCorrect).length;
  if (c <= 0) return slotCap;
  return Math.min(slotCap, c);
}
