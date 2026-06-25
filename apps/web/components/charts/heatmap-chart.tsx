"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function HeatmapChart({
  data,
}: {
  data: { file: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-80 w-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
        No affected files yet.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <BarChart
          data={data.slice(0, 12)}
          layout="vertical"
          margin={{ left: 20, right: 20 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="file" type="category" width={240} />
          <Tooltip />
          <Bar dataKey="count" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
