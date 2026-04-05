import { useEffect, useRef } from 'react';

export interface SubjectTabSection {
  startIndex: number;
  subjectName: string;
  count: number;
}

interface Props {
  sections: SubjectTabSection[];
  currentQuestionIndex: number;
  onSelect: (startIndex: number) => void;
}

export function SubjectTabs({ sections, currentQuestionIndex, onSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const rawActive = sections.findIndex((s, i) => {
    const nextStart = sections[i + 1]?.startIndex ?? Number.MAX_SAFE_INTEGER;
    return currentQuestionIndex >= s.startIndex && currentQuestionIndex < nextStart;
  });
  const activeIdx = rawActive >= 0 ? rawActive : 0;

  useEffect(() => {
    const el = activeRef.current;
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    const pad = 16;
    const left = el.offsetLeft - sc.clientWidth / 2 + el.offsetWidth / 2;
    sc.scrollTo({ left: Math.max(0, left - pad), behavior: 'smooth' });
  }, [activeIdx, currentQuestionIndex]);

  if (sections.length <= 1) return null;

  return (
    <div className="test-subject-tabs-wrap">
      <div ref={scrollerRef} className="test-subject-tabs-scroll">
        {sections.map((s, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={`${s.startIndex}-${s.subjectName}`}
              ref={isActive ? activeRef : undefined}
              type="button"
              className={`test-subject-tab ${isActive ? 'test-subject-tab-active' : ''}`}
              onClick={() => onSelect(s.startIndex)}
            >
              <span className="test-subject-tab-label">{s.subjectName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
