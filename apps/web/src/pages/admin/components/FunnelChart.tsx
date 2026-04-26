import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { FunnelData } from '../../api/analytics';

interface FunnelChartProps {
  data: FunnelData;
}

export function FunnelChart({ data }: FunnelChartProps) {
  const chartData = [
    { name: 'Visit', value: data.totals.visits, fill: '#7c3aed' },
    { name: 'Registered', value: data.totals.registered, fill: '#8b5cf6' },
    { name: 'Started', value: data.totals.started, fill: '#a78bfa' },
    { name: 'Completed', value: data.totals.completed, fill: '#c4b5fd' },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout={{ type: 'category', height: 200 }}>
          <XAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis type="number" tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), 'Count']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <LabelList key={index} dataKey="value" position="top" style={{ fontSize: 12 }} />
            ))}
            {chartData.map((entry, index) => (
              <rect key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
