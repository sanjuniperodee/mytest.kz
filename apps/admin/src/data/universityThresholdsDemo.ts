/**
 * Иллюстративные пороговые баллы для демонстрации в админке.
 * Реальные значения зависят от вуза, специальности и года — подставьте официальные данные при интеграции с источником.
 */
export type ThresholdRow = {
  university: string;
  specialty: string;
  y2022: number;
  y2023: number;
  y2024: number;
  y2025: number;
  y2026: number;
};

export const UNIVERSITY_THRESHOLDS_DEMO: ThresholdRow[] = [
  {
    university: 'Назарбаев Университеті',
    specialty: 'Информатика',
    y2022: 125,
    y2023: 128,
    y2024: 130,
    y2025: 132,
    y2026: 134,
  },
  {
    university: 'ҚазҰТУ',
    specialty: 'Медицина (общая)',
    y2022: 118,
    y2023: 120,
    y2024: 122,
    y2025: 124,
    y2026: 126,
  },
  {
    university: 'ҚазҰПУ',
    specialty: 'Педагогика (математика)',
    y2022: 95,
    y2023: 97,
    y2024: 99,
    y2025: 101,
    y2026: 103,
  },
  {
    university: 'ЕНУ им. Л.Н. Гумилёва',
    specialty: 'Экономика',
    y2022: 88,
    y2023: 90,
    y2024: 92,
    y2025: 94,
    y2026: 96,
  },
];
