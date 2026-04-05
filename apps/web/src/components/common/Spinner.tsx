export function Spinner({ fullScreen, size = 'md' }: { fullScreen?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const cls = `spinner ${size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : ''}`;
  if (fullScreen) {
    return <div className="spinner-screen"><div className={cls} /></div>;
  }
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className={cls} /></div>;
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card skeleton" style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  );
}
