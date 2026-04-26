import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FunnelData } from '../api/platformAnalytics';

type Props = { data: FunnelData };

const CHART = [
  { name: 'Визит', key: 'visits' as const, fill: '#7c3aed' },
  { name: 'Регистрация', key: 'registered' as const, fill: '#8b5cf6' },
  { name: 'Старт теста', key: 'started' as const, fill: '#a78bfa' },
  { name: 'Завершили', key: 'completed' as const, fill: '#c4b5fd' },
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
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
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
