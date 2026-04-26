import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FunnelData } from '../api/platformAnalytics';

type Props = { data: FunnelData };

/* Системные оттенки синего (Apple HIG) */
const CHART = [
  { name: 'Визит', key: 'visits' as const, fill: '#007aff' },
  { name: 'Регистрация', key: 'registered' as const, fill: '#0a84ff' },
  { name: 'Старт теста', key: 'started' as const, fill: '#40a0ff' },
  { name: 'Завершили', key: 'completed' as const, fill: '#5ac8fa' },
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
            contentStyle={{ borderRadius: 12, border: '0.5px solid rgba(60, 60, 67, 0.12)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)' }}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
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
