interface Segment {
  answered: number;
  total: number;
}

interface Props {
  segments: Segment[];
  ariaLabel: string;
}

export function TestSectionProgress({ segments, ariaLabel }: Props) {
  if (segments.length <= 1) return null;

  return (
    <div className="test-section-progress" role="img" aria-label={ariaLabel}>
      {segments.map((seg, i) => {
        const pct = seg.total > 0 ? Math.min(100, (seg.answered / seg.total) * 100) : 0;
        return (
          <div key={i} className="test-section-progress-segment" style={{ flex: seg.total }}>
            <div className="test-section-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        );
      })}
    </div>
  );
}
