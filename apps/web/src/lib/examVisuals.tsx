/** Общие цвета, градиенты и иконки экзаменов (главная, профиль и др.). */

export const EXAM_COLORS: Record<string, string> = {
  ent: '#6366f1',
  nuet: '#8b5cf6',
  nis: '#10b981',
  ktl: '#f59e0b',
  physmath: '#3b82f6',
};

export const EXAM_GRADIENTS: Record<string, string> = {
  ent: 'linear-gradient(135deg, #6366f1, #4f46e5)',
  nuet: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  nis: 'linear-gradient(135deg, #10b981, #059669)',
  ktl: 'linear-gradient(135deg, #f59e0b, #d97706)',
  physmath: 'linear-gradient(135deg, #3b82f6, #2563eb)',
};

/** Растровые бейджи из `public/assets/images/exams/` */
export const EXAM_ICON_SRC: Record<string, string> = {
  ent: '/assets/images/exams/ENT.png',
  nis: '/assets/images/exams/NIS.png',
  ktl: '/assets/images/exams/KTL.png',
};

type ExamIconProps = { slug: string; size?: number };

export function ExamIcon({ slug, size = 22 }: ExamIconProps) {
  const props = {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
  } as const;
  switch (slug) {
    case 'ent':
      return (
        <svg {...props}>
          <path d="M3 8.5 12 4l9 4.5L12 13 3 8.5Z" />
          <path d="M7 11.2V15c0 1.1 2.2 2 5 2s5-.9 5-2v-3.8" />
        </svg>
      );
    case 'nuet':
      return (
        <svg {...props}>
          <path d="M2 10h20M4 10V7l8-4 8 4v3M6 10v8M10 10v8M14 10v8M18 10v8M3 18h18" />
        </svg>
      );
    case 'nis':
      return (
        <svg {...props}>
          <path d="M9.5 3.5A3.5 3.5 0 0 0 6 7c0 2 1.6 3.6 3.6 3.6h.5V14a2 2 0 1 0 3.8 0v-3.4h.5A3.6 3.6 0 0 0 18 7a3.5 3.5 0 0 0-3.5-3.5c-1.2 0-2.3.6-3 1.5-.7-.9-1.8-1.5-3-1.5Z" />
          <path d="M9 18h6M10 21h4" />
        </svg>
      );
    case 'ktl':
      return (
        <svg {...props}>
          <path d="m4 18 8-13 8 13H4Z" />
          <path d="M8 12h8" />
        </svg>
      );
    case 'physmath':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6.2 6.2l2.2 2.2M15.6 15.6l2.2 2.2M17.8 6.2l-2.2 2.2M8.4 15.6l-2.2 2.2" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
      );
  }
}

export type ExamTileIconProps = {
  slug: string;
  wrapperClassName: string;
  /** Класс при использовании PNG из `EXAM_ICON_SRC` (как `.exam-row-icon--raster` на главной). */
  rasterWrapperClassName?: string;
  iconSize?: number;
};

/**
 * Иконка экзамена: те же растровые бейджи, что на главной, иначе градиент + SVG.
 */
export function ExamTileIcon({
  slug,
  wrapperClassName,
  rasterWrapperClassName = '',
  iconSize = 22,
}: ExamTileIconProps) {
  const s = (slug || '').trim();
  const src = EXAM_ICON_SRC[s];
  const color = EXAM_COLORS[s] || '#6366f1';
  const gradient =
    EXAM_GRADIENTS[s] || `linear-gradient(135deg, ${color}, ${color})`;

  if (src) {
    return (
      <div className={[wrapperClassName, rasterWrapperClassName].filter(Boolean).join(' ')}>
        <img src={src} alt="" className="exam-row-icon-img" decoding="async" />
      </div>
    );
  }

  return (
    <div className={wrapperClassName} style={{ background: gradient, color: '#fff' }}>
      <ExamIcon slug={s || 'default'} size={iconSize} />
    </div>
  );
}
