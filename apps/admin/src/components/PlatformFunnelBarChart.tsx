import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FunnelData } from '../api/platformAnalytics';

type Props = { data: FunnelData };

/* Палитра в тон indigo-акценту админки */
const CHART = [
  { name: 'Визит', key: 'visits' as const, fill: '#4f46e5' },
  { name: 'Регистрация', key: 'registered' as const, fill: '#6366f1' },
  { name: 'Старт теста', key: 'started' as const, fill: '#818cf8' },
  { name: 'Завершили', key: 'completed' as const, fill: '#a5b4fc' },
];

export function PlatformFunnelBarChart({ data }: Props) {
  const chartData = CHART.map((c) => ({
    name: c.name,
    value: data.totals[c.key],
    fill: c.fill,
  }));

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20 }}>
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(v: number) => [v.toLocaleString('ru-RU'), '']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', boxShadow: '0 4px 12px rgba(24, 24, 27, 0.08)' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((e, i) => (
              <Cell key={i} fill={e.fill} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
